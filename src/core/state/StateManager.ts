/**
 * BTW - State Manager
 * Manages BTW's global and project-level state persistence
 */

import { BTWState, ProjectState, WorkflowState, AITarget } from '../../types/index.js';
import { BTWError, ErrorCode } from '../../types/errors.js';
import { STATE_FILE, STATE_VERSION } from '../../infrastructure/config/constants.js';
import { fileSystem } from '../../infrastructure/fs/FileSystem.js';
import { pathResolver } from '../../infrastructure/fs/PathResolver.js';
import path from 'path';

/**
 * Options for state operations
 */
export interface StateOptions {
  /** Create state if it doesn't exist */
  createIfMissing?: boolean;
  /** Path override for state file */
  statePath?: string;
}

/**
 * Manages BTW state persistence and retrieval
 */
export class StateManager {
  private state: BTWState | null = null;
  private statePath: string;
  private isDirty: boolean = false;

  constructor(statePath: string = STATE_FILE) {
    this.statePath = statePath;
  }

  /**
   * Initialize or load the state
   * @param options - State options
   */
  async initialize(options?: StateOptions): Promise<void> {
    const createIfMissing = options?.createIfMissing ?? true;

    // Check if state file exists
    const exists = await fileSystem.exists(this.statePath);

    if (exists) {
      // Load and validate existing state
      await this.reload();
    } else if (createIfMissing) {
      // Create empty state and save
      this.state = this.createEmptyState();
      this.isDirty = true;
      await this.save();
    } else {
      throw new BTWError(ErrorCode.STATE_NOT_FOUND, `State file not found: ${this.statePath}`, {
        context: { statePath: this.statePath },
      });
    }
  }

  /**
   * Get the current state
   */
  getState(): BTWState {
    if (!this.state) {
      throw new BTWError(ErrorCode.STATE_NOT_FOUND, 'State not initialized');
    }
    return this.state;
  }

  /**
   * Get state for a specific project
   * @param projectPath - Absolute path to the project
   */
  getProjectState(projectPath: string): ProjectState | undefined {
    // Ensure state is initialized
    if (!this.state) {
      throw new BTWError(ErrorCode.STATE_NOT_FOUND, 'State not initialized');
    }

    // Normalize project path
    const normalizedPath = pathResolver.normalize(projectPath);

    // Return project state or undefined
    return this.state.projects[normalizedPath];
  }

  /**
   * Create or update project state
   * @param projectPath - Absolute path to the project
   * @param state - Project state to set
   */
  setProjectState(projectPath: string, state: ProjectState): void {
    // Ensure state is initialized
    if (!this.state) {
      throw new BTWError(ErrorCode.STATE_NOT_FOUND, 'State not initialized');
    }

    // Normalize project path
    const normalizedPath = pathResolver.normalize(projectPath);

    // Set project state
    this.state.projects[normalizedPath] = state;

    // Update lastModifiedAt
    this.state.projects[normalizedPath].lastModifiedAt = new Date().toISOString();

    // Mark as dirty
    this.isDirty = true;
  }

  /**
   * Add a workflow to a project
   * @param projectPath - Project path
   * @param workflowState - Workflow state to add
   */
  addWorkflow(projectPath: string, workflowState: WorkflowState): void {
    // Ensure state is initialized
    if (!this.state) {
      throw new BTWError(ErrorCode.STATE_NOT_FOUND, 'State not initialized');
    }

    // Normalize project path
    const normalizedPath = pathResolver.normalize(projectPath);

    // Get or create project state
    let projectState = this.state.projects[normalizedPath];
    if (!projectState) {
      projectState = {
        projectPath: normalizedPath,
        workflows: [],
        initializedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
      };
      this.state.projects[normalizedPath] = projectState;
    }

    // Check if workflow already exists
    const existingWorkflow = projectState.workflows.find(
      (w) => w.workflowId === workflowState.workflowId
    );
    if (existingWorkflow) {
      throw new BTWError(
        ErrorCode.WORKFLOW_ALREADY_EXISTS,
        `Workflow '${workflowState.workflowId}' already exists in project`,
        { context: { projectPath: normalizedPath, workflowId: workflowState.workflowId } }
      );
    }

    // Add workflow
    projectState.workflows.push(workflowState);

    // Update lastModifiedAt
    projectState.lastModifiedAt = new Date().toISOString();

    // Mark as dirty
    this.isDirty = true;
  }

