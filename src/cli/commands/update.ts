/**
 * BTW - Update Command
 * CLI command for updating workflows from their source
 */

import { Command } from 'commander';
import { workflowManager } from '../../core/workflow/WorkflowManager.js';
import { injectionEngine } from '../../core/injection/InjectionEngine.js';
import { stateManager } from '../../core/state/StateManager.js';
import { output } from '../utils/output.js';
import { BTWError } from '../../types/errors.js';
import { AITarget } from '../../types/index.js';
import ora from 'ora';

/**
 * Create the 'update' command
 */
export function createUpdateCommand(): Command {
  const command = new Command('update')
    .description('Update a workflow from its source repository')
    .argument('[workflow-id]', 'Workflow ID to update (updates all if not specified)')
    .option('-a, --all', 'Update all installed workflows')
    .option('--no-inject', 'Skip re-injecting after update')
    .option('-t, --target <target>', 'Target for re-injection (uses last injected target by default)')
    .action(async (workflowId: string | undefined, options: UpdateOptions) => {
      await executeUpdate(workflowId, options);
    });

  return command;
}

interface UpdateOptions {
  all?: boolean;
  inject: boolean;  // Note: --no-inject makes this false
  target?: string;
}

/**
 * Execute the update command
 * @param workflowId - Optional workflow ID to update
 * @param options - Command options
 */
async function executeUpdate(
  workflowId: string | undefined,
  options: UpdateOptions
): Promise<void> {
  try {
    // If --all flag or no workflow ID specified, update all workflows
    if (options.all || !workflowId) {
      await updateAllWorkflows(options);
    } else {
      await updateSingleWorkflow(workflowId, options);
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

/**
 * Update a single workflow
 * @param workflowId - Workflow ID to update
 * @param options - Update options
 */
async function updateSingleWorkflow(workflowId: string, options: UpdateOptions): Promise<void> {
  const spinner = ora(`Updating workflow '${workflowId}'...`).start();

  try {
    // Get workflow details before update to check if it was injected
    const beforeResult = await workflowManager.get(workflowId);
    const wasInjected = beforeResult.success && beforeResult.data?.state.lastInjectedAt;

    // Update the workflow
    const result = await workflowManager.update(workflowId);

    if (result.success && result.data) {
      spinner.succeed(`Workflow '${workflowId}' updated successfully`);
      output.keyValue('Version', result.data.version);
      if (result.data.contentHash) {
        output.keyValue('Commit', result.data.contentHash.substring(0, 7));
      }

      // Re-inject if enabled and workflow was previously injected
      if (options.inject && wasInjected) {
        await reinjectWorkflow(workflowId, options.target);
      }
    } else {
      spinner.fail(`Failed to update workflow '${workflowId}'`);
      output.error(result.error || 'Unknown error');
      process.exitCode = 1;
    }
  } catch (error) {
    spinner.fail(`Failed to update workflow '${workflowId}'`);
    throw error;
  }
}

/**
 * Update all installed workflows
 * @param options - Update options
 */
async function updateAllWorkflows(options: UpdateOptions): Promise<void> {
  // Get list of all workflows
  const listResult = await workflowManager.list({ detailed: true });

  if (!listResult.success || !listResult.data) {
    output.error(listResult.error || 'Failed to list workflows');
    process.exitCode = 1;
    return;
  }

  const workflows = listResult.data;

  if (workflows.length === 0) {
    output.info('No workflows installed');
    return;
  }

  output.info(`Updating ${workflows.length} workflow(s)...\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const workflowsToReinject: Array<{ id: string; target?: string }> = [];

  for (const workflow of workflows) {
    const workflowId = workflow.state.workflowId;
    const wasInjected = !!workflow.state.lastInjectedAt;
    const spinner = ora(`Updating '${workflowId}'...`).start();

    try {
      const result = await workflowManager.update(workflowId);

      if (result.success && result.data) {
        spinner.succeed(`'${workflowId}' updated to ${result.data.version}`);
        successCount++;

        // Track for re-injection if it was previously injected
        if (options.inject && wasInjected) {
          workflowsToReinject.push({ id: workflowId, target: options.target });
        }
      } else {
        // Check if it's a local workflow (can't be updated)
        if (result.error?.includes('local path')) {
          spinner.warn(`'${workflowId}' skipped (local workflow)`);
          skipCount++;
        } else {
          spinner.fail(`'${workflowId}' failed: ${result.error}`);
          failCount++;
        }
      }
    } catch (error) {
      spinner.fail(`'${workflowId}' failed: ${(error as Error).message}`);
      failCount++;
    }
  }

  // Re-inject updated workflows
  if (workflowsToReinject.length > 0) {
    output.newline();
    output.info(`Re-injecting ${workflowsToReinject.length} workflow(s)...\n`);

    for (const { id, target } of workflowsToReinject) {
      await reinjectWorkflow(id, target);
    }
  }

  // Summary
  output.newline();
  output.divider();

  if (successCount > 0) {
    output.success(`${successCount} workflow(s) updated`);
  }
  if (skipCount > 0) {
    output.info(`${skipCount} workflow(s) skipped`);
  }
  if (failCount > 0) {
    output.error(`${failCount} workflow(s) failed`);
    process.exitCode = 1;
  }
}

/**
 * Re-inject a workflow after update
 * @param workflowId - Workflow to inject
 * @param targetOverride - Optional target override
 */
async function reinjectWorkflow(workflowId: string, targetOverride?: string): Promise<void> {
  const spinner = ora(`Re-injecting '${workflowId}'...`).start();

  try {
    // Get workflow details
    const workflowResult = await workflowManager.get(workflowId);
    if (!workflowResult.success || !workflowResult.data?.manifest) {
      spinner.fail(`Failed to get workflow '${workflowId}'`);
      return;
    }

    const manifest = workflowResult.data.manifest;

    // Determine target
    let target: AITarget;
    if (targetOverride) {
      target = targetOverride as AITarget;
    } else {
      // Try to get from project state
      await stateManager.initialize();
      const projectPath = process.cwd();
      const activeTarget = stateManager.getActiveTarget(projectPath);

      if (activeTarget) {
        target = activeTarget;
      } else if (manifest.targets.length > 0) {
        // Use first supported target from manifest
        target = manifest.targets[0];
      } else {
        target = 'claude'; // Default fallback
      }
    }

    // Check if target is supported
    if (!injectionEngine.isTargetSupported(target)) {
      spinner.warn(`'${workflowId}' skipped (target '${target}' not supported)`);
      return;
    }

    // Check if manifest supports target
    if (!injectionEngine.validateManifestForTarget(manifest, target)) {
      spinner.warn(`'${workflowId}' skipped (doesn't support '${target}')`);
      return;
    }

    // Perform injection
    const result = await injectionEngine.inject(manifest, target, {
      projectRoot: process.cwd(),
      backup: true,
      force: true,  // Force to overwrite existing
      merge: false,
    });

    if (result.success && result.data) {
      spinner.succeed(`'${workflowId}' re-injected to ${target}`);
    } else {
      spinner.fail(`'${workflowId}' injection failed: ${result.error}`);
    }
  } catch (error) {
    spinner.fail(`'${workflowId}' injection failed: ${(error as Error).message}`);
  }
}

export default createUpdateCommand;
