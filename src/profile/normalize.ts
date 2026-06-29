import { z } from 'zod';
import { createCacheKey, generateStructuredJson } from '../llm/index.js';
import {
  AchievementSchema,
  ContactSchema,
  PreferenceSchema,
  ProjectSchema,
  SkillSchema,
  UserProfileSchema,
  type Achievement,
  type Certification,
  type Language,
  type Project,
  type RawProfile,
  type Skill,
  type SourceEvidence,
  type UserProfile,
} from '../schemas/profile.js';
import { createStableId, uniqueStrings } from './text.js';

const ChunkInsightSchema = z.object({
  summary: z.string().optional(),
  preferences: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  technicalSkills: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
});

function mergeByName<T extends { name: string; evidenceIds: string[] }>(items: T[]) {
  const grouped = new Map<string, T>();

  for (const item of items) {
    const key = item.name.toLowerCase();
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, item);
      continue;
    }

    grouped.set(key, {
      ...existing,
      evidenceIds: uniqueStrings([...existing.evidenceIds, ...item.evidenceIds]),
    });
  }

  return [...grouped.values()];
}

function createSkills(values: string[], category: Skill['category'], evidenceIds: string[]) {
  return values.map((value) =>
    SkillSchema.parse({
      id: createStableId('skill', `${category}:${value}`),
      name: value,
      category,
      evidenceIds,
    })
  );
}

function normalizeContacts(rawContacts: string[]) {
  const contact: z.infer<typeof ContactSchema> = {};

  for (const item of rawContacts) {
    if (!contact.email && item.includes('@')) {
      contact.email = item;
    } else if (!contact.linkedinUrl && item.toLowerCase().includes('linkedin')) {
      contact.linkedinUrl = item;
    } else if (!contact.githubUrl && item.toLowerCase().includes('github')) {
      contact.githubUrl = item;
    } else if (!contact.websiteUrl && /^https?:\/\//i.test(item)) {
      contact.websiteUrl = item;
    } else if (!contact.phone && /\d/.test(item)) {
      contact.phone = item;
    }
  }

  return ContactSchema.parse(contact);
}

function inferSourceLanguages(sources: SourceEvidence[]) {
  const combinedText = sources.map((source) => source.normalizedText.toLowerCase()).join('\n');
  const languages: string[] = [];

  if (/\b(il|lo|la|gli|della|esperienza|lingue|formazione|competenze)\b/.test(combinedText)) {
    languages.push('it');
  }
  if (/\b(the|and|experience|skills|education|summary|languages)\b/.test(combinedText)) {
    languages.push('en');
  }

  return uniqueStrings(languages);
}

async function extractChunkInsights(
  sources: SourceEvidence[],
  llmOptions?: { apiKey?: string; model: string; cacheDir: string; disabled: boolean }
) {
  if (!llmOptions?.apiKey || llmOptions.disabled) {
    return [];
  }

  const selectedSources = sources.filter((source) => source.normalizedText.length > 200).slice(0, 12);
  const insights: z.infer<typeof ChunkInsightSchema>[] = [];

  for (const source of selectedSources) {
    const cacheKey = createCacheKey(['profile-chunk', source.contentHash, String(source.chunkIndex)]);
    const insight = await generateStructuredJson({
      apiKey: llmOptions.apiKey,
      model: llmOptions.model,
      schema: ChunkInsightSchema,
      cacheDir: llmOptions.cacheDir,
      cacheKey,
      systemPrompt:
        'Extract only explicit career facts. Return compact JSON. Do not invent any missing information.',
      userPrompt: `Chunk source type: ${source.sourceType}\nChunk text:\n${source.normalizedText}`,
    });
    insights.push(insight);
  }

  return insights;
}

