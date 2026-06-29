import fs from 'fs-extra';
import type { AppConfig } from '../config.js';

export async function ensureWorkspaceStructure(config: AppConfig) {
  await fs.ensureDir(config.dataDir);
  await fs.ensureDir(config.inputsDir);
  await fs.ensureDir(config.outputsDir);
  await fs.ensureDir(config.templatesDir);
  await fs.ensureDir(config.originalTemplateDir);
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await fs.outputJson(filePath, value, { spaces: 2 });
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  return (await fs.readJson(filePath)) as T;
}

export async function writeJsonLines(filePath: string, values: unknown[]) {
  const content = values.map((value) => `${JSON.stringify(value)}\n`).join('');
  await fs.outputFile(filePath, content, 'utf8');
}

export async function readJsonLines<T>(filePath: string): Promise<T[]> {
  if (!(await fs.pathExists(filePath))) {
    return [];
  }

  const content = await fs.readFile(filePath, 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
