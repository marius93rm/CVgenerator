import { z } from 'zod';

export const JobPostingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  company: z.string().optional(),
  location: z.string().optional(),
  url: z.string().url().optional(),
  sourceType: z.enum(['url', 'file', 'text']),
  description: z.string().min(1),
  rawText: z.string().optional(),
});

export const JobAnalysisSchema = z.object({
  id: z.string().min(1),
  jobPostingId: z.string().min(1),
  mustHave: z.array(z.string()).default([]),
  niceToHave: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  summary: z.string().optional(),
});

export type JobPosting = z.infer<typeof JobPostingSchema>;
export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;
