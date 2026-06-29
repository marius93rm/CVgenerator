import fs from 'fs-extra';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProgram } from '../src/cli.js';
import { loadConfig } from '../src/config.js';
import { ensureWorkspaceStructure } from '../src/storage/index.js';

describe('cvgen', () => {
  it('exposes the expected top-level commands', () => {
    const program = createProgram();
    const names = program.commands.map((command) => command.name());

    expect(names).toEqual(
      expect.arrayContaining(['init', 'profile', 'job', 'match', 'render', 'tailor'])
    );
  });

  it('creates the workspace directories', async () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'cvgenerator-'));
    const config = loadConfig(cwd);

    await ensureWorkspaceStructure(config);

    expect(await fs.pathExists(config.dataDir)).toBe(true);
    expect(await fs.pathExists(config.inputsDir)).toBe(true);
    expect(await fs.pathExists(config.outputsDir)).toBe(true);
    expect(await fs.pathExists(config.originalTemplateDir)).toBe(true);
  });
});
