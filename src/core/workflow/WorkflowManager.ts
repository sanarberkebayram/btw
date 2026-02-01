/**
 * BTW - Workflow Manager
 * Core service for managing workflow lifecycle
 */

import { Manifest, WorkflowState, OperationResult } from '../../types/index.js';
import { BTWError, ErrorCode } from '../../types/errors.js';
import { gitClient } from '../../infrastructure/git/GitClient.js';
import { manifestParser } from '../manifest/ManifestParser.js';
import { stateManager } from '../state/StateManager.js';
import { fileSystem } from '../../infrastructure/fs/FileSystem.js';
import { pathResolver } from '../../infrastructure/fs/PathResolver.js';
import { MANIFEST_FILENAME } from '../../infrastructure/config/constants.js';
import path from 'path';

/**
 * Options for adding a workflow
 */
export interface AddWorkflowOptions {
  /** Source path or URL of the workflow */
  source: string;
  /** Force overwrite if workflow already exists */
  force?: boolean;
  /** Custom workflow ID (overrides manifest ID) */
  customId?: string;
}

/**
 * Options for listing workflows
 */
export interface ListWorkflowsOptions {
  /** Filter by active status */
  activeOnly?: boolean;
  /** Filter by tags */
  tags?: string[];
  /** Include detailed information */
  detailed?: boolean;
}

/**
 * Workflow details returned from list operation
 */
export interface WorkflowDetails {
  /** Workflow state */
  state: WorkflowState;
  /** Parsed manifest (if available) */
  manifest?: Manifest;
}

/**
 * Options for removing a workflow
 */
export interface RemoveWorkflowOptions {
  /** Workflow ID to remove */
  workflowId: string;
  /** Remove all traces including backups */
  purge?: boolean;
  /** Skip confirmation prompts */
  force?: boolean;
}

/**
 * Manages workflow lifecycle operations
 */
export class WorkflowManager {
  /**
   * Check if a source is a git URL or repository shorthand
   * @param source - Source string to check
   */
  private isGitUrl(source: string): boolean {
    return (
      source.includes('github.com') ||
      source.includes('gitlab.com') ||
      source.includes('bitbucket.org') ||
      source.startsWith('git@') ||
      source.startsWith('https://') ||
      /^[\w-]+\/[\w-]+$/.test(source) // owner/repo format
    );
  }

  /**
   * Check if a source is a local path
   * @param source - Source string to check
   */
  private isLocalPath(source: string): boolean {
    return (
      source.startsWith('/') ||
      source.startsWith('./') ||
      source.startsWith('../') ||
      source.startsWith('~')
    );
  }

