import fs from 'fs-extra';
import path from 'node:path';
import {
  RawProfileSchema,
  SourceEvidenceSchema,
  type RawProfile,
  type SourceEvidence,
  type SourceType,
  type UserProfile,
} from '../schemas/profile.js';
import type { AppConfig } from '../config.js';
import { isLlmAvailable } from '../llm/index.js';
import { ensureWorkspaceStructure, readJsonFile, readJsonLines, writeJsonFile, writeJsonLines } from '../storage/index.js';
import { dedupeExperiences, extractDeterministicProfile } from './deterministic.js';
import { normalizeProfile, buildProfileGaps } from './normalize.js';
import { parseInputFile } from './parsers.js';
import { createStableId, hashContent, normalizeWhitespace, splitIntoChunks } from './text.js';

type IngestOptions = {
  config: AppConfig;
  cvPaths: string[];
  linkedinPdfPaths: string[];
  linkedinExportPaths: string[];
  notesPaths: string[];
  extraPaths: string[];
  noLlm: boolean;
  force: boolean;
};

type CacheRecord = {
  files: Record<
    string,
    {
      contentHash: string;
      sourceIds: string[];
    }
  >;
};

const EMPTY_CACHE: CacheRecord = { files: {} };

function getProfileDir(config: AppConfig) {
  return path.join(config.dataDir, 'profile');
}

function getProfilePaths(config: AppConfig) {
  const profileDir = getProfileDir(config);
  return {
    profileDir,
    sourcesPath: path.join(profileDir, 'sources.jsonl'),
    rawPath: path.join(profileDir, 'profile.raw.json'),
    normalizedPath: path.join(profileDir, 'profile.normalized.json'),
    gapsPath: path.join(profileDir, 'profile.gaps.md'),
    cachePath: path.join(profileDir, 'cache.json'),
    llmCacheDir: path.join(profileDir, 'llm-cache'),
  };
}

function toAbsolute(cwd: string, filePath: string) {
  return path.resolve(cwd, filePath);
}

async function loadCache(cachePath: string) {
  if (!(await fs.pathExists(cachePath))) {
    return EMPTY_CACHE;
  }

  return readJsonFile<CacheRecord>(cachePath);
}

function filesByType(options: IngestOptions): Array<{ sourceType: SourceType; filePath: string }> {
  return [
    ...options.cvPaths.map((filePath) => ({ sourceType: 'cv_pdf' as const, filePath })),
    ...options.linkedinPdfPaths.map((filePath) => ({ sourceType: 'linkedin_pdf' as const, filePath })),
    ...options.linkedinExportPaths.map((filePath) => ({
      sourceType: 'linkedin_export' as const,
      filePath,
    })),
    ...options.notesPaths.map((filePath) => ({ sourceType: 'notes' as const, filePath })),
    ...options.extraPaths.map((filePath) => ({ sourceType: 'extra' as const, filePath })),
  ];
}

async function sourceEvidencesFromFile(
  absolutePath: string,
  sourceType: SourceType,
  contentHash: string,
  createdAt: string
) {
  const documents = await parseInputFile(absolutePath, sourceType);
  const evidences: SourceEvidence[] = [];

  for (const document of documents) {
    const normalizedText = normalizeWhitespace(document.rawText);
    const chunks = splitIntoChunks(normalizedText);

    chunks.forEach((chunk, chunkIndex) => {
      const sourceId = createStableId(
        'src',
        `${document.filePath}:${chunkIndex}:${contentHash}:${chunk.slice(0, 80)}`
      );
      evidences.push(
        SourceEvidenceSchema.parse({
          sourceId,
          sourceType: document.sourceType,
          filePath: document.filePath,
          rawText: chunk,
          normalizedText: chunk,
          confidence: document.confidence,
          createdAt,
          contentHash,
          chunkIndex,
        })
      );
    });
  }

  return evidences;
}

function buildRawProfile(
  sources: SourceEvidence[],
  sourceFiles: RawProfile['sourceFiles'],
  llmEnabled: boolean
): RawProfile {
  const extracted = extractDeterministicProfile(sources);

  return RawProfileSchema.parse({
    generatedAt: new Date().toISOString(),
    llmEnabled,
    sourceFiles,
    contacts: extracted.contacts,
    summaries: extracted.summaries,
    headlineCandidates: extracted.headlineCandidates,
    nameCandidates: extracted.nameCandidates,
    experiences: dedupeExperiences(extracted.experiences),
    education: extracted.education,
    projects: extracted.projects,
    technicalSkills: extracted.technicalSkills,
    softSkills: extracted.softSkills,
    languages: extracted.languages,
    certifications: extracted.certifications,
    industries: extracted.industries,
    interests: extracted.interests,
    achievements: extracted.achievements,
    recurringKeywords: extracted.recurringKeywords,
  });
}

