#!/usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };
import { loadConfig } from './config.js';
import { ensureWorkspaceStructure } from './storage/index.js';

function failNotImplemented(commandName: string) {
  console.error(chalk.yellow(`${commandName} is not implemented yet.`));
  process.exitCode = 1;
}

export function createProgram() {
  const program = new Command();

  program
    .name('cvgen')
    .description('Generate tailored PDF resumes from local profile evidence and job postings.')
    .version(packageJson.version)
    .showHelpAfterError();

  program
    .command('init')
    .description('Create local workspace folders if they do not exist.')
    .action(async () => {
      const config = loadConfig();
      await ensureWorkspaceStructure(config);
      console.log(chalk.green(`Workspace ready at ${path.resolve(config.rootDir)}`));
    });

  const profile = program.command('profile').description('Manage the local normalized user profile.');
  profile
    .command('ingest')
    .description('Ingest profile inputs from PDF, export files, or manual text.')
    .option('-f, --file <path>', 'Input file path')
    .option('-t, --text <text>', 'Manual input text')
    .action(() => failNotImplemented('cvgen profile ingest'));
  profile
    .command('show')
    .description('Show the normalized user profile.')
    .option('--json', 'Print raw JSON')
    .action(() => failNotImplemented('cvgen profile show'));

  const job = program.command('job').description('Import and analyze job postings.');
  job
    .command('import')
    .description('Import a job posting from public URL, file, or pasted text.')
    .option('-u, --url <url>', 'Public job posting URL')
    .option('-f, --file <path>', 'Input file path')
    .option('-t, --text <text>', 'Manual job posting text')
    .action(() => failNotImplemented('cvgen job import'));
  job
    .command('analyze')
    .description('Analyze an imported job posting.')
    .option('-j, --job <id>', 'Job posting ID')
    .action(() => failNotImplemented('cvgen job analyze'));

  program
    .command('match')
    .description('Select profile evidence relevant to a job posting.')
    .option('-p, --profile <id>', 'Profile ID')
    .option('-j, --job <id>', 'Job posting ID')
    .action(() => failNotImplemented('cvgen match'));

  program
    .command('render')
    .description('Render the final tailored CV to PDF.')
    .option('-t, --template <id>', 'Template ID')
    .option('-o, --output <path>', 'Output file path')
    .action(() => failNotImplemented('cvgen render'));

  program
    .command('tailor')
    .description('Run the end-to-end tailoring pipeline.')
    .option('-p, --profile <id>', 'Profile ID')
    .option('-j, --job <id>', 'Job posting ID')
    .option('-o, --output <path>', 'Output file path')
    .action(() => failNotImplemented('cvgen tailor'));

  return program;
}

async function main() {
  const program = createProgram();
  await program.parseAsync(process.argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
