import crypto from 'node:crypto';
import fs from 'fs-extra';
import OpenAI from 'openai';
import path from 'node:path';
import { z } from 'zod';

export function createCacheKey(parts: Array<string | object>) {
  const hash = crypto.createHash('sha256');

  for (const part of parts) {
    hash.update(typeof part === 'string' ? part : JSON.stringify(part));
    hash.update('\n');
  }

  return hash.digest('hex');
}

export function isLlmAvailable(apiKey?: string) {
  return Boolean(apiKey?.trim());
}

type StructuredJsonOptions<TSchema extends z.ZodTypeAny> = {
  apiKey: string;
  model: string;
  schema: TSchema;
  systemPrompt: string;
  userPrompt: string;
  cacheDir?: string;
  cacheKey?: string;
};

export async function generateStructuredJson<TSchema extends z.ZodTypeAny>(
  options: StructuredJsonOptions<TSchema>
): Promise<z.infer<TSchema>> {
  const cachePath =
    options.cacheDir && options.cacheKey
      ? path.join(options.cacheDir, `${options.cacheKey}.json`)
      : undefined;

  if (cachePath && (await fs.pathExists(cachePath))) {
    const cached = await fs.readJson(cachePath);
    return options.schema.parse(cached);
  }

  const client = new OpenAI({ apiKey: options.apiKey });
  const completion = await client.chat.completions.create({
    model: options.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty content.');
  }

  const parsed = options.schema.parse(JSON.parse(content));

  if (cachePath) {
    await fs.ensureDir(path.dirname(cachePath));
    await fs.writeJson(cachePath, parsed, { spaces: 2 });
  }

  return parsed;
}
