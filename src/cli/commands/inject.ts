/**
 * BTW - Inject Command
 * CLI command for injecting workflows into AI tools
 */

import { Command } from 'commander';
import { injectionEngine } from '../../core/injection/InjectionEngine.js';
import { workflowManager } from '../../core/workflow/WorkflowManager.js';
import { AITarget } from '../../types/index.js';
import { output } from '../utils/output.js';
import { BTWError } from '../../types/errors.js';

/**
 * Create the 'inject' command
 */
export function createInjectCommand(): Command {
  const command = new Command('inject')
    .description('Inject a workflow into AI tool configuration')
    .argument('<workflow-id>', 'Workflow ID to inject')
    .option('-t, --target <target>', 'AI target (claude, cursor, windsurf, copilot)', 'claude')
    .option('-p, --project <path>', 'Project path (defaults to current directory)')
    .option('--no-backup', 'Skip creating backup of existing configuration')
    .option('-f, --force', 'Force injection even if config already exists')
    .option('--merge', 'Merge with existing configuration instead of replacing')
    .action(async (workflowId: string, options: InjectCommandOptions) => {
      await executeInject(workflowId, options);
    });

  return command;
}

/**
 * Command options
 */
interface InjectCommandOptions {
  target: string;
  project?: string;
  backup: boolean;
  force?: boolean;
  merge?: boolean;
}

/**
 * Execute the inject command
 * @param workflowId - Workflow ID to inject
 * @param options - Command options
 */
async function executeInject(
  workflowId: string,
  options: InjectCommandOptions
): Promise<void> {
  // TODO: Implement inject command execution
  // 1. Validate target
  // 2. Get workflow details
  // 3. Call injectionEngine.inject()
  // 4. Update state
  // 5. Display result

  const projectRoot = options.project || process.cwd();
  const target = options.target as AITarget;

  // Validate target
  const validTargets: AITarget[] = ['claude', 'cursor', 'windsurf', 'copilot'];
  if (!validTargets.includes(target)) {
    output.error(`Invalid target: ${options.target}`);
    output.log(`Valid targets: ${validTargets.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  // Check if target is supported
  if (!injectionEngine.isTargetSupported(target)) {
    output.error(`Target '${target}' is not yet supported`);
    process.exitCode = 1;
    return;
  }

  output.info(`Injecting workflow '${workflowId}' into ${target}...`);
  output.keyValue('Project', projectRoot);

  try {
    // Get workflow details
    const workflowResult = await workflowManager.get(workflowId);
    if (!workflowResult.success || !workflowResult.data?.manifest) {
      output.error(workflowResult.error || `Workflow '${workflowId}' not found`);
      process.exitCode = 1;
      return;
    }

    const manifest = workflowResult.data.manifest;

    // Check if manifest supports target
    if (!injectionEngine.validateManifestForTarget(manifest, target)) {
      output.error(`Workflow '${workflowId}' does not support target '${target}'`);
      output.log(`Supported targets: ${manifest.targets.join(', ')}`);
      process.exitCode = 1;
      return;
    }

    // Perform injection
    const result = await injectionEngine.inject(manifest, target, {
      projectRoot,
      backup: options.backup,
      force: options.force ?? false,
      merge: options.merge ?? false,
    });

    if (result.success && result.data) {
      output.success(`Workflow injected successfully`);
      output.keyValue('Config Path', result.data.configPath);
      output.keyValue('Agents Injected', result.data.agentCount.toString());

      if (result.data.backupCreated && result.data.backupPath) {
        output.keyValue('Backup', result.data.backupPath);
      }
    } else {
      output.error(result.error || 'Failed to inject workflow');
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

export default createInjectCommand;
