/**
 * BTW - List Command
 * CLI command for listing installed workflows
 */

import { Command } from 'commander';
import { workflowManager, ListWorkflowsOptions, WorkflowDetails } from '../../core/workflow/WorkflowManager.js';
import { output } from '../utils/output.js';
import { BTWError } from '../../types/errors.js';

/**
 * Create the 'list' command
 */
export function createListCommand(): Command {
  const command = new Command('list')
    .alias('ls')
    .description('List installed workflows')
    .option('-a, --active', 'Show only active workflows')
    .option('-d, --detailed', 'Show detailed information')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .option('--json', 'Output as JSON')
    .action(async (options: ListCommandOptions) => {
      await executeList(options);
    });

  return command;
}

/**
 * Command options
 */
interface ListCommandOptions {
  active?: boolean;
  detailed?: boolean;
  tags?: string;
  json?: boolean;
}

/**
 * Execute the list command
 * @param options - Command options
 */
async function executeList(options: ListCommandOptions): Promise<void> {
  // TODO: Implement list command execution
  // 1. Build list options
  // 2. Call workflowManager.list()
  // 3. Format and display results

  try {
    const listOptions: ListWorkflowsOptions = {
      activeOnly: options.active ?? false,
      detailed: options.detailed ?? false,
      tags: options.tags?.split(',').map((t) => t.trim()),
    };

    const result = await workflowManager.list(listOptions);

    if (!result.success) {
      output.error(result.error || 'Failed to list workflows');
      process.exitCode = 1;
      return;
    }

    const workflows = result.data || [];

    // JSON output
    if (options.json) {
      console.log(JSON.stringify(workflows, null, 2));
      return;
    }

    // No workflows found
    if (workflows.length === 0) {
      output.info('No workflows installed');
      output.log('');
      output.log(`Run ${output.formatCommand('btw add <source>')} to add a workflow`);
      return;
    }

    // Display workflows
    output.header('Installed Workflows');
    output.newline();

    if (options.detailed) {
      displayDetailedList(workflows);
    } else {
      displaySimpleList(workflows);
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
 * Display a simple list of workflows
 * @param workflows - Workflow details array
 */
function displaySimpleList(workflows: WorkflowDetails[]): void {
  const headers = ['ID', 'Version', 'Status', 'Installed'];
  const rows = workflows.map((w) => [
    w.state.workflowId,
    w.state.version,
    w.state.active ? 'active' : 'inactive',
    formatDate(w.state.installedAt),
  ]);

  output.table(headers, rows);
}

/**
 * Display a detailed list of workflows
 * @param workflows - Workflow details array
 */
function displayDetailedList(workflows: WorkflowDetails[]): void {
  for (const workflow of workflows) {
    output.divider();
    output.log(output.formatWorkflowId(workflow.state.workflowId));
    output.keyValue('Version', workflow.state.version);
    output.keyValue('Status', workflow.state.active ? 'active' : 'inactive');
    output.keyValue('Source', workflow.state.source);
    output.keyValue('Installed', formatDate(workflow.state.installedAt));

    if (workflow.state.lastInjectedAt) {
      output.keyValue('Last Injected', formatDate(workflow.state.lastInjectedAt));
    }

    if (workflow.manifest) {
      output.keyValue('Name', workflow.manifest.name);
      output.keyValue('Description', workflow.manifest.description);
      output.keyValue('Targets', workflow.manifest.targets.join(', '));
      output.keyValue('Agents', workflow.manifest.agents.length.toString());

      if (workflow.manifest.author) {
        output.keyValue('Author', workflow.manifest.author);
      }
    }

    output.newline();
  }
}

/**
 * Format a date string for display
 * @param dateStr - ISO date string
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch {
    return dateStr;
  }
}

export default createListCommand;
