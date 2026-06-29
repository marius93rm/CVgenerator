import fs from 'fs-extra';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { ingestProfile, loadNormalizedProfile, loadRawProfile } from '../src/profile/index.js';
import { UserProfileSchema } from '../src/schemas/profile.js';

function createTempWorkspace() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'cvgenerator-profile-'));
  const inputsDir = path.join(cwd, 'inputs');
  fs.ensureDirSync(inputsDir);
  return { cwd, inputsDir };
}

describe('profile ingest', () => {
  it('builds the profile vault and writes output files', async () => {
    const { cwd, inputsDir } = createTempWorkspace();
    const cvPath = path.join(inputsDir, 'cv.pdf');
    const notesPath = path.join(inputsDir, 'profile.md');

    await fs.writeFile(
      cvPath,
      `Mario Rossi
Senior TypeScript Engineer
mario@example.com
https://www.linkedin.com/in/mariorossi

Summary
TypeScript engineer with 8 years of experience building product platforms.

Experience
Senior TypeScript Engineer at ACME
2021 - Present
- Increased conversion by 18%
- Built internal platform with TypeScript, Node, React

Education
MSc Computer Science
Politecnico di Milano

Skills
TypeScript, Node, React, Mentoring

Languages
Italian - Native
English - Professional
`,
      'utf8'
    );

    await fs.writeFile(
      notesPath,
      `# Profile Notes

- Interested in platform engineering and mentoring
- Enjoy teaching and technical writing
`,
      'utf8'
    );

    const result = await ingestProfile({
      config: loadConfig(cwd),
      cvPaths: [cvPath],
      linkedinPdfPaths: [],
      linkedinExportPaths: [],
      notesPaths: [notesPath],
      extraPaths: [],
      noLlm: true,
      force: false,
    });

    expect(result.llmEnabled).toBe(false);
    expect(result.sourceCount).toBeGreaterThan(0);
    expect(await fs.pathExists(path.join(cwd, 'data/profile/sources.jsonl'))).toBe(true);
    expect(await fs.pathExists(path.join(cwd, 'data/profile/profile.raw.json'))).toBe(true);
    expect(await fs.pathExists(path.join(cwd, 'data/profile/profile.normalized.json'))).toBe(true);
    expect(await fs.pathExists(path.join(cwd, 'data/profile/profile.gaps.md'))).toBe(true);

    const normalized = await loadNormalizedProfile(loadConfig(cwd));
    expect(normalized.fullName).toBe('Mario Rossi');
    expect(normalized.contacts.email).toBe('mario@example.com');
    expect(normalized.preferredOutputLanguage).toBe('en');
    expect(normalized.sourceLanguages).toContain('en');
    expect(normalized.skills.some((skill) => skill.name === 'TypeScript')).toBe(true);
    expect(normalized.languages.some((language) => language.name === 'Italian')).toBe(true);
  });

  it('deduplicates matching experiences coming from multiple sources', async () => {
    const { cwd, inputsDir } = createTempWorkspace();
    const cvPath = path.join(inputsDir, 'cv.pdf');
    const linkedinPdfPath = path.join(inputsDir, 'linkedin.pdf');

    const sharedExperience = `Senior TypeScript Engineer at ACME
2021 - Present
- Increased conversion by 18%
- Built internal platform with TypeScript, Node, React`;

    await fs.writeFile(
      cvPath,
      `Mario Rossi

Experience
${sharedExperience}
`,
      'utf8'
    );

    await fs.writeFile(
      linkedinPdfPath,
      `Mario Rossi

Experience
${sharedExperience}
`,
      'utf8'
    );

    await ingestProfile({
      config: loadConfig(cwd),
      cvPaths: [cvPath],
      linkedinPdfPaths: [linkedinPdfPath],
      linkedinExportPaths: [],
      notesPaths: [],
      extraPaths: [],
      noLlm: true,
      force: false,
    });

    const raw = await loadRawProfile(loadConfig(cwd));
    expect(raw.experiences).toHaveLength(1);
    expect(raw.experiences[0]?.company).toBe('ACME');
  });

  it('produces a normalized profile valid against the schema', async () => {
    const { cwd, inputsDir } = createTempWorkspace();
    const extraPath = path.join(inputsDir, 'extra.txt');

    await fs.writeFile(
      extraPath,
      `Lucia Bianchi
Engineering Manager
lucia@example.com

Summary
Engineering leader focused on mentoring and delivery.

Skills
Leadership, Communication, TypeScript, Node
`,
      'utf8'
    );

    await ingestProfile({
      config: loadConfig(cwd),
      cvPaths: [],
      linkedinPdfPaths: [],
      linkedinExportPaths: [],
      notesPaths: [],
      extraPaths: [extraPath],
      noLlm: true,
      force: false,
    });

    const normalized = await loadNormalizedProfile(loadConfig(cwd));
    expect(() => UserProfileSchema.parse(normalized)).not.toThrow();
    expect(normalized.preferences.some((preference) => preference.label === 'preferredOutputLanguage')).toBe(
      true
    );
  });
});
