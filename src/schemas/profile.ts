import { z } from 'zod';

export const SourceTypeSchema = z.enum([
  'cv_pdf',
  'linkedin_pdf',
  'linkedin_export',
  'notes',
  'extra',
]);

export const SourceEvidenceSchema = z.object({
  sourceId: z.string().min(1),
  sourceType: SourceTypeSchema,
  filePath: z.string().min(1),
  rawText: z.string().min(1),
  normalizedText: z.string().min(1),
  confidence: z.number().min(0).max(1).default(1),
  createdAt: z.string().datetime(),
  contentHash: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
});

export const ContactSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
});

export const ExperienceSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  id: z.string().min(1),
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const SkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['technical', 'communication', 'teaching', 'leadership', 'domain', 'other']),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url().optional(),
  technologies: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
});

export const LanguageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const CertificationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  issuer: z.string().optional(),
  issuedAt: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const AchievementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  metric: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const PreferenceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
});

export const RawProfileSchema = z.object({
  generatedAt: z.string().datetime(),
  llmEnabled: z.boolean(),
  sourceFiles: z.array(
    z.object({
      filePath: z.string(),
      sourceType: SourceTypeSchema,
      contentHash: z.string(),
      sourceIds: z.array(z.string()).default([]),
    })
  ),
  contacts: z.array(z.string()).default([]),
  summaries: z.array(z.string()).default([]),
  headlineCandidates: z.array(z.string()).default([]),
  nameCandidates: z.array(z.string()).default([]),
  experiences: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  technicalSkills: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  languages: z.array(LanguageSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  industries: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  achievements: z.array(AchievementSchema).default([]),
  recurringKeywords: z.array(z.string()).default([]),
});

export const UserProfileSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().optional(),
  headline: z.string().optional(),
  summary: z.string().optional(),
  sourceLanguages: z.array(z.string()).default([]),
  preferredOutputLanguage: z.string().default('en'),
  contacts: ContactSchema.default({}),
  experiences: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  industries: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  achievements: z.array(AchievementSchema).default([]),
  preferences: z.array(PreferenceSchema).default([]),
  recurringKeywords: z.array(z.string()).default([]),
  evidence: z.array(SourceEvidenceSchema).default([]),
  updatedAt: z.string().datetime(),
});

export type SourceType = z.infer<typeof SourceTypeSchema>;
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Achievement = z.infer<typeof AchievementSchema>;
export type Preference = z.infer<typeof PreferenceSchema>;
export type RawProfile = z.infer<typeof RawProfileSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
