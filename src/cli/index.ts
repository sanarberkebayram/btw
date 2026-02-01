#!/usr/bin/env node
/**
 * BTW - CLI Entry Point
 * Main entry point for the BTW command-line interface
 */

import { Command } from 'commander';
import { createAddCommand } from './commands/add.js';
import { createListCommand } from './commands/list.js';
import { createInjectCommand } from './commands/inject.js';
import { createRemoveCommand } from './commands/remove.js';
import { output } from './utils/output.js';

/**
 * BTW CLI version
 */
const VERSION = '0.1.0';

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

  // Add help examples
  program.addHelpText('after', `
Examples:
  $ btw add ./my-workflow           Add a local workflow
  $ btw add git@github.com:org/wf   Add a workflow from git
  $ btw list                        List installed workflows
  $ btw inject my-workflow          Inject workflow into Claude
  $ btw inject my-wf -t cursor      Inject into Cursor
  $ btw remove my-workflow          Remove a workflow

Documentation:
  https://github.com/btw-workflows/btw
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