export async function normalizeProfile(
  rawProfile: RawProfile,
  sources: SourceEvidence[],
  llmOptions?: { apiKey?: string; model: string; cacheDir: string; disabled: boolean }
) {
  const chunkInsights = await extractChunkInsights(sources, llmOptions);
  const llmSummary = chunkInsights.map((insight) => insight.summary).find(Boolean);
  const llmIndustries = uniqueStrings(chunkInsights.flatMap((insight) => insight.industries));
  const llmInterests = uniqueStrings(chunkInsights.flatMap((insight) => insight.interests));
  const llmPreferences = uniqueStrings(chunkInsights.flatMap((insight) => insight.preferences));
  const llmTechSkills = uniqueStrings(chunkInsights.flatMap((insight) => insight.technicalSkills));
  const llmSoftSkills = uniqueStrings(chunkInsights.flatMap((insight) => insight.softSkills));
  const llmAchievements = uniqueStrings(chunkInsights.flatMap((insight) => insight.achievements));

  const allEvidenceIds = sources.map((source) => source.sourceId);
  const skills = [
    ...createSkills(uniqueStrings([...rawProfile.technicalSkills, ...llmTechSkills]), 'technical', allEvidenceIds),
    ...createSkills(uniqueStrings([...rawProfile.softSkills, ...llmSoftSkills]), 'communication', allEvidenceIds),
  ];

  const achievements = mergeAchievements(rawProfile.achievements, llmAchievements, allEvidenceIds);
  const preferences = [
    PreferenceSchema.parse({
      id: createStableId('pref', 'preferred-output-language:en'),
      label: 'preferredOutputLanguage',
      value: 'en',
      evidenceIds: [],
    }),
    ...llmPreferences.map((value) =>
    PreferenceSchema.parse({
      id: createStableId('pref', value),
      label: value,
      value,
      evidenceIds: allEvidenceIds,
    })
    ),
  ];

  const normalized = UserProfileSchema.parse({
    id: 'default',
    fullName: rawProfile.nameCandidates[0],
    headline: rawProfile.headlineCandidates[0],
    summary: rawProfile.summaries[0] ?? llmSummary,
    sourceLanguages: inferSourceLanguages(sources),
    preferredOutputLanguage: 'en',
    contacts: normalizeContacts(rawProfile.contacts),
    experiences: rawProfile.experiences,
    education: rawProfile.education,
    projects: mergeProjects(rawProfile.projects),
    skills: mergeByName(skills),
    languages: mergeLanguages(rawProfile.languages),
    certifications: mergeCertifications(rawProfile.certifications),
    industries: uniqueStrings([...rawProfile.industries, ...llmIndustries]),
    interests: uniqueStrings([...rawProfile.interests, ...llmInterests]),
    achievements,
    preferences,
    recurringKeywords: rawProfile.recurringKeywords,
    evidence: sources,
    updatedAt: new Date().toISOString(),
  });

  return normalized;
}

function mergeAchievements(rawAchievements: Achievement[], llmAchievements: string[], evidenceIds: string[]) {
  const explicit = [...rawAchievements];
  for (const line of llmAchievements) {
    explicit.push(
      AchievementSchema.parse({
        id: createStableId('ach', line),
        text: line,
        evidenceIds,
      })
    );
  }

  const grouped = new Map<string, Achievement>();
  for (const item of explicit) {
    const key = item.text.toLowerCase();
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, item);
      continue;
    }

    grouped.set(key, {
      ...existing,
      evidenceIds: uniqueStrings([...existing.evidenceIds, ...item.evidenceIds]),
    });
  }

  return [...grouped.values()];
}

function mergeProjects(projects: Project[]) {
  const grouped = new Map<string, Project>();
  for (const project of projects) {
    const key = project.name.toLowerCase();
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, project);
      continue;
    }

    grouped.set(
      key,
      ProjectSchema.parse({
        ...existing,
        description: existing.description ?? project.description,
        technologies: uniqueStrings([...existing.technologies, ...project.technologies]),
        evidenceIds: uniqueStrings([...existing.evidenceIds, ...project.evidenceIds]),
      })
    );
  }
  return [...grouped.values()];
}

function mergeLanguages(languages: Language[]) {
  const grouped = new Map<string, Language>();
  for (const language of languages) {
    const key = language.name.toLowerCase();
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, language);
      continue;
    }

    grouped.set(key, {
      ...existing,
      level: existing.level ?? language.level,
      evidenceIds: uniqueStrings([...existing.evidenceIds, ...language.evidenceIds]),
    });
  }
  return [...grouped.values()];
}

function mergeCertifications(certifications: Certification[]) {
  const grouped = new Map<string, Certification>();
  for (const certification of certifications) {
    const key = certification.name.toLowerCase();
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, certification);
      continue;
    }

    grouped.set(key, {
      ...existing,
      issuer: existing.issuer ?? certification.issuer,
      issuedAt: existing.issuedAt ?? certification.issuedAt,
      evidenceIds: uniqueStrings([...existing.evidenceIds, ...certification.evidenceIds]),
    });
  }
  return [...grouped.values()];
}

export function buildProfileGaps(profile: UserProfile) {
  const questions: string[] = [];

  if (!profile.fullName) {
    questions.push('- Qual e il nome completo da usare nel CV?');
  }
  if (!profile.headline) {
    questions.push('- Qual e il titolo professionale piu adatto da mostrare in cima al CV?');
  }
  if (!profile.summary) {
    questions.push('- Vuoi aggiungere un sommario professionale di 3-4 righe?');
  }
  if (!profile.contacts.email) {
    questions.push('- Qual e l email di contatto da inserire?');
  }
  if (!profile.experiences.length) {
    questions.push('- Mancano esperienze lavorative strutturate: puoi fornire ruoli, aziende e date?');
  }
  if (!profile.skills.length) {
    questions.push('- Quali competenze tecniche o comunicative vuoi rendere esplicite?');
  }
  if (!profile.languages.length) {
    questions.push('- Quali lingue parli e con quale livello?');
  }
  if (!profile.achievements.length) {
    questions.push('- Hai risultati misurabili con numeri, percentuali o impatti concreti?');
  }
  if (!profile.preferences.length) {
    questions.push('- Hai preferenze di lavoro rilevanti, ad esempio remoto, leadership, mentoring o dominio?');
  }

  if (questions.length === 0) {
    return '# Profile Gaps\n\nNessun gap critico rilevato al momento.\n';
  }

  return `# Profile Gaps\n\n## Questions\n\n${questions.join('\n')}\n`;
}
