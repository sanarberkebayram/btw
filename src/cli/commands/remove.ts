/**
 * BTW - Remove Command
 * CLI command for removing workflows
 */

import { Command } from 'commander';
import { workflowManager, RemoveWorkflowOptions } from '../../core/workflow/WorkflowManager.js';
import { injectionEngine } from '../../core/injection/InjectionEngine.js';
import { output } from '../utils/output.js';
import { BTWError } from '../../types/errors.js';

/**
 * Create the 'remove' command
 */
export function createRemoveCommand(): Command {
  const command = new Command('remove')
    .alias('rm')
    .description('Remove an installed workflow')
    .argument('<workflow-id>', 'Workflow ID to remove')
    .option('-p, --project <path>', 'Project path (defaults to current directory)')
    .option('--purge', 'Remove all traces including backups')
    .option('-f, --force', 'Skip confirmation prompts')
    .option('--keep-injection', 'Keep injected configuration (do not eject)')
    .action(async (workflowId: string, options: RemoveCommandOptions) => {
      await executeRemove(workflowId, options);
    });

  return command;
}

/**
 * Command options
 */
interface RemoveCommandOptions {
  project?: string;
  purge?: boolean;
  force?: boolean;
  keepInjection?: boolean;
}

/**
 * Execute the remove command
 * @param workflowId - Workflow ID to remove
 * @param options - Command options
 */
async function executeRemove(
  workflowId: string,
  options: RemoveCommandOptions
): Promise<void> {
  // TODO: Implement remove command execution
  // 1. Check if workflow is installed
  // 2. Optionally prompt for confirmation
  // 3. Eject from AI tools if injected (unless --keep-injection)
  // 4. Call workflowManager.remove()
  // 5. Display result

  const projectRoot = options.project || process.cwd();

  output.info(`Removing workflow '${workflowId}'...`);

  try {
    // Check if workflow exists
    const isInstalled = await workflowManager.isInstalled(workflowId);
    if (!isInstalled) {
      output.error(`Workflow '${workflowId}' is not installed`);
      process.exitCode = 1;
      return;
    }

    // Confirmation prompt (if not forced)
    if (!options.force) {
      // TODO: Implement interactive confirmation
      // For now, we'll proceed without confirmation
      output.warn('Use --force to skip confirmation (not yet implemented)');
    }

    // Eject from AI tools if not keeping injection
    if (!options.keepInjection) {
      output.info('Ejecting workflow from AI tools...');

      try {
        await injectionEngine.ejectAll(projectRoot, {
          restoreBackup: !options.purge,
          clean: options.purge ?? false,
        });
        output.success('Workflow ejected from AI tools');
      } catch (ejectError) {
        // Log but continue with removal
        output.warn(`Failed to eject workflow: ${ejectError}`);
      }
    }

    // Remove workflow
    const removeOptions: RemoveWorkflowOptions = {
      workflowId,
      purge: options.purge ?? false,
      force: options.force ?? false,
    };

    const result = await workflowManager.remove(removeOptions);

    if (result.success) {
      output.success(`Workflow '${workflowId}' removed successfully`);

      if (options.purge) {
        output.info('All traces including backups have been removed');
      }
    } else {
      output.error(result.error || 'Failed to remove workflow');
      process.exitCode = 1;
    }
  } catch (error) {
    if (BTWError.isBTWError(error)) {
      output.formatError(error);
    } else {
      output.error(`Unexpected error: ${error}`);
    }
    process.exitCode = 1;
  }
}

export default createRemoveCommand;
