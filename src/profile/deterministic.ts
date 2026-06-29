import {
  AchievementSchema,
  CertificationSchema,
  EducationSchema,
  ExperienceSchema,
  LanguageSchema,
  ProjectSchema,
  type Achievement,
  type Certification,
  type Education,
  type Experience,
  type Language,
  type Project,
  type SourceEvidence,
} from '../schemas/profile.js';
import { createStableId, normalizeWhitespace, recurringKeywordsFromTexts, slugify, uniqueStrings } from './text.js';

const SECTION_HEADINGS: Record<string, RegExp> = {
  summary: /^(summary|profile|about|professional summary|profilo|riassunto)$/i,
  experience:
    /^(experience|professional experience|work experience|employment|career history|esperienza|esperienze professionali)$/i,
  education: /^(education|studies|formazione|istruzione)$/i,
  skills: /^(skills|technical skills|competenze|tecnologie)$/i,
  projects: /^(projects|project experience|progetti)$/i,
  languages: /^(languages|lingue)$/i,
  certifications: /^(certifications|licenses|certificazioni)$/i,
  interests: /^(interests|professional interests|interessi)$/i,
};

const SOFT_SKILL_KEYWORDS = [
  'communication',
  'mentoring',
  'teaching',
  'presentation',
  'leadership',
  'collaboration',
  'facilitation',
  'stakeholder',
  'coaching',
  'training',
  'public speaking',
  'writing',
];

const TECH_KEYWORDS = [
  ['typescript', 'TypeScript'],
  ['javascript', 'JavaScript'],
  ['node', 'Node'],
  ['react', 'React'],
  ['next', 'Next.js'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['aws', 'AWS'],
  ['gcp', 'GCP'],
  ['azure', 'Azure'],
  ['docker', 'Docker'],
  ['kubernetes', 'Kubernetes'],
  ['postgres', 'Postgres'],
  ['sql', 'SQL'],
  ['graphql', 'GraphQL'],
  ['rest', 'REST'],
  ['playwright', 'Playwright'],
  ['vitest', 'Vitest'],
  ['redis', 'Redis'],
  ['linux', 'Linux'],
  ['html', 'HTML'],
  ['css', 'CSS'],
] as const;

function isHeading(line: string) {
  const trimmed = line.trim().replace(/:$/, '');
  return Object.values(SECTION_HEADINGS).some((pattern) => pattern.test(trimmed));
}

function getSectionText(text: string, sectionKey: keyof typeof SECTION_HEADINGS) {
  const lines = text.split('\n').map((line) => line.trim());
  const blocks: string[] = [];
  let collecting = false;

  for (const line of lines) {
    if (!line) {
      if (collecting) {
        blocks.push('');
      }
      continue;
    }

    if (SECTION_HEADINGS[sectionKey].test(line.replace(/:$/, ''))) {
      collecting = true;
      continue;
    }

    if (collecting && isHeading(line)) {
      break;
    }

    if (collecting) {
      blocks.push(line);
    }
  }

  return normalizeWhitespace(blocks.join('\n'));
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0];
}

function extractPhone(text: string) {
  return text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,5}\d{2,4}/)?.[0]?.trim();
}

function extractUrl(text: string, keyword?: string) {
  const urls = text.match(/https?:\/\/[^\s)]+/gi) ?? [];
  if (!keyword) {
    return urls[0];
  }

  return urls.find((url) => url.toLowerCase().includes(keyword));
}

function likelyNameCandidates(text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  return lines.filter((line) => /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line));
}

function likelyHeadlineCandidates(text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);

  return lines.filter(
    (line) =>
      line.length > 12 &&
      line.length < 100 &&
      !/@/.test(line) &&
      !/^https?:\/\//i.test(line) &&
      !/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line)
  );
}

function parseBullets(text: string) {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}

function extractDelimitedList(sectionText: string) {
  return uniqueStrings(
    sectionText
      .split(/[\n,|;]/)
      .map((item) => item.replace(/^[-*•]\s*/, '').trim())
      .filter((item) => item.length > 1)
  );
}

function extractLanguages(sectionText: string, evidenceId: string): Language[] {
  return extractDelimitedList(sectionText).map((item) => {
    const [name, level] = item.split(/[-:()]/).map((part) => part.trim());
    return LanguageSchema.parse({
      id: createStableId('lang', `${item}-${evidenceId}`),
      name,
      level: level && level !== name ? level : undefined,
      evidenceIds: [evidenceId],
    });
  });
}

