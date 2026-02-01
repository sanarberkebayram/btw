/**
 * BTW - Uninstall Command
 * CLI command for completely uninstalling BTW and all workflows
 */

import { Command } from 'commander';
import { workflowManager } from '../../core/workflow/WorkflowManager.js';
import { injectionEngine } from '../../core/injection/InjectionEngine.js';
import { fileSystem } from '../../infrastructure/fs/FileSystem.js';
import { pathResolver } from '../../infrastructure/fs/PathResolver.js';
import { manifestParser } from '../../core/manifest/ManifestParser.js';
import { MANIFEST_FILENAME } from '../../infrastructure/config/constants.js';
import { output } from '../utils/output.js';
import { BTWError } from '../../types/errors.js';
import * as readline from 'readline';
import path from 'path';

/**
 * Create the 'uninstall' command
 */
export function createUninstallCommand(): Command {
  const command = new Command('uninstall')
    .description('Completely uninstall BTW and remove all workflows')
    .option('-p, --project <path>', 'Project path for ejecting workflows (defaults to current directory)')
    .option('-f, --force', 'Skip confirmation prompt')
    .option('--keep-config', 'Keep injected configurations in projects')
    .action(async (options: UninstallCommandOptions) => {
      await executeUninstall(options);
    });

  return command;
}

/**
 * Command options
 */
interface UninstallCommandOptions {
  project?: string;
  force?: boolean;
  keepConfig?: boolean;
}

/**
 * Prompt user for confirmation
 */
async function confirmUninstall(): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      '\nAre you sure you want to uninstall BTW and remove all workflows? [y/N] ',
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      }
    );
  });
}

/**
 * Get all installed workflow IDs
 */
async function getAllWorkflowIds(): Promise<string[]> {
  const workflowIds: string[] = [];
  const workflowsDir = pathResolver.getWorkflowsDir();

  const dirExists = await fileSystem.exists(workflowsDir);
  if (!dirExists) {
    return workflowIds;
  }

  const entries = await fileSystem.readdir(workflowsDir);

  for (const entry of entries) {
    if (!entry.isDirectory) {
      continue;
    }

    const manifestPath = path.join(entry.path, MANIFEST_FILENAME);
    const manifestExists = await fileSystem.exists(manifestPath);

    if (manifestExists) {
      try {
        const parsed = await manifestParser.parseFile(manifestPath);
        workflowIds.push(parsed.manifest.id);
      } catch {
        // Use directory name as fallback
        workflowIds.push(entry.name);
      }
    }
  }

  return workflowIds;
}

/**
 * Execute the uninstall command
 */
async function executeUninstall(options: UninstallCommandOptions): Promise<void> {
  const projectRoot = options.project || process.cwd();
  const btwHome = pathResolver.getBtwHome();

  output.header('BTW Uninstall');
  output.newline();

  try {
    // Check if BTW home exists
    const btwHomeExists = await fileSystem.exists(btwHome);
    if (!btwHomeExists) {
      output.info('BTW is not installed (no ~/.btw directory found)');
      return;
    }

    // Get all installed workflows
    const workflowIds = await getAllWorkflowIds();

    output.warn('This will:');
    if (workflowIds.length > 0) {
      output.log(`  - Remove ${workflowIds.length} installed workflow(s)`);
      for (const id of workflowIds) {
        output.log(`    - ${id}`);
      }
    }
    if (!options.keepConfig) {
      output.log('  - Eject all workflows from the current project');
    }
    output.log(`  - Delete the BTW home directory (${btwHome})`);
    output.newline();

    // Confirm unless --force
    if (!options.force) {
      const confirmed = await confirmUninstall();
      if (!confirmed) {
        output.info('Uninstall cancelled');
        return;
      }
    }

    output.newline();

    // Step 1: Eject all workflows from the current project
    if (!options.keepConfig) {
      output.info('Ejecting workflows from project...');
      try {
        await injectionEngine.ejectAll(projectRoot, {
          clean: true,
          restoreBackup: false,
        });
        output.success('Workflows ejected from project');
      } catch (error) {
        output.warn(`Could not eject workflows: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Step 2: Remove each workflow
    if (workflowIds.length > 0) {
      output.info('Removing workflows...');
      for (const workflowId of workflowIds) {
        try {
          await workflowManager.remove({
            workflowId,
            purge: true,
            force: true,
          });
          output.success(`Removed workflow: ${workflowId}`);
        } catch (error) {
          output.warn(`Could not remove ${workflowId}: ${error instanceof Error ? error.message : error}`);
        }
      }
    }

    // Step 3: Remove BTW home directory
    output.info('Removing BTW home directory...');
    try {
      await fileSystem.remove(btwHome, true);
      output.success(`Removed ${btwHome}`);
    } catch (error) {
      output.error(`Failed to remove BTW home: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
      return;
    }

    output.newline();
    output.success('BTW has been completely uninstalled');
    output.newline();
    output.info('To reinstall BTW, run: npm install -g @sanarberkebayram/btw');

  } catch (error) {
    if (BTWError.isBTWError(error)) {
      output.formatError(error);
    } else {
      output.error(`Unexpected error: ${error}`);
    }
    process.exitCode = 1;
  }
}

export default createUninstallCommand;
