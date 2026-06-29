import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'fs-extra';
import path from 'node:path';
import type { SourceType } from '../schemas/profile.js';
import { normalizeWhitespace } from './text.js';

const execFileAsync = promisify(execFile);

export type ImportedDocument = {
  filePath: string;
  sourceType: SourceType;
  logicalName: string;
  rawText: string;
  confidence: number;
};

async function parsePdf(filePath: string) {
  const buffer = await fs.readFile(filePath);

  try {
    const pdfParseModule = await import('pdf-parse');
    const parsePdfBuffer =
      (pdfParseModule as { default?: (input: Buffer) => Promise<{ text: string }> }).default ??
      (pdfParseModule as unknown as (input: Buffer) => Promise<{ text: string }>);
    const result = await parsePdfBuffer(buffer);
    return normalizeWhitespace(result.text);
  } catch {
    return normalizeWhitespace(buffer.toString('utf8'));
  }
}

async function parseTextFile(filePath: string) {
  return normalizeWhitespace(await fs.readFile(filePath, 'utf8'));
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function csvToText(content: string, logicalName: string) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return '';
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  const renderedRows = rows.map((row, rowIndex) => {
    const cells = headers
      .map((header, columnIndex) => {
        const value = row[columnIndex]?.trim();
        return value ? `${header}: ${value}` : undefined;
      })
      .filter(Boolean);
    return `${logicalName} row ${rowIndex + 1}\n${cells.join('\n')}`;
  });

  return normalizeWhitespace(renderedRows.join('\n\n'));
}

async function parseLinkedInZip(filePath: string) {
  const { stdout } = await execFileAsync('unzip', ['-Z1', filePath], {
    maxBuffer: 10 * 1024 * 1024,
  });
  const entries = stdout
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => /\.(csv|json|txt)$/i.test(entry));

  const documents: ImportedDocument[] = [];

  for (const entry of entries) {
    const { stdout: entryContent } = await execFileAsync('unzip', ['-p', filePath, entry], {
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
    });
    const logicalName = path.posix.basename(entry);
    const extension = path.extname(entry).toLowerCase();
    const text =
      extension === '.csv'
        ? csvToText(entryContent, logicalName)
        : extension === '.json'
          ? (() => {
              try {
                return normalizeWhitespace(JSON.stringify(JSON.parse(entryContent), null, 2));
              } catch {
                return normalizeWhitespace(entryContent);
              }
            })()
          : normalizeWhitespace(entryContent);

    if (!text) {
      continue;
    }

    documents.push({
      filePath: `${filePath}#${entry}`,
      sourceType: 'linkedin_export',
      logicalName,
      rawText: text,
      confidence: 0.9,
    });
  }

  return documents;
}

export async function parseInputFile(filePath: string, sourceType: SourceType) {
  if (sourceType === 'linkedin_export') {
    return parseLinkedInZip(filePath);
  }

  const extension = path.extname(filePath).toLowerCase();
  const rawText = extension === '.pdf' ? await parsePdf(filePath) : await parseTextFile(filePath);

  return [
    {
      filePath,
      sourceType,
      logicalName: path.basename(filePath),
      rawText,
      confidence: sourceType === 'notes' ? 0.95 : 0.9,
    },
  ] satisfies ImportedDocument[];
}