function extractCertifications(sectionText: string, evidenceId: string): Certification[] {
  return extractDelimitedList(sectionText).map((item) =>
    CertificationSchema.parse({
      id: createStableId('cert', `${item}-${evidenceId}`),
      name: item,
      evidenceIds: [evidenceId],
    })
  );
}

function extractProjects(sectionText: string, evidenceId: string): Project[] {
  const blocks = sectionText.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks.slice(0, 12).map((block) => {
    const lines = block.split('\n').filter(Boolean);
    const name = lines[0]?.replace(/^[-*•]\s*/, '').trim() || 'Untitled project';
    return ProjectSchema.parse({
      id: createStableId('proj', `${name}-${evidenceId}`),
      name,
      description: lines.slice(1).join(' ').trim() || undefined,
      technologies: TECH_KEYWORDS.filter(([keyword]) => block.toLowerCase().includes(keyword)).map(
        ([, canonical]) => canonical
      ),
      evidenceIds: [evidenceId],
    });
  });
}

function extractEducation(sectionText: string, evidenceId: string): Education[] {
  const blocks = sectionText.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks.slice(0, 12).map((block) => {
    const lines = block.split('\n').filter(Boolean);
    const firstLine = lines[0] ?? '';
    const secondLine = lines[1] ?? '';
    return EducationSchema.parse({
      id: createStableId('edu', `${firstLine}-${secondLine}-${evidenceId}`),
      institution: secondLine || firstLine,
      degree: firstLine,
      evidenceIds: [evidenceId],
    });
  });
}

function extractExperienceBlocks(sectionText: string) {
  const blocks = sectionText.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks.flatMap((block) => {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length === 0) {
      return [];
    }
    return [lines];
  });
}

function parseRoleCompany(line: string) {
  const separators = [' at ', ' @ ', ' | ', ' - '];
  for (const separator of separators) {
    if (line.includes(separator)) {
      const [left, right] = line.split(separator, 2).map((part) => part.trim());
      if (left && right) {
        return { role: left, company: right };
      }
    }
  }
  return { role: line.trim(), company: 'Unknown company' };
}

function extractExperiences(sectionText: string, evidenceId: string): Experience[] {
  return extractExperienceBlocks(sectionText).slice(0, 20).map((lines) => {
    const [titleLine, dateLine, ...rest] = lines;
    const { role, company } = parseRoleCompany(titleLine);
    const highlights = parseBullets(rest.join('\n')).slice(0, 8);
    const achievements = highlights.filter((item) => /\d|%|\$|€|£/.test(item));

    return ExperienceSchema.parse({
      id: createStableId('exp', `${titleLine}-${dateLine}-${evidenceId}`),
      company,
      role,
      startDate: dateLine?.match(/\b(19|20)\d{2}\b/)?.[0],
      endDate: dateLine?.match(/\b(19|20)\d{2}\b/g)?.[1],
      summary: rest[0]?.trim(),
      highlights,
      technologies: TECH_KEYWORDS.filter(([keyword]) =>
        lines.join(' ').toLowerCase().includes(keyword)
      ).map(([, canonical]) => canonical),
      achievements,
      evidenceIds: [evidenceId],
    });
  });
}

function extractAchievements(text: string, evidenceId: string): Achievement[] {
  const lines = parseBullets(text);
  return lines
    .filter((line) => /\d|%|\$|€|£/.test(line))
    .slice(0, 20)
    .map((line) =>
      AchievementSchema.parse({
        id: createStableId('ach', `${line}-${evidenceId}`),
        text: line,
        metric: line.match(/(\d[\d.,]*\s?[%kKmM]?|\$\s?\d[\d.,]*|€\s?\d[\d.,]*)/)?.[0],
        evidenceIds: [evidenceId],
      })
    );
}

function inferIndustries(text: string) {
  const candidates = [
    'fintech',
    'healthcare',
    'education',
    'e-commerce',
    'saas',
    'consulting',
    'media',
    'public sector',
  ];
  return candidates.filter((candidate) => text.toLowerCase().includes(candidate));
}

function inferInterests(sectionText: string) {
  return extractDelimitedList(sectionText).slice(0, 20);
}

function inferTechnicalSkills(text: string) {
  return TECH_KEYWORDS.filter(([keyword]) => text.toLowerCase().includes(keyword)).map(
    ([, canonical]) => canonical
  );
}

