import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config({ quiet: true });

const AppConfigSchema = z.object({
  rootDir: z.string(),
  dataDir: z.string(),
  inputsDir: z.string(),
  outputsDir: z.string(),
  templatesDir: z.string(),
  originalTemplateDir: z.string(),
  openaiApiKey: z.string().trim().min(1).optional(),
  openaiModel: z.string().trim().min(1),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function loadConfig(cwd = process.cwd()): AppConfig {
  const rootDir = path.resolve(cwd);
  const dataDir = path.resolve(rootDir, process.env.CVGEN_DATA_DIR ?? 'data');
  const inputsDir = path.resolve(rootDir, process.env.CVGEN_INPUTS_DIR ?? 'inputs');
  const outputsDir = path.resolve(rootDir, process.env.CVGEN_OUTPUTS_DIR ?? 'outputs');
  const templatesDir = path.resolve(rootDir, process.env.CVGEN_TEMPLATE_DIR ?? 'templates');
  const originalTemplateDir = path.resolve(templatesDir, 'cv-original');

  return AppConfigSchema.parse({
    rootDir,
    dataDir,
    inputsDir,
    outputsDir,
    templatesDir,
    originalTemplateDir,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  });
}
