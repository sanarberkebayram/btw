#!/usr/bin/env node
/**
 * BTW - CLI Entry Point
 * Main entry point for the BTW command-line interface
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createAddCommand } from './commands/add.js';
import { createListCommand } from './commands/list.js';
import { createInjectCommand } from './commands/inject.js';
import { createRemoveCommand } from './commands/remove.js';
import { createUpdateCommand } from './commands/update.js';
import { createUninstallCommand } from './commands/uninstall.js';
import { output } from './utils/output.js';
import { checkForUpdates } from './utils/updateChecker.js';

/**
 * BTW CLI version - read from package.json to stay in sync
 */
function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Try multiple paths to find package.json (works in both src and dist)
    const paths = [
      join(__dirname, '..', 'package.json'),      // from dist/index.js
      join(__dirname, '..', '..', 'package.json'), // from src/cli/index.ts
    ];
    for (const pkgPath of paths) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.version) return pkg.version;
      } catch {
        continue;
      }
    }
  } catch {
    // Fallback
  }
  return '0.0.0';
}

const VERSION = getVersion();

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('btw')
    .version(VERSION)
    .description('BTW - AI Workflow Injection Tool\n\nManage and inject AI workflows into your development environment.');

  // Global options
  program
    .option('-v, --verbose', 'Enable verbose output')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('--no-color', 'Disable colored output');

  // Register commands
  program.addCommand(createAddCommand());
  program.addCommand(createListCommand());
  program.addCommand(createInjectCommand());
  program.addCommand(createRemoveCommand());
  program.addCommand(createUpdateCommand());
  program.addCommand(createUninstallCommand());

  // Add help examples
  program.addHelpText('after', `
Examples:
  $ btw add ./my-workflow           Add a local workflow
  $ btw add git@github.com:org/wf   Add a workflow from git
  $ btw list                        List installed workflows
  $ btw inject my-workflow          Inject workflow into Claude
  $ btw inject -i                   Interactive inject mode
  $ btw inject my-wf -t cursor      Inject into Cursor
  $ btw update my-workflow          Update a workflow from source
  $ btw update --all                Update all workflows
  $ btw remove my-workflow          Remove a workflow
  $ btw uninstall                   Uninstall BTW and all workflows

Documentation:
  https://github.com/sanarberkebayram/btw
`);

  // Error handling
  program.exitOverride((err) => {
    if (err.code === 'commander.help' || err.code === 'commander.helpDisplayed') {
      process.exit(0);
    }
    if (err.code === 'commander.version') {
      process.exit(0);
    }
    throw err;
  });

  return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Check for updates before running commands
  await checkForUpdates(VERSION);

  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    // Handle unhandled errors
    if (error instanceof Error) {
      output.error(error.message);
      if (process.env.BTW_DEBUG) {
        console.error(error.stack);
      }
    } else {
      output.error('An unexpected error occurred');
    }
    process.exitCode = 1;
  }
}

// Run CLI
main();

// Export for testing
export { createProgram, VERSION };