function inferSoftSkills(text: string) {
  return SOFT_SKILL_KEYWORDS.filter((keyword) => text.toLowerCase().includes(keyword));
}

export type DeterministicExtraction = {
  contacts: string[];
  nameCandidates: string[];
  headlineCandidates: string[];
  summaries: string[];
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  technicalSkills: string[];
  softSkills: string[];
  languages: Language[];
  certifications: Certification[];
  industries: string[];
  interests: string[];
  achievements: Achievement[];
  recurringKeywords: string[];
};

export function extractDeterministicProfile(sources: SourceEvidence[]): DeterministicExtraction {
  const contacts: string[] = [];
  const nameCandidates: string[] = [];
  const headlineCandidates: string[] = [];
  const summaries: string[] = [];
  const experiences: Experience[] = [];
  const education: Education[] = [];
  const projects: Project[] = [];
  const technicalSkills: string[] = [];
  const softSkills: string[] = [];
  const languages: Language[] = [];
  const certifications: Certification[] = [];
  const industries: string[] = [];
  const interests: string[] = [];
  const achievements: Achievement[] = [];

  for (const source of sources) {
    const text = source.normalizedText;
    const summarySection = getSectionText(text, 'summary');
    const experienceSection = getSectionText(text, 'experience');
    const educationSection = getSectionText(text, 'education');
    const skillsSection = getSectionText(text, 'skills');
    const projectsSection = getSectionText(text, 'projects');
    const languagesSection = getSectionText(text, 'languages');
    const certificationsSection = getSectionText(text, 'certifications');
    const interestsSection = getSectionText(text, 'interests');

    const email = extractEmail(text);
    const phone = extractPhone(text);
    const linkedinUrl = extractUrl(text, 'linkedin');
    const githubUrl = extractUrl(text, 'github');
    const websiteUrl = extractUrl(text);

    contacts.push(...[email, phone, linkedinUrl, githubUrl, websiteUrl].filter(Boolean) as string[]);
    nameCandidates.push(...likelyNameCandidates(text));
    headlineCandidates.push(...likelyHeadlineCandidates(text));
    if (summarySection) {
      summaries.push(summarySection);
    }
    experiences.push(...extractExperiences(experienceSection, source.sourceId));
    education.push(...extractEducation(educationSection, source.sourceId));
    projects.push(...extractProjects(projectsSection, source.sourceId));
    technicalSkills.push(...inferTechnicalSkills(`${skillsSection}\n${text}`));
    softSkills.push(...inferSoftSkills(`${skillsSection}\n${text}`));
    languages.push(...extractLanguages(languagesSection, source.sourceId));
    certifications.push(...extractCertifications(certificationsSection, source.sourceId));
    industries.push(...inferIndustries(text));
    interests.push(...inferInterests(interestsSection));
    achievements.push(...extractAchievements(text, source.sourceId));
  }

  return {
    contacts: uniqueStrings(contacts),
    nameCandidates: uniqueStrings(nameCandidates),
    headlineCandidates: uniqueStrings(headlineCandidates),
    summaries: uniqueStrings(summaries),
    experiences,
    education,
    projects,
    technicalSkills: uniqueStrings(technicalSkills),
    softSkills: uniqueStrings(softSkills),
    languages,
    certifications,
    industries: uniqueStrings(industries),
    interests: uniqueStrings(interests),
    achievements,
    recurringKeywords: recurringKeywordsFromTexts(sources.map((source) => source.normalizedText)),
  };
}

function normalizedExperienceKey(experience: Experience) {
  return `${slugify(experience.role)}::${slugify(experience.company)}::${experience.startDate ?? ''}`;
}

export function dedupeExperiences(experiences: Experience[]) {
  const grouped = new Map<string, Experience>();

  for (const experience of experiences) {
    const key = normalizedExperienceKey(experience);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, experience);
      continue;
    }

    grouped.set(
      key,
      ExperienceSchema.parse({
        ...existing,
        endDate: existing.endDate ?? experience.endDate,
        summary: existing.summary ?? experience.summary,
        highlights: uniqueStrings([...existing.highlights, ...experience.highlights]),
        technologies: uniqueStrings([...existing.technologies, ...experience.technologies]),
        achievements: uniqueStrings([...existing.achievements, ...experience.achievements]),
        evidenceIds: uniqueStrings([...existing.evidenceIds, ...experience.evidenceIds]),
      })
    );
  }

  return [...grouped.values()];
}