export async function ingestProfile(options: IngestOptions) {
  await ensureWorkspaceStructure(options.config);
  const profilePaths = getProfilePaths(options.config);
  await fs.ensureDir(profilePaths.profileDir);

  const files = filesByType(options);
  if (files.length === 0) {
    throw new Error('No profile input files provided.');
  }

  const llmEnabled = isLlmAvailable(options.config.openaiApiKey) && !options.noLlm;
  const cache = await loadCache(profilePaths.cachePath);
  const previousSources = await readJsonLines<SourceEvidence>(profilePaths.sourcesPath);
  const previousSourcesById = new Map(previousSources.map((source) => [source.sourceId, source]));
  const nextCache: CacheRecord = { files: {} };
  const sources: SourceEvidence[] = [];
  const sourceFiles: RawProfile['sourceFiles'] = [];

  for (const input of files) {
    const absolutePath = toAbsolute(options.config.rootDir, input.filePath);
    const buffer = await fs.readFile(absolutePath);
    const contentHash = hashContent(buffer);
    const cacheKey = `${input.sourceType}:${absolutePath}`;
    const cached = cache.files[cacheKey];
    let evidences: SourceEvidence[] | undefined;

    if (!options.force && cached?.contentHash === contentHash) {
      const cachedSources = cached.sourceIds
        .map((sourceId) => previousSourcesById.get(sourceId))
        .filter(Boolean) as SourceEvidence[];
      if (cachedSources.length === cached.sourceIds.length) {
        evidences = cachedSources;
      }
    }

    if (!evidences) {
      evidences = await sourceEvidencesFromFile(
        absolutePath,
        input.sourceType,
        contentHash,
        new Date().toISOString()
      );
    }

    nextCache.files[cacheKey] = {
      contentHash,
      sourceIds: evidences.map((source) => source.sourceId),
    };
    sources.push(...evidences);
    sourceFiles.push({
      filePath: absolutePath,
      sourceType: input.sourceType,
      contentHash,
      sourceIds: evidences.map((source) => source.sourceId),
    });
  }

  const rawProfile = buildRawProfile(sources, sourceFiles, llmEnabled);
  const normalizedProfile = await normalizeProfile(rawProfile, sources, {
    apiKey: options.config.openaiApiKey,
    model: options.config.openaiModel,
    cacheDir: profilePaths.llmCacheDir,
    disabled: !llmEnabled,
  });
  const gapsMarkdown = buildProfileGaps(normalizedProfile);

  await writeJsonLines(profilePaths.sourcesPath, sources);
  await writeJsonFile(profilePaths.rawPath, rawProfile);
  await writeJsonFile(profilePaths.normalizedPath, normalizedProfile);
  await fs.outputFile(profilePaths.gapsPath, gapsMarkdown, 'utf8');
  await writeJsonFile(profilePaths.cachePath, nextCache);

  return {
    rawProfile,
    normalizedProfile,
    gapsMarkdown,
    llmEnabled,
    profilePaths,
    sourceCount: sources.length,
    inputCount: files.length,
  };
}

export async function loadNormalizedProfile(config: AppConfig) {
  const { normalizedPath } = getProfilePaths(config);
  if (!(await fs.pathExists(normalizedPath))) {
    throw new Error('Normalized profile not found. Run `cvgen profile ingest` first.');
  }
  return readJsonFile<UserProfile>(normalizedPath);
}

export async function loadRawProfile(config: AppConfig) {
  const { rawPath } = getProfilePaths(config);
  if (!(await fs.pathExists(rawPath))) {
    throw new Error('Raw profile not found. Run `cvgen profile ingest` first.');
  }
  return readJsonFile<RawProfile>(rawPath);
}

export async function exportProfile(config: AppConfig, outputPath?: string, mode: 'normalized' | 'raw' = 'normalized') {
  const profile = mode === 'raw' ? await loadRawProfile(config) : await loadNormalizedProfile(config);
  if (outputPath) {
    await writeJsonFile(path.resolve(config.rootDir, outputPath), profile);
  }
  return profile;
}

export function summarizeProfile(profile: UserProfile) {
  return {
    fullName: profile.fullName,
    headline: profile.headline,
    email: profile.contacts.email,
    experiences: profile.experiences.length,
    education: profile.education.length,
    projects: profile.projects.length,
    skills: profile.skills.length,
    languages: profile.languages.length,
    certifications: profile.certifications.length,
    achievements: profile.achievements.length,
    recurringKeywords: profile.recurringKeywords.slice(0, 10),
  };
}
