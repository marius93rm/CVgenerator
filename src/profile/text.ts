import crypto from 'node:crypto';

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'have',
  'has',
  'was',
  'were',
  'your',
  'you',
  'about',
  'into',
  'using',
  'used',
  'sono',
  'della',
  'delle',
  'degli',
  'dello',
  'dalla',
  'dalle',
  'dati',
  'esperienza',
  'esperienze',
  'skills',
  'skill',
  'curriculum',
  'resume',
  'professional',
  'professionale',
  'anni',
  'year',
  'years',
  'team',
  'work',
  'lavoro',
  'project',
  'projects',
]);

export function hashContent(value: string | Buffer) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function normalizeWhitespace(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createStableId(prefix: string, seed: string) {
  return `${prefix}_${hashContent(seed).slice(0, 12)}`;
}

export function splitIntoChunks(text: string, maxChars = 2200, minChars = 1500) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current.length >= minChars) {
      chunks.push(current);
      current = paragraph;
      continue;
    }

    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const sentenceCandidate = current ? `${current} ${sentence}` : sentence;
      if (sentenceCandidate.length > maxChars && current) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current = sentenceCandidate;
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function recurringKeywordsFromTexts(texts: string[], limit = 20) {
  const counts = new Map<string, number>();

  for (const text of texts) {
    const tokens = text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? [];
    for (const token of tokens) {
      if (STOPWORDS.has(token)) {
        continue;
      }
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}