  /**
   * Add a workflow from a source
   * @param options - Add workflow options
   */
  async add(options: AddWorkflowOptions): Promise<OperationResult<WorkflowState>> {
    try {
      // 1. Initialize state manager if not already
      await stateManager.initialize();

      let workflowId: string;
      let targetDir: string;

      // 2. Determine source type
      if (this.isGitUrl(options.source)) {
        // 3. For git sources
        const url = gitClient.resolveGitHubUrl(options.source);
        const repoInfo = gitClient.parseRepoIdentifier(options.source);

        // Generate workflow ID from repo name or use customId
        workflowId = options.customId || repoInfo.repo;

        // Check if already installed
        const alreadyInstalled = await this.isInstalled(workflowId);
        if (alreadyInstalled && !options.force) {
          throw new BTWError(
            ErrorCode.WORKFLOW_ALREADY_EXISTS,
            `Workflow '${workflowId}' is already installed. Use --force to overwrite.`,
            { context: { workflowId, source: options.source } }
          );
        }

        // If force and already installed, remove the existing workflow directory
        if (alreadyInstalled && options.force) {
          targetDir = pathResolver.getWorkflowPath(workflowId);
          try {
            await fileSystem.remove(targetDir, true);
          } catch {
            // Ignore errors if directory doesn't exist
          }
        }

        // Get target directory
        targetDir = pathResolver.getWorkflowPath(workflowId);

        // Clone the repository
        try {
          await gitClient.clone(url, { targetDir, depth: 1 });
        } catch (error) {
          throw new BTWError(
            ErrorCode.WORKFLOW_INSTALLATION_FAILED,
            `Failed to clone workflow from ${url}`,
            { context: { workflowId, url }, cause: error as Error }
          );
        }
      } else if (this.isLocalPath(options.source)) {
        // 4. For local paths
        // Normalize the source path
        const sourcePath = pathResolver.normalize(options.source);

        // Check if source exists
        const sourceExists = await fileSystem.exists(sourcePath);
        if (!sourceExists) {
          throw new BTWError(
            ErrorCode.FILE_NOT_FOUND,
            `Source path not found: ${sourcePath}`,
            { context: { source: options.source } }
          );
        }

        // Get workflow ID from manifest or customId
        const sourceManifestPath = path.join(sourcePath, MANIFEST_FILENAME);
        const sourceManifestExists = await fileSystem.exists(sourceManifestPath);

        if (sourceManifestExists && !options.customId) {
          const sourceManifest = await manifestParser.parseFile(sourceManifestPath);
          workflowId = sourceManifest.manifest.id;
        } else if (options.customId) {
          workflowId = options.customId;
        } else {
          // Use directory name as workflow ID
          workflowId = path.basename(sourcePath);
        }

        // Check if already installed
        const alreadyInstalled = await this.isInstalled(workflowId);
        if (alreadyInstalled && !options.force) {
          throw new BTWError(
            ErrorCode.WORKFLOW_ALREADY_EXISTS,
            `Workflow '${workflowId}' is already installed. Use --force to overwrite.`,
            { context: { workflowId, source: options.source } }
          );
        }

        // If force and already installed, remove the existing workflow directory
        targetDir = pathResolver.getWorkflowPath(workflowId);
        if (alreadyInstalled && options.force) {
          try {
            await fileSystem.remove(targetDir, true);
          } catch {
            // Ignore errors if directory doesn't exist
          }
        }

        // Copy directory to workflows location
        try {
          await fileSystem.copy(sourcePath, targetDir, { overwrite: options.force });
        } catch (error) {
          throw new BTWError(
            ErrorCode.WORKFLOW_INSTALLATION_FAILED,
            `Failed to copy workflow from ${sourcePath}`,
            { context: { workflowId, sourcePath }, cause: error as Error }
          );
        }
      } else {
        throw new BTWError(
          ErrorCode.INVALID_ARGUMENT,
          `Invalid source format: ${options.source}. Must be a git URL, owner/repo, or local path.`,
          { context: { source: options.source } }
        );
      }

      // 5. Parse manifest
      const manifestPath = path.join(targetDir, MANIFEST_FILENAME);
      const manifestExists = await fileSystem.exists(manifestPath);
      if (!manifestExists) {
        // Clean up the installed directory
        try {
          await fileSystem.remove(targetDir, true);
        } catch {
          // Ignore cleanup errors
        }
        throw new BTWError(
          ErrorCode.MANIFEST_NOT_FOUND,
          `Manifest file (${MANIFEST_FILENAME}) not found in workflow`,
          { context: { workflowId, targetDir } }
        );
      }

      let manifest: Manifest;
      try {
        const parsedManifest = await manifestParser.parseFile(manifestPath);
        manifest = parsedManifest.manifest;
      } catch (error) {
        // Clean up the installed directory
        try {
          await fileSystem.remove(targetDir, true);
        } catch {
          // Ignore cleanup errors
        }
        if (error instanceof BTWError) {
          throw error;
        }
        throw new BTWError(
          ErrorCode.MANIFEST_VALIDATION_ERROR,
          `Failed to parse manifest: ${(error as Error).message}`,
          { context: { workflowId, manifestPath }, cause: error as Error }
        );
      }

      // 6. Create WorkflowState
      const workflowState: WorkflowState = {
        workflowId,
        version: manifest.version,
        installedAt: new Date().toISOString(),
        source: options.source,
        active: true,
      };

      // 7. Get current project path
      const projectPath = process.cwd();

      // 8. Add to state (handle force update case)
      try {
        stateManager.addWorkflow(projectPath, workflowState);
      } catch (error) {
        // If workflow already exists in state and force is enabled, update it
        if (
          error instanceof BTWError &&
          error.code === ErrorCode.WORKFLOW_ALREADY_EXISTS &&
          options.force
        ) {
          stateManager.updateWorkflow(projectPath, workflowId, workflowState);
        } else {
          throw error;
        }
      }

      // 9. Save state
      await stateManager.save();

      // 10. Return success with WorkflowState
      return {
        success: true,
        data: workflowState,
      };
    } catch (error) {
      if (error instanceof BTWError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: `Unexpected error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * List installed workflows
   * @param options - List options
   */
  async list(options?: ListWorkflowsOptions): Promise<OperationResult<WorkflowDetails[]>> {
    try {
      // 1. Initialize state manager
      await stateManager.initialize();

      // 2. Get project state
      const projectPath = process.cwd();
      const projectState = stateManager.getProjectState(projectPath);

      // 3. If no project state, return empty array
      if (!projectState || !projectState.workflows) {
        return {
          success: true,
          data: [],
        };
      }

      // 4. Filter workflows by options
      let workflows = [...projectState.workflows];

      if (options?.activeOnly) {
        workflows = workflows.filter((w) => w.active === true);
      }

      // 5. Build WorkflowDetails array
      const workflowDetails: WorkflowDetails[] = [];

      for (const workflow of workflows) {
        const detail: WorkflowDetails = {
          state: workflow,
        };

        // 6. If detailed, load manifest for each workflow
        if (options?.detailed) {
          try {
            const workflowPath = pathResolver.getWorkflowPath(workflow.workflowId);
            const manifestPath = path.join(workflowPath, MANIFEST_FILENAME);
            const parsedManifest = await manifestParser.parseFile(manifestPath);
            detail.manifest = parsedManifest.manifest;
          } catch {
            // If manifest can't be loaded, just include state
          }
        }

        // Filter by tags if manifest is loaded and tags filter is provided
        if (options?.tags && options.tags.length > 0 && detail.manifest) {
          // Check if any agent has matching tags
          const hasMatchingTags = detail.manifest.agents.some((agent) =>
            agent.tags?.some((tag) => options.tags!.includes(tag))
          );
          if (!hasMatchingTags) {
            continue; // Skip workflows without matching tags
          }
        }

        workflowDetails.push(detail);
      }

      // 7. Return success with array
      return {
        success: true,
        data: workflowDetails,
      };
    } catch (error) {
      if (error instanceof BTWError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: `Unexpected error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get a specific workflow by ID
   * @param workflowId - Workflow identifier
   */
  async get(workflowId: string): Promise<OperationResult<WorkflowDetails>> {
    try {
      // 1. Initialize state manager
      await stateManager.initialize();

      // 2. Get project state
      const projectPath = process.cwd();
      const projectState = stateManager.getProjectState(projectPath);

      // 3. Find workflow by ID in project.workflows
      if (!projectState || !projectState.workflows) {
        return {
          success: false,
          error: 'Workflow not found',
        };
      }

      const workflowState = projectState.workflows.find(
        (w) => w.workflowId === workflowId
      );

      // 4. If not found, return error
      if (!workflowState) {
        return {
          success: false,
          error: 'Workflow not found',
        };
      }

      // 5. Load manifest from workflow path
      const workflowPath = pathResolver.getWorkflowPath(workflowId);
      const manifestPath = path.join(workflowPath, MANIFEST_FILENAME);

      let manifest: Manifest | undefined;
      try {
        const parsedManifest = await manifestParser.parseFile(manifestPath);
        manifest = parsedManifest.manifest;
      } catch {
        // If manifest can't be loaded, continue without it
      }

      // 6. Return WorkflowDetails with state and manifest
      return {
        success: true,
        data: {
          state: workflowState,
          manifest,
        },
      };
    } catch (error) {
      if (error instanceof BTWError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: `Unexpected error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Remove a workflow
   * @param options - Remove options
   */
  async remove(options: RemoveWorkflowOptions): Promise<OperationResult> {
    try {
      // 1. Initialize state manager
      await stateManager.initialize();

      const { workflowId } = options;

      // 2. Check workflow exists using isInstalled()
      const installed = await this.isInstalled(workflowId);
      if (!installed) {
        throw new BTWError(
          ErrorCode.WORKFLOW_NOT_FOUND,
          `Workflow '${workflowId}' is not installed`,
          { context: { workflowId } }
        );
      }

      // 3. Get workflow path
      const workflowPath = pathResolver.getWorkflowPath(workflowId);

      // 4. Remove workflow directory
      try {
        await fileSystem.remove(workflowPath, true);
      } catch (error) {
        // Only throw if it's not a "not found" error
        if (
          error instanceof BTWError &&
          error.code !== ErrorCode.FILE_NOT_FOUND
        ) {
          throw new BTWError(
            ErrorCode.WORKFLOW_REMOVAL_FAILED,
            `Failed to remove workflow directory: ${workflowPath}`,
            { context: { workflowId, workflowPath }, cause: error }
          );
        }
      }

      // 5. Get current project path
      const projectPath = process.cwd();

      // 6. Remove from state
      try {
        stateManager.removeWorkflow(projectPath, workflowId);
      } catch (error) {
        // Ignore if workflow not found in state (already removed)
        if (
          !(error instanceof BTWError) ||
          error.code !== ErrorCode.WORKFLOW_NOT_FOUND
        ) {
          throw error;
        }
      }

      // 7. Save state
      await stateManager.save();

      // 8. Return success
      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof BTWError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: `Unexpected error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Update a workflow from its source
   * @param workflowId - Workflow to update
   */
  async update(workflowId: string): Promise<OperationResult<WorkflowState>> {
    try {
      // 1. Get workflow details
      const getResult = await this.get(workflowId);
      if (!getResult.success || !getResult.data) {
        return {
          success: false,
          error: getResult.error || 'Workflow not found',
        };
      }

      const { state: workflowState } = getResult.data;
      const workflowPath = pathResolver.getWorkflowPath(workflowId);

      // 2. If source is git URL, pull latest
      if (this.isGitUrl(workflowState.source)) {
        // Check if it's a git repository
        const isRepo = await gitClient.isRepository(workflowPath);
        if (!isRepo) {
          return {
            success: false,
            error: `Workflow directory is not a git repository: ${workflowPath}`,
          };
        }

        // Pull latest changes
        try {
          await gitClient.pull({ repoDir: workflowPath });
        } catch (error) {
          return {
            success: false,
            error: `Failed to pull latest changes: ${(error as Error).message}`,
          };
        }

        // Get new commit hash
        let newCommitHash: string | undefined;
        try {
          newCommitHash = await gitClient.getCurrentCommit(workflowPath);
        } catch {
          // Ignore commit hash errors
        }

        // Re-parse manifest
        const manifestPath = path.join(workflowPath, MANIFEST_FILENAME);
        let newVersion = workflowState.version;
        try {
          const parsedManifest = await manifestParser.parseFile(manifestPath);
          newVersion = parsedManifest.manifest.version;
        } catch {
          // Keep existing version if manifest can't be parsed
        }

        // Update state with new version/hash
        const projectPath = process.cwd();
        const updates: Partial<WorkflowState> = {
          version: newVersion,
        };
        if (newCommitHash) {
          updates.contentHash = newCommitHash;
        }

        stateManager.updateWorkflow(projectPath, workflowId, updates);

        // Save state
        await stateManager.save();

        // Return updated WorkflowState
        const updatedState: WorkflowState = {
          ...workflowState,
          ...updates,
        };

        return {
          success: true,
          data: updatedState,
        };
      } else {
        // For local paths, there's no remote to pull from
        return {
          success: false,
          error: 'Cannot update workflow from local path source',
        };
      }
    } catch (error) {
      if (error instanceof BTWError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: `Unexpected error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Validate a workflow manifest
   * @param manifestPath - Path to the manifest file
   */
  async validate(manifestPath: string): Promise<OperationResult<Manifest>> {
    try {
      // 1. Parse manifest
      const parsedManifest = await manifestParser.parseFile(manifestPath);

      // 2. Return success with manifest
      return {
        success: true,
        data: parsedManifest.manifest,
      };
    } catch (error) {
      // 3. Catch errors and return failure with error message
      if (error instanceof BTWError) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: `Failed to validate manifest: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check if a workflow is installed
   * @param workflowId - Workflow identifier
   */
  async isInstalled(workflowId: string): Promise<boolean> {
    try {
      // 1. Initialize state manager
      await stateManager.initialize();

      // 2. Get project state
      const projectPath = process.cwd();
      const projectState = stateManager.getProjectState(projectPath);

      // 3. Check if workflow exists in project.workflows by ID
      const existsInState =
        projectState?.workflows?.some((w) => w.workflowId === workflowId) ??
        false;

      // 4. Also verify files exist
      const workflowPath = pathResolver.getWorkflowPath(workflowId);
      const filesExist = await fileSystem.exists(workflowPath);

      // 5. Return true only if both state and files exist
      return existsInState || filesExist;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance of WorkflowManager
 */
export const workflowManager = new WorkflowManager();
