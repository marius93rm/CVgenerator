import { z } from 'zod';

export const TailoredCVSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  jobPostingId: z.string().min(1),
  targetTitle: z.string().min(1),
  summary: z.string().optional(),
  selectedExperienceIds: z.array(z.string()).default([]),
  selectedSkillIds: z.array(z.string()).default([]),
  selectedProjectIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
});

export const RenderConfigSchema = z.object({
  templateId: z.string().default('cv-original'),
  outputPath: z.string().optional(),
  pageSize: z.enum(['A4', 'Letter']).default('A4'),
  locale: z.string().default('it-IT'),
});

export type TailoredCV = z.infer<typeof TailoredCVSchema>;
export type RenderConfig = z.infer<typeof RenderConfigSchema>;