  /**
   * Remove a workflow from a project
   * @param projectPath - Project path
   * @param workflowId - Workflow ID to remove
   */
  removeWorkflow(projectPath: string, workflowId: string): void {
    // Ensure state is initialized
    if (!this.state) {
      throw new BTWError(ErrorCode.STATE_NOT_FOUND, 'State not initialized');
    }

    // Normalize project path
    const normalizedPath = pathResolver.normalize(projectPath);

    // Get project state
    const projectState = this.state.projects[normalizedPath];
    if (!projectState) {
      throw new BTWError(
        ErrorCode.WORKFLOW_NOT_FOUND,
        `Project not found: ${normalizedPath}`,
        { context: { projectPath: normalizedPath, workflowId } }
      );
    }

    // Find workflow index
    const workflowIndex = projectState.workflows.findIndex(
      (w) => w.workflowId === workflowId
    );
    if (workflowIndex === -1) {
      throw new BTWError(
        ErrorCode.WORKFLOW_NOT_FOUND,
        `Workflow '${workflowId}' not found in project`,
        { context: { projectPath: normalizedPath, workflowId } }
      );
    }

    // Remove workflow
    projectState.workflows.splice(workflowIndex, 1);

    // Update lastModifiedAt
    projectState.lastModifiedAt = new Date().toISOString();

    // Mark as dirty
    this.isDirty = true;
  }

  /**
   * Update a workflow's state
   * @param projectPath - Project path
   * @param workflowId - Workflow ID
   * @param updates - Partial workflow state updates
   */
  updateWorkflow(
    projectPath: string,
    workflowId: string,
    updates: Partial<WorkflowState>
  ): void {
    // Ensure state is initialized
    if (!this.state) {
      throw new BTWError(ErrorCode.STATE_NOT_FOUND, 'State not initialized');
    }

    // Normalize project path
    const normalizedPath = pathResolver.normalize(projectPath);

    // Get project state
    const projectState = this.state.projects[normalizedPath];
    if (!projectState) {
      throw new BTWError(
        ErrorCode.WORKFLOW_NOT_FOUND,
        `Project not found: ${normalizedPath}`,
        { context: { projectPath: normalizedPath, workflowId } }
      );
    }

    // Find workflow
    const workflow = projectState.workflows.find(
      (w) => w.workflowId === workflowId
    );
    if (!workflow) {
      throw new BTWError(
        ErrorCode.WORKFLOW_NOT_FOUND,
        `Workflow '${workflowId}' not found in project`,
        { context: { projectPath: normalizedPath, workflowId } }
      );
    }

    // Merge updates
    Object.assign(workflow, updates);

    // Update lastModifiedAt
    projectState.lastModifiedAt = new Date().toISOString();

    // Mark as dirty
    this.isDirty = true;
  }

  /**
   * Get the active target for a project
   * @param projectPath - Project path
   */
  getActiveTarget(projectPath: string): AITarget | undefined {
    // Get project state (handles state initialization check)
    const projectState = this.getProjectState(projectPath);

    // Return activeTarget or undefined
    return projectState?.activeTarget;
  }

