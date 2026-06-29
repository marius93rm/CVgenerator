import crypto from 'node:crypto';

export function createCacheKey(parts: Array<string | object>) {
  const hash = crypto.createHash('sha256');

  for (const part of parts) {
    hash.update(typeof part === 'string' ? part : JSON.stringify(part));
    hash.update('\n');
  }

  return hash.digest('hex');
}
