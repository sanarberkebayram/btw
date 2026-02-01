/**
 * BTW - Add Command
 * CLI command for adding workflows
 */

import { Command } from 'commander';
import { workflowManager, AddWorkflowOptions } from '../../core/workflow/WorkflowManager.js';
import { output } from '../utils/output.js';
import { BTWError } from '../../types/errors.js';

/**
 * Create the 'add' command
 */
export function createAddCommand(): Command {
  const command = new Command('add')
    .description('Add a workflow from a source')
    .argument('<source>', 'Workflow source (local path, git URL, or registry name)')
    .option('-f, --force', 'Force overwrite if workflow already exists')
    .option('--id <id>', 'Custom workflow ID (overrides manifest ID)')
    .action(async (source: string, options: { force?: boolean; id?: string }) => {
      await executeAdd(source, options);
    });

  return command;
}

/**
 * Execute the add command
 * @param source - Workflow source
 * @param options - Command options
 */
async function executeAdd(
  source: string,
  options: { force?: boolean; id?: string }
): Promise<void> {
  // TODO: Implement add command execution
  // 1. Parse source to determine type (local, git, registry)
  // 2. Call workflowManager.add()
  // 3. Display result to user

  output.info(`Adding workflow from: ${source}`);

  try {
    const addOptions: AddWorkflowOptions = {
      source,
      force: options.force ?? false,
      customId: options.id,
    };

    const result = await workflowManager.add(addOptions);

    if (result.success && result.data) {
      output.success(`Workflow '${result.data.workflowId}' added successfully`);
      output.keyValue('Version', result.data.version);
      output.keyValue('Source', result.data.source);
    } else {
      output.error(result.error || 'Failed to add workflow');
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

export default createAddCommand;
