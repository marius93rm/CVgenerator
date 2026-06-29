import { z } from 'zod';

export const SourceEvidenceSchema = z.object({
  id: z.string().min(1),
  sourceType: z.enum([
    'cv_pdf',
    'linkedin_pdf',
    'linkedin_export',
    'manual_text',
    'note',
    'job_posting',
  ]),
  sourceName: z.string().min(1),
  sourceRef: z.string().min(1),
  excerpt: z.string().min(1),
  confidence: z.number().min(0).max(1).default(1),
});

export const ExperienceSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  highlights: z.array(z.string()).default([]),
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
  category: z.string().optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  url: z.string().url().optional(),
  evidenceIds: z.array(z.string()).default([]),
});

export const UserProfileSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1),
  headline: z.string().optional(),
  summary: z.string().optional(),
  location: z.string().optional(),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  evidence: z.array(SourceEvidenceSchema).default([]),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;