  /**
   * Set the active target for a project
   * @param projectPath - Project path
   * @param target - AI target to set as active
   */
  setActiveTarget(projectPath: string, target: AITarget): void {
    // Ensure state is initialized
    if (!this.state) {
      throw new BTWError(ErrorCode.STATE_NOT_FOUND, 'State not initialized');
    }

    // Normalize project path
    const normalizedPath = pathResolver.normalize(projectPath);

    // Get or create project state
    let projectState = this.state.projects[normalizedPath];
    if (!projectState) {
      projectState = {
        projectPath: normalizedPath,
        workflows: [],
        initializedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
      };
      this.state.projects[normalizedPath] = projectState;
    }

    // Set active target
    projectState.activeTarget = target;

    // Update lastModifiedAt
    projectState.lastModifiedAt = new Date().toISOString();

    // Mark as dirty
    this.isDirty = true;
  }

  /**
   * Save state to disk
   */
  async save(): Promise<void> {
    // If not dirty, return early
    if (!this.isDirty) {
      return;
    }

    // Ensure state exists
    if (!this.state) {
      throw new BTWError(ErrorCode.STATE_NOT_FOUND, 'State not initialized');
    }

    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(this.statePath);
      await fileSystem.mkdir(parentDir);

      // Serialize state to JSON with 2-space indent
      const json = JSON.stringify(this.state, null, 2);

      // Write to file
      await fileSystem.writeFile(this.statePath, json);

      // Clear dirty flag
      this.isDirty = false;
    } catch (error) {
      if (error instanceof BTWError) {
        throw error;
      }
      throw new BTWError(
        ErrorCode.FILE_WRITE_ERROR,
        `Failed to save state to ${this.statePath}`,
        { context: { statePath: this.statePath }, cause: error as Error }
      );
    }
  }

  /**
   * Reload state from disk
   */
  async reload(): Promise<void> {
    try {
      // Read file
      const content = await fileSystem.readFile(this.statePath);

      // Parse JSON
      let parsedState: unknown;
      try {
        parsedState = JSON.parse(content);
      } catch (parseError) {
        throw new BTWError(
          ErrorCode.STATE_CORRUPTED,
          `State file contains invalid JSON: ${this.statePath}`,
          { context: { statePath: this.statePath }, cause: parseError as Error }
        );
      }

      // Validate state structure
      if (!this.validateState(parsedState)) {
        throw new BTWError(
          ErrorCode.STATE_CORRUPTED,
          `State file has invalid structure: ${this.statePath}`,
          { context: { statePath: this.statePath } }
        );
      }

      // At this point, parsedState is validated as BTWState
      let validState: BTWState = parsedState;

      // Check version and migrate if needed
      if (validState.version !== STATE_VERSION) {
        validState = this.migrateState(validState, validState.version);
      }

      // Set state
      this.state = validState;

      // Clear dirty flag
      this.isDirty = false;
    } catch (error) {
      if (error instanceof BTWError) {
        throw error;
      }
      throw new BTWError(
        ErrorCode.FILE_READ_ERROR,
        `Failed to reload state from ${this.statePath}`,
        { context: { statePath: this.statePath }, cause: error as Error }
      );
    }
  }

  /**
   * Create a new empty state
   */
  private createEmptyState(): BTWState {
    return {
      version: STATE_VERSION,
      projects: {},
    };
  }

  /**
   * Validate state structure
   * @param state - State to validate
   */
  private validateState(state: unknown): state is BTWState {
    // Check state is an object
    if (!state || typeof state !== 'object') {
      return false;
    }

    const stateObj = state as Record<string, unknown>;

    // Check version is a string
    if (typeof stateObj.version !== 'string') {
      return false;
    }

    // Check projects is an object
    if (!stateObj.projects || typeof stateObj.projects !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Migrate state from older version
   * @param state - State to migrate
   * @param fromVersion - Source version
   */
  private migrateState(state: BTWState, fromVersion: string): BTWState {
    // Log debug message if versions differ
    if (fromVersion !== STATE_VERSION) {
      console.debug(`Migrating state from version ${fromVersion} to ${STATE_VERSION}`);
    }

    // For now, just return the state as-is (no migrations yet)
    // Update state version to current
    state.version = STATE_VERSION;

    return state;
  }
}

/**
 * Singleton instance of StateManager
 */
export const stateManager = new StateManager();
