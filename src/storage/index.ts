import fs from 'fs-extra';
import type { AppConfig } from '../config.js';

export async function ensureWorkspaceStructure(config: AppConfig) {
  await fs.ensureDir(config.dataDir);
  await fs.ensureDir(config.inputsDir);
  await fs.ensureDir(config.outputsDir);
  await fs.ensureDir(config.templatesDir);
  await fs.ensureDir(config.originalTemplateDir);
}
