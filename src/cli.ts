#!/usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };
import { loadConfig } from './config.js';
import { exportProfile, ingestProfile, loadNormalizedProfile, summarizeProfile } from './profile/index.js';
import { ensureWorkspaceStructure } from './storage/index.js';

function failNotImplemented(commandName: string) {
  console.error(chalk.yellow(`${commandName} is not implemented yet.`));
  process.exitCode = 1;
}

function collectValue(value: string, previous: string[]) {
  previous.push(value);
  return previous;
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
    .description('Ingest CV, LinkedIn export files, notes, and extra profile sources.')
    .option('--cv <path>', 'Path to a local CV PDF', collectValue, [])
    .option('--linkedin-pdf <path>', 'Path to a LinkedIn profile PDF saved by the user', collectValue, [])
    .option('--linkedin-export <path>', 'Path to a manually downloaded LinkedIn export ZIP', collectValue, [])
    .option('--notes <path>', 'Path to Markdown notes about the profile', collectValue, [])
    .option('--extra <path>', 'Path to any extra TXT/MD/PDF evidence file', collectValue, [])
    .option('--no-llm', 'Disable LLM normalization and run deterministic extraction only')
    .option('--force', 'Ignore content cache and reprocess every file')
    .action(async (options) => {
      const config = loadConfig();
      const result = await ingestProfile({
        config,
        cvPaths: options.cv,
        linkedinPdfPaths: options.linkedinPdf,
        linkedinExportPaths: options.linkedinExport,
        notesPaths: options.notes,
        extraPaths: options.extra,
        noLlm: !options.llm,
        force: options.force ?? false,
      });

      const llmMessage = result.llmEnabled
        ? 'LLM normalization enabled.'
        : 'LLM normalization disabled; raw extraction only plus deterministic normalization.';

      console.log(chalk.green(`Profile ingested from ${result.inputCount} input file(s).`));
      console.log(`Stored ${result.sourceCount} source evidence chunk(s).`);
      console.log(llmMessage);
      console.log(`Normalized profile: ${result.profilePaths.normalizedPath}`);
    });
  profile
    .command('show')
    .description('Show the normalized user profile.')
    .option('--json', 'Print raw JSON')
    .action(async (options) => {
      const config = loadConfig();
      const profileData = await loadNormalizedProfile(config);

      if (options.json) {
        console.log(JSON.stringify(profileData, null, 2));
        return;
      }

      console.log(JSON.stringify(summarizeProfile(profileData), null, 2));
    });
  profile
    .command('export')
    .description('Export the saved profile as JSON.')
    .option('-o, --output <path>', 'Write JSON to a file instead of stdout')
    .option('--raw', 'Export profile.raw.json instead of profile.normalized.json')
    .action(async (options) => {
      const config = loadConfig();
      const exported = await exportProfile(config, options.output, options.raw ? 'raw' : 'normalized');

      if (!options.output) {
        console.log(JSON.stringify(exported, null, 2));
        return;
      }

      console.log(chalk.green(`Profile exported to ${path.resolve(config.rootDir, options.output)}`));
    });

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
