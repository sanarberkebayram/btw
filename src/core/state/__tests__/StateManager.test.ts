/**
 * BTW - StateManager Unit Tests
 * Comprehensive tests for state management functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { StateManager, StateOptions } from '../StateManager.js';
import { BTWError, ErrorCode } from '../../../types/errors.js';
import type { BTWState, ProjectState, WorkflowState, AITarget } from '../../../types/index.js';

// Mock the dependencies
vi.mock('../../../infrastructure/fs/FileSystem.js', () => ({
  fileSystem: {
    exists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

vi.mock('../../../infrastructure/fs/PathResolver.js', () => ({
  pathResolver: {
    normalize: vi.fn((path: string) => path),
  },
}));

vi.mock('../../../infrastructure/config/constants.js', () => ({
  STATE_FILE: '/mock/.btw/state.json',
  STATE_VERSION: '1.0.0',
}));

// Import mocked modules
import { fileSystem } from '../../../infrastructure/fs/FileSystem.js';
import { pathResolver } from '../../../infrastructure/fs/PathResolver.js';
import { STATE_VERSION } from '../../../infrastructure/config/constants.js';

describe('StateManager', () => {
  let stateManager: StateManager;
  const mockStatePath = '/mock/.btw/state.json';

  // Helper to create a valid empty state
  const createEmptyState = (): BTWState => ({
    version: STATE_VERSION,
    projects: {},
  });

  // Helper to create a mock workflow state
  const createMockWorkflow = (id: string = 'test-workflow'): WorkflowState => ({
    workflowId: id,
    version: '1.0.0',
    installedAt: new Date().toISOString(),
    source: '/mock/workflows/test',
    active: true,
  });

  // Helper to create a mock project state
  const createMockProjectState = (projectPath: string = '/mock/project'): ProjectState => ({
    projectPath,
    workflows: [],
    initializedAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager(mockStatePath);

    // Default mock implementations
    (pathResolver.normalize as Mock).mockImplementation((path: string) => path);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // SECTION 1: initialize() - Loading or creating state
  // ============================================================================
  describe('initialize()', () => {
    describe('when state file exists', () => {
      it('should load existing state from file', async () => {
        const existingState = createEmptyState();
        existingState.projects['/project1'] = createMockProjectState('/project1');

        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(existingState));

        await stateManager.initialize();

        expect(fileSystem.exists).toHaveBeenCalledWith(mockStatePath);
        expect(fileSystem.readFile).toHaveBeenCalledWith(mockStatePath);
        expect(stateManager.getState()).toEqual(existingState);
      });

      it('should validate state structure when loading', async () => {
        const validState = createEmptyState();
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(validState));

        await stateManager.initialize();

        const state = stateManager.getState();
        expect(state.version).toBe(STATE_VERSION);
        expect(state.projects).toBeDefined();
      });

      it('should migrate state if version differs', async () => {
        const oldVersionState = {
          version: '0.9.0',
          projects: {},
        };

        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(oldVersionState));

        // Spy on console.debug to verify migration logging
        const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

        await stateManager.initialize();

        expect(debugSpy).toHaveBeenCalledWith(
          expect.stringContaining('Migrating state from version 0.9.0')
        );

        // State should be updated to current version
        expect(stateManager.getState().version).toBe(STATE_VERSION);
      });
    });

    describe('when state file does not exist', () => {
      it('should create new state when createIfMissing is true (default)', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(false);
        (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
        (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

        await stateManager.initialize();

        expect(fileSystem.writeFile).toHaveBeenCalled();
        const state = stateManager.getState();
        expect(state.version).toBe(STATE_VERSION);
        expect(state.projects).toEqual({});
      });

      it('should create new state when createIfMissing is explicitly true', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(false);
        (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
        (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

        await stateManager.initialize({ createIfMissing: true });

        expect(fileSystem.writeFile).toHaveBeenCalled();
      });

      it('should throw STATE_NOT_FOUND when createIfMissing is false', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(false);

        await expect(
          stateManager.initialize({ createIfMissing: false })
        ).rejects.toThrow(BTWError);

        await expect(
          stateManager.initialize({ createIfMissing: false })
        ).rejects.toMatchObject({
          code: ErrorCode.STATE_NOT_FOUND,
        });
      });

      it('should create parent directories when saving new state', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(false);
        (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
        (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

        await stateManager.initialize();

        expect(fileSystem.mkdir).toHaveBeenCalledWith('/mock/.btw');
      });
    });

    describe('error handling during initialization', () => {
      it('should throw STATE_CORRUPTED for invalid JSON', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue('{ invalid json }');

        await expect(stateManager.initialize()).rejects.toThrow(BTWError);
        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should throw STATE_CORRUPTED for invalid state structure (missing version)', async () => {
        const invalidState = { projects: {} };
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(invalidState));

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should throw STATE_CORRUPTED for invalid state structure (missing projects)', async () => {
        const invalidState = { version: '1.0.0' };
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(invalidState));

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should throw STATE_CORRUPTED for non-object state', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue('"string"');

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should throw STATE_CORRUPTED for null state', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue('null');

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should wrap file read errors appropriately', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockRejectedValue(new Error('Disk error'));

        await expect(stateManager.initialize()).rejects.toThrow(BTWError);
        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.FILE_READ_ERROR,
        });
      });

      it('should propagate BTWError from file operations', async () => {
        const btwError = new BTWError(ErrorCode.PERMISSION_DENIED, 'Cannot read file');
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockRejectedValue(btwError);

        await expect(stateManager.initialize()).rejects.toThrow(btwError);
      });
    });
  });

  // ============================================================================
  // SECTION 2: getState() / setState() - State access
  // ============================================================================
  describe('getState()', () => {
    it('should return the current state when initialized', async () => {
      const mockState = createEmptyState();
      mockState.projects['/project1'] = createMockProjectState('/project1');

      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));

      await stateManager.initialize();

      const state = stateManager.getState();
      expect(state).toEqual(mockState);
    });

    it('should throw STATE_NOT_FOUND when not initialized', () => {
      expect(() => stateManager.getState()).toThrow(BTWError);
      expect(() => stateManager.getState()).toThrow(
        expect.objectContaining({ code: ErrorCode.STATE_NOT_FOUND })
      );
    });

    it('should return reference to actual state object', async () => {
      const mockState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));

      await stateManager.initialize();

      const state1 = stateManager.getState();
      const state2 = stateManager.getState();

      expect(state1).toBe(state2); // Same reference
    });
  });

  // ============================================================================
  // SECTION 3: addWorkflow() / removeWorkflow() / updateWorkflow() - Workflow management
  // ============================================================================
  describe('addWorkflow()', () => {
    beforeEach(async () => {
      const mockState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      await stateManager.initialize();
    });

    it('should add a workflow to a new project', () => {
      const projectPath = '/test/project';
      const workflow = createMockWorkflow('workflow-1');

      stateManager.addWorkflow(projectPath, workflow);

      const projectState = stateManager.getProjectState(projectPath);
      expect(projectState).toBeDefined();
      expect(projectState!.workflows).toHaveLength(1);
      expect(projectState!.workflows[0]).toEqual(workflow);
    });

    it('should add a workflow to an existing project', () => {
      const projectPath = '/test/project';
      const workflow1 = createMockWorkflow('workflow-1');
      const workflow2 = createMockWorkflow('workflow-2');

      stateManager.addWorkflow(projectPath, workflow1);
      stateManager.addWorkflow(projectPath, workflow2);

      const projectState = stateManager.getProjectState(projectPath);
      expect(projectState!.workflows).toHaveLength(2);
    });

    it('should create project state when adding to non-existent project', () => {
      const projectPath = '/new/project';
      const workflow = createMockWorkflow();

      stateManager.addWorkflow(projectPath, workflow);

      const projectState = stateManager.getProjectState(projectPath);
      expect(projectState).toBeDefined();
      expect(projectState!.projectPath).toBe(projectPath);
      expect(projectState!.initializedAt).toBeDefined();
    });

    it('should update lastModifiedAt when adding workflow', () => {
      const projectPath = '/test/project';
      const workflow = createMockWorkflow();

      stateManager.addWorkflow(projectPath, workflow);

      const projectState = stateManager.getProjectState(projectPath);
      expect(projectState!.lastModifiedAt).toBeDefined();
    });

    it('should mark state as dirty when adding workflow', async () => {
      const projectPath = '/test/project';
      const workflow = createMockWorkflow();

      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

      stateManager.addWorkflow(projectPath, workflow);

      // Save should write to disk since state is dirty
      await stateManager.save();
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should throw WORKFLOW_ALREADY_EXISTS for duplicate workflow', () => {
      const projectPath = '/test/project';
      const workflow = createMockWorkflow('duplicate-id');

      stateManager.addWorkflow(projectPath, workflow);

      expect(() => stateManager.addWorkflow(projectPath, workflow)).toThrow(BTWError);
      expect(() => stateManager.addWorkflow(projectPath, workflow)).toThrow(
        expect.objectContaining({ code: ErrorCode.WORKFLOW_ALREADY_EXISTS })
      );
    });

    it('should throw STATE_NOT_FOUND when state not initialized', () => {
      const uninitializedManager = new StateManager();

      expect(() =>
        uninitializedManager.addWorkflow('/project', createMockWorkflow())
      ).toThrow(
        expect.objectContaining({ code: ErrorCode.STATE_NOT_FOUND })
      );
    });

    it('should normalize project path', () => {
      const projectPath = '/test/project';
      const normalizedPath = '/normalized/path';
      const workflow = createMockWorkflow();

      (pathResolver.normalize as Mock).mockReturnValue(normalizedPath);

      stateManager.addWorkflow(projectPath, workflow);

      expect(pathResolver.normalize).toHaveBeenCalledWith(projectPath);
      expect(stateManager.getState().projects[normalizedPath]).toBeDefined();
    });
  });

  describe('removeWorkflow()', () => {
    beforeEach(async () => {
      const mockState = createEmptyState();
      mockState.projects['/test/project'] = {
        ...createMockProjectState('/test/project'),
        workflows: [
          createMockWorkflow('workflow-1'),
          createMockWorkflow('workflow-2'),
        ],
      };

      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      await stateManager.initialize();
    });

    it('should remove a workflow from project', () => {
      const projectPath = '/test/project';

      stateManager.removeWorkflow(projectPath, 'workflow-1');

      const projectState = stateManager.getProjectState(projectPath);
      expect(projectState!.workflows).toHaveLength(1);
      expect(projectState!.workflows[0].workflowId).toBe('workflow-2');
    });

    it('should update lastModifiedAt when removing workflow', () => {
      const projectPath = '/test/project';
      const originalModifiedAt = stateManager.getProjectState(projectPath)!.lastModifiedAt;

      // Small delay to ensure different timestamp
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      stateManager.removeWorkflow(projectPath, 'workflow-1');

      const newModifiedAt = stateManager.getProjectState(projectPath)!.lastModifiedAt;
      expect(newModifiedAt).not.toBe(originalModifiedAt);

      vi.useRealTimers();
    });

    it('should mark state as dirty when removing workflow', async () => {
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

      stateManager.removeWorkflow('/test/project', 'workflow-1');

      await stateManager.save();
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should throw WORKFLOW_NOT_FOUND for non-existent project', () => {
      expect(() =>
        stateManager.removeWorkflow('/non/existent', 'workflow-1')
      ).toThrow(
        expect.objectContaining({ code: ErrorCode.WORKFLOW_NOT_FOUND })
      );
    });

    it('should throw WORKFLOW_NOT_FOUND for non-existent workflow', () => {
      expect(() =>
        stateManager.removeWorkflow('/test/project', 'non-existent')
      ).toThrow(
        expect.objectContaining({ code: ErrorCode.WORKFLOW_NOT_FOUND })
      );
    });

    it('should throw STATE_NOT_FOUND when state not initialized', () => {
      const uninitializedManager = new StateManager();

      expect(() =>
        uninitializedManager.removeWorkflow('/project', 'workflow')
      ).toThrow(
        expect.objectContaining({ code: ErrorCode.STATE_NOT_FOUND })
      );
    });
  });

  describe('updateWorkflow()', () => {
    beforeEach(async () => {
      const mockState = createEmptyState();
      mockState.projects['/test/project'] = {
        ...createMockProjectState('/test/project'),
        workflows: [createMockWorkflow('workflow-1')],
      };

      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      await stateManager.initialize();
    });

    it('should update workflow properties', () => {
      const projectPath = '/test/project';
      const updates: Partial<WorkflowState> = {
        active: false,
        lastInjectedAt: new Date().toISOString(),
      };

      stateManager.updateWorkflow(projectPath, 'workflow-1', updates);

      const projectState = stateManager.getProjectState(projectPath);
      const workflow = projectState!.workflows[0];
      expect(workflow.active).toBe(false);
      expect(workflow.lastInjectedAt).toBe(updates.lastInjectedAt);
    });

    it('should preserve other workflow properties', () => {
      const projectPath = '/test/project';
      const originalWorkflow = stateManager.getProjectState(projectPath)!.workflows[0];

      stateManager.updateWorkflow(projectPath, 'workflow-1', { active: false });

      const updatedWorkflow = stateManager.getProjectState(projectPath)!.workflows[0];
      expect(updatedWorkflow.workflowId).toBe(originalWorkflow.workflowId);
      expect(updatedWorkflow.version).toBe(originalWorkflow.version);
      expect(updatedWorkflow.source).toBe(originalWorkflow.source);
    });

    it('should update lastModifiedAt', () => {
      const projectPath = '/test/project';

      vi.useFakeTimers();
      const before = stateManager.getProjectState(projectPath)!.lastModifiedAt;
      vi.advanceTimersByTime(1000);

      stateManager.updateWorkflow(projectPath, 'workflow-1', { active: false });

      const after = stateManager.getProjectState(projectPath)!.lastModifiedAt;
      expect(after).not.toBe(before);
      vi.useRealTimers();
    });

    it('should mark state as dirty', async () => {
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

      stateManager.updateWorkflow('/test/project', 'workflow-1', { active: false });

      await stateManager.save();
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should throw WORKFLOW_NOT_FOUND for non-existent project', () => {
      expect(() =>
        stateManager.updateWorkflow('/non/existent', 'workflow-1', {})
      ).toThrow(
        expect.objectContaining({ code: ErrorCode.WORKFLOW_NOT_FOUND })
      );
    });

    it('should throw WORKFLOW_NOT_FOUND for non-existent workflow', () => {
      expect(() =>
        stateManager.updateWorkflow('/test/project', 'non-existent', {})
      ).toThrow(
        expect.objectContaining({ code: ErrorCode.WORKFLOW_NOT_FOUND })
      );
    });

    it('should throw STATE_NOT_FOUND when state not initialized', () => {
      const uninitializedManager = new StateManager();

      expect(() =>
        uninitializedManager.updateWorkflow('/project', 'workflow', {})
      ).toThrow(
        expect.objectContaining({ code: ErrorCode.STATE_NOT_FOUND })
      );
    });
  });

  // ============================================================================
  // SECTION 4: getActiveTarget() / setActiveTarget() - AI target management
  // ============================================================================
  describe('getActiveTarget()', () => {
    beforeEach(async () => {
      const mockState = createEmptyState();
      mockState.projects['/project-with-target'] = {
        ...createMockProjectState('/project-with-target'),
        activeTarget: 'claude' as AITarget,
      };
      mockState.projects['/project-without-target'] = createMockProjectState('/project-without-target');

      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      await stateManager.initialize();
    });

    it('should return active target for project with target set', () => {
      const target = stateManager.getActiveTarget('/project-with-target');
      expect(target).toBe('claude');
    });

    it('should return undefined for project without target set', () => {
      const target = stateManager.getActiveTarget('/project-without-target');
      expect(target).toBeUndefined();
    });

    it('should return undefined for non-existent project', () => {
      const target = stateManager.getActiveTarget('/non-existent');
      expect(target).toBeUndefined();
    });

    it('should throw STATE_NOT_FOUND when state not initialized', () => {
      const uninitializedManager = new StateManager();

      expect(() => uninitializedManager.getActiveTarget('/project')).toThrow(
        expect.objectContaining({ code: ErrorCode.STATE_NOT_FOUND })
      );
    });
  });

  describe('setActiveTarget()', () => {
    beforeEach(async () => {
      const mockState = createEmptyState();
      mockState.projects['/existing-project'] = createMockProjectState('/existing-project');

      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      await stateManager.initialize();
    });

    it('should set active target for existing project', () => {
      stateManager.setActiveTarget('/existing-project', 'cursor');

      const target = stateManager.getActiveTarget('/existing-project');
      expect(target).toBe('cursor');
    });

    it('should create project state when setting target for new project', () => {
      stateManager.setActiveTarget('/new-project', 'windsurf');

      const projectState = stateManager.getProjectState('/new-project');
      expect(projectState).toBeDefined();
      expect(projectState!.activeTarget).toBe('windsurf');
      expect(projectState!.workflows).toEqual([]);
    });

    it('should update existing active target', () => {
      stateManager.setActiveTarget('/existing-project', 'claude');
      expect(stateManager.getActiveTarget('/existing-project')).toBe('claude');

      stateManager.setActiveTarget('/existing-project', 'copilot');
      expect(stateManager.getActiveTarget('/existing-project')).toBe('copilot');
    });

    it('should update lastModifiedAt', () => {
      vi.useFakeTimers();
      const before = stateManager.getProjectState('/existing-project')!.lastModifiedAt;
      vi.advanceTimersByTime(1000);

      stateManager.setActiveTarget('/existing-project', 'claude');

      const after = stateManager.getProjectState('/existing-project')!.lastModifiedAt;
      expect(after).not.toBe(before);
      vi.useRealTimers();
    });

    it('should mark state as dirty', async () => {
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

      stateManager.setActiveTarget('/existing-project', 'claude');

      await stateManager.save();
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should accept all valid AI targets', () => {
      const targets: AITarget[] = ['claude', 'cursor', 'windsurf', 'copilot'];

      targets.forEach((target, index) => {
        const projectPath = `/project-${index}`;
        stateManager.setActiveTarget(projectPath, target);
        expect(stateManager.getActiveTarget(projectPath)).toBe(target);
      });
    });

    it('should throw STATE_NOT_FOUND when state not initialized', () => {
      const uninitializedManager = new StateManager();

      expect(() =>
        uninitializedManager.setActiveTarget('/project', 'claude')
      ).toThrow(
        expect.objectContaining({ code: ErrorCode.STATE_NOT_FOUND })
      );
    });
  });

  // ============================================================================
  // SECTION 5: save() / reload() - Persistence operations
  // ============================================================================
  describe('save()', () => {
    beforeEach(async () => {
      const mockState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);
      await stateManager.initialize();
    });

    it('should save state to disk when dirty', async () => {
      stateManager.setActiveTarget('/project', 'claude');

      await stateManager.save();

      expect(fileSystem.mkdir).toHaveBeenCalledWith('/mock/.btw');
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should not save when state is not dirty', async () => {
      // State is clean after initialization, make another save call
      vi.clearAllMocks();

      await stateManager.save();

      expect(fileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should serialize state with 2-space indentation', async () => {
      stateManager.setActiveTarget('/project', 'claude');

      await stateManager.save();

      const writeCall = (fileSystem.writeFile as Mock).mock.calls[0];
      const writtenJson = writeCall[1];

      // Verify it's properly indented JSON
      expect(writtenJson).toContain('  "version"');
      expect(writtenJson).toContain('  "projects"');
    });

    it('should clear dirty flag after successful save', async () => {
      stateManager.setActiveTarget('/project', 'claude');
      await stateManager.save();

      vi.clearAllMocks();
      await stateManager.save();

      expect(fileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should throw FILE_WRITE_ERROR on write failure', async () => {
      stateManager.setActiveTarget('/project', 'claude');
      (fileSystem.writeFile as Mock).mockRejectedValue(new Error('Write failed'));

      await expect(stateManager.save()).rejects.toMatchObject({
        code: ErrorCode.FILE_WRITE_ERROR,
      });
    });

    it('should propagate BTWError from file operations', async () => {
      const btwError = new BTWError(ErrorCode.PERMISSION_DENIED, 'Cannot write');
      stateManager.setActiveTarget('/project', 'claude');
      (fileSystem.writeFile as Mock).mockRejectedValue(btwError);

      await expect(stateManager.save()).rejects.toBe(btwError);
    });

    it('should throw STATE_NOT_FOUND when state not initialized', async () => {
      const uninitializedManager = new StateManager();

      // Artificially set dirty flag without initializing
      (uninitializedManager as unknown as { isDirty: boolean }).isDirty = true;

      await expect(uninitializedManager.save()).rejects.toMatchObject({
        code: ErrorCode.STATE_NOT_FOUND,
      });
    });
  });

  describe('reload()', () => {
    it('should reload state from disk', async () => {
      const initialState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(initialState));
      await stateManager.initialize();

      // Modify the file externally
      const updatedState = createEmptyState();
      updatedState.projects['/new-project'] = createMockProjectState('/new-project');
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(updatedState));

      await stateManager.reload();

      expect(stateManager.getProjectState('/new-project')).toBeDefined();
    });

    it('should clear dirty flag after reload', async () => {
      const mockState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

      await stateManager.initialize();
      stateManager.setActiveTarget('/project', 'claude');

      await stateManager.reload();

      vi.clearAllMocks();
      await stateManager.save();

      expect(fileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should migrate state during reload if version differs', async () => {
      const initialState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(initialState));
      await stateManager.initialize();

      // Mock reloading an older version
      const oldState = { version: '0.5.0', projects: {} };
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(oldState));

      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      await stateManager.reload();

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrating state')
      );
      expect(stateManager.getState().version).toBe(STATE_VERSION);
    });

    it('should throw STATE_CORRUPTED for invalid JSON on reload', async () => {
      const mockState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      await stateManager.initialize();

      (fileSystem.readFile as Mock).mockResolvedValue('not valid json');

      await expect(stateManager.reload()).rejects.toMatchObject({
        code: ErrorCode.STATE_CORRUPTED,
      });
    });

    it('should throw STATE_CORRUPTED for invalid state structure on reload', async () => {
      const mockState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      await stateManager.initialize();

      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify({ invalid: true }));

      await expect(stateManager.reload()).rejects.toMatchObject({
        code: ErrorCode.STATE_CORRUPTED,
      });
    });

    it('should throw FILE_READ_ERROR on read failure', async () => {
      const mockState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      await stateManager.initialize();

      (fileSystem.readFile as Mock).mockRejectedValue(new Error('Read failed'));

      await expect(stateManager.reload()).rejects.toMatchObject({
        code: ErrorCode.FILE_READ_ERROR,
      });
    });

    it('should propagate BTWError from file operations', async () => {
      const mockState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      await stateManager.initialize();

      const btwError = new BTWError(ErrorCode.FILE_NOT_FOUND, 'File not found');
      (fileSystem.readFile as Mock).mockRejectedValue(btwError);

      await expect(stateManager.reload()).rejects.toBe(btwError);
    });
  });

  // ============================================================================
  // SECTION 6: migrateState() - State versioning and migration
  // ============================================================================
  describe('migrateState()', () => {
    it('should log migration when versions differ', async () => {
      const oldState = { version: '0.1.0', projects: {} };
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(oldState));

      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      await stateManager.initialize();

      expect(debugSpy).toHaveBeenCalledWith(
        `Migrating state from version 0.1.0 to ${STATE_VERSION}`
      );
    });

    it('should update version to current after migration', async () => {
      const oldState = { version: '0.8.0', projects: {} };
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(oldState));

      await stateManager.initialize();

      expect(stateManager.getState().version).toBe(STATE_VERSION);
    });

    it('should not log when versions are the same', async () => {
      const currentState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(currentState));

      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      await stateManager.initialize();

      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should preserve existing projects during migration', async () => {
      const oldState = {
        version: '0.5.0',
        projects: {
          '/project1': createMockProjectState('/project1'),
          '/project2': createMockProjectState('/project2'),
        },
      };
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(oldState));
      vi.spyOn(console, 'debug').mockImplementation(() => {});

      await stateManager.initialize();

      const state = stateManager.getState();
      expect(state.projects['/project1']).toBeDefined();
      expect(state.projects['/project2']).toBeDefined();
    });
  });

  // ============================================================================
  // SECTION 7: Dirty flag pattern for change tracking
  // ============================================================================
  describe('dirty flag pattern', () => {
    beforeEach(async () => {
      const mockState = createEmptyState();
      mockState.projects['/test/project'] = createMockProjectState('/test/project');

      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);
      await stateManager.initialize();
    });

    it('should be clean after initialization', async () => {
      vi.clearAllMocks();
      await stateManager.save();
      expect(fileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should be dirty after addWorkflow', async () => {
      stateManager.addWorkflow('/test/project', createMockWorkflow('new-workflow'));
      await stateManager.save();
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should be dirty after removeWorkflow', async () => {
      stateManager.addWorkflow('/test/project', createMockWorkflow('to-remove'));
      await stateManager.save();
      vi.clearAllMocks();

      stateManager.removeWorkflow('/test/project', 'to-remove');
      await stateManager.save();
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should be dirty after updateWorkflow', async () => {
      stateManager.addWorkflow('/test/project', createMockWorkflow('to-update'));
      await stateManager.save();
      vi.clearAllMocks();

      stateManager.updateWorkflow('/test/project', 'to-update', { active: false });
      await stateManager.save();
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should be dirty after setActiveTarget', async () => {
      vi.clearAllMocks();
      stateManager.setActiveTarget('/test/project', 'cursor');
      await stateManager.save();
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should be dirty after setProjectState', async () => {
      vi.clearAllMocks();
      stateManager.setProjectState('/new/project', createMockProjectState('/new/project'));
      await stateManager.save();
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should be clean after save', async () => {
      stateManager.setActiveTarget('/test/project', 'claude');
      await stateManager.save();
      vi.clearAllMocks();

      await stateManager.save();
      expect(fileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should be clean after reload', async () => {
      stateManager.setActiveTarget('/test/project', 'claude');
      // Dirty now

      await stateManager.reload();
      vi.clearAllMocks();

      await stateManager.save();
      expect(fileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should be dirty after creating new state', async () => {
      const newManager = new StateManager('/new/path/state.json');
      (fileSystem.exists as Mock).mockResolvedValue(false);
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

      await newManager.initialize({ createIfMissing: true });

      // The save during initialization should have been called
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION 8: Project state operations (getProjectState, setProjectState)
  // ============================================================================
  describe('getProjectState()', () => {
    beforeEach(async () => {
      const mockState = createEmptyState();
      mockState.projects['/existing/project'] = createMockProjectState('/existing/project');

      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      await stateManager.initialize();
    });

    it('should return project state for existing project', () => {
      const projectState = stateManager.getProjectState('/existing/project');
      expect(projectState).toBeDefined();
      expect(projectState!.projectPath).toBe('/existing/project');
    });

    it('should return undefined for non-existent project', () => {
      const projectState = stateManager.getProjectState('/non/existent');
      expect(projectState).toBeUndefined();
    });

    it('should normalize project path when getting state', () => {
      (pathResolver.normalize as Mock).mockReturnValue('/existing/project');

      const projectState = stateManager.getProjectState('/some/path');

      expect(pathResolver.normalize).toHaveBeenCalledWith('/some/path');
      expect(projectState).toBeDefined();
    });

    it('should throw STATE_NOT_FOUND when state not initialized', () => {
      const uninitializedManager = new StateManager();

      expect(() => uninitializedManager.getProjectState('/project')).toThrow(
        expect.objectContaining({ code: ErrorCode.STATE_NOT_FOUND })
      );
    });
  });

  describe('setProjectState()', () => {
    beforeEach(async () => {
      const mockState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);
      await stateManager.initialize();
    });

    it('should set project state for new project', () => {
      const projectState = createMockProjectState('/new/project');

      stateManager.setProjectState('/new/project', projectState);

      const retrieved = stateManager.getProjectState('/new/project');
      expect(retrieved!.projectPath).toBe(projectState.projectPath);
    });

    it('should replace existing project state', () => {
      const initialState = createMockProjectState('/project');
      stateManager.setProjectState('/project', initialState);

      const updatedState: ProjectState = {
        ...initialState,
        activeTarget: 'claude',
      };
      stateManager.setProjectState('/project', updatedState);

      const retrieved = stateManager.getProjectState('/project');
      expect(retrieved!.activeTarget).toBe('claude');
    });

    it('should update lastModifiedAt automatically', () => {
      const projectState = createMockProjectState('/project');
      const originalModifiedAt = projectState.lastModifiedAt;

      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      stateManager.setProjectState('/project', projectState);

      const retrieved = stateManager.getProjectState('/project');
      expect(retrieved!.lastModifiedAt).not.toBe(originalModifiedAt);
      vi.useRealTimers();
    });

    it('should mark state as dirty', async () => {
      stateManager.setProjectState('/project', createMockProjectState('/project'));

      await stateManager.save();
      expect(fileSystem.writeFile).toHaveBeenCalled();
    });

    it('should normalize project path', () => {
      const normalizedPath = '/normalized/path';
      (pathResolver.normalize as Mock).mockReturnValue(normalizedPath);

      stateManager.setProjectState('/some/path', createMockProjectState('/some/path'));

      expect(pathResolver.normalize).toHaveBeenCalledWith('/some/path');
      expect(stateManager.getState().projects[normalizedPath]).toBeDefined();
    });

    it('should throw STATE_NOT_FOUND when state not initialized', () => {
      const uninitializedManager = new StateManager();

      expect(() =>
        uninitializedManager.setProjectState('/project', createMockProjectState('/project'))
      ).toThrow(
        expect.objectContaining({ code: ErrorCode.STATE_NOT_FOUND })
      );
    });

    it('should handle project state with workflows', () => {
      const projectState: ProjectState = {
        ...createMockProjectState('/project'),
        workflows: [createMockWorkflow('wf-1'), createMockWorkflow('wf-2')],
      };

      stateManager.setProjectState('/project', projectState);

      const retrieved = stateManager.getProjectState('/project');
      expect(retrieved!.workflows).toHaveLength(2);
    });
  });

  // ============================================================================
  // SECTION 9: Error handling for corrupted state, missing files
  // ============================================================================
  describe('error handling', () => {
    describe('corrupted state handling', () => {
      it('should handle empty file', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue('');

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should handle array instead of object', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue('[]');

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should handle number instead of object', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue('42');

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should handle state with non-string version', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue(
          JSON.stringify({ version: 123, projects: {} })
        );

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should handle state with non-object projects', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue(
          JSON.stringify({ version: '1.0.0', projects: 'not-an-object' })
        );

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should handle state with null projects', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue(
          JSON.stringify({ version: '1.0.0', projects: null })
        );

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.STATE_CORRUPTED,
        });
      });

      it('should include state path in error context', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue('invalid');

        try {
          await stateManager.initialize();
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(BTWError);
          expect((error as BTWError).context?.statePath).toBe(mockStatePath);
        }
      });
    });

    describe('missing file handling', () => {
      it('should throw with appropriate message when file not found and createIfMissing false', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(false);

        try {
          await stateManager.initialize({ createIfMissing: false });
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(BTWError);
          expect((error as BTWError).code).toBe(ErrorCode.STATE_NOT_FOUND);
          expect((error as BTWError).message).toContain(mockStatePath);
        }
      });

      it('should handle file disappearing between existence check and read', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockRejectedValue(
          new BTWError(ErrorCode.FILE_NOT_FOUND, 'File not found')
        );

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.FILE_NOT_FOUND,
        });
      });
    });

    describe('permission errors', () => {
      it('should propagate permission denied errors on read', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockRejectedValue(
          new BTWError(ErrorCode.PERMISSION_DENIED, 'Permission denied')
        );

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.PERMISSION_DENIED,
        });
      });

      it('should propagate permission denied errors on write', async () => {
        const mockState = createEmptyState();
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
        (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
        (fileSystem.writeFile as Mock).mockRejectedValue(
          new BTWError(ErrorCode.PERMISSION_DENIED, 'Permission denied')
        );

        await stateManager.initialize();
        stateManager.setActiveTarget('/project', 'claude');

        await expect(stateManager.save()).rejects.toMatchObject({
          code: ErrorCode.PERMISSION_DENIED,
        });
      });
    });

    describe('generic error wrapping', () => {
      it('should wrap unknown read errors as FILE_READ_ERROR', async () => {
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockRejectedValue(new Error('Unknown error'));

        await expect(stateManager.initialize()).rejects.toMatchObject({
          code: ErrorCode.FILE_READ_ERROR,
        });
      });

      it('should wrap unknown write errors as FILE_WRITE_ERROR', async () => {
        const mockState = createEmptyState();
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
        (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
        (fileSystem.writeFile as Mock).mockRejectedValue(new Error('Disk full'));

        await stateManager.initialize();
        stateManager.setActiveTarget('/project', 'claude');

        await expect(stateManager.save()).rejects.toMatchObject({
          code: ErrorCode.FILE_WRITE_ERROR,
        });
      });

      it('should preserve original error as cause', async () => {
        const originalError = new Error('Original error message');
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (fileSystem.readFile as Mock).mockRejectedValue(originalError);

        try {
          await stateManager.initialize();
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(BTWError);
          expect((error as BTWError).cause).toBe(originalError);
        }
      });
    });
  });

  // ============================================================================
  // SECTION 10: Constructor and default values
  // ============================================================================
  describe('constructor', () => {
    it('should use default state path when not provided', () => {
      const manager = new StateManager();
      // The default path is from constants which is mocked
      expect(manager).toBeDefined();
    });

    it('should use custom state path when provided', async () => {
      const customPath = '/custom/path/state.json';
      const manager = new StateManager(customPath);

      (fileSystem.exists as Mock).mockResolvedValue(false);
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

      await manager.initialize();

      expect(fileSystem.mkdir).toHaveBeenCalledWith('/custom/path');
    });
  });

  // ============================================================================
  // SECTION 11: Edge cases and integration scenarios
  // ============================================================================
  describe('edge cases', () => {
    beforeEach(async () => {
      const mockState = createEmptyState();
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);
      await stateManager.initialize();
    });

    it('should handle rapid successive operations', async () => {
      // Simulate rapid state changes
      for (let i = 0; i < 10; i++) {
        stateManager.addWorkflow(`/project-${i}`, createMockWorkflow(`wf-${i}`));
      }

      await stateManager.save();

      const state = stateManager.getState();
      expect(Object.keys(state.projects)).toHaveLength(10);
    });

    it('should handle empty project path (normalizer returns empty)', () => {
      (pathResolver.normalize as Mock).mockReturnValue('');

      // This tests edge case handling - empty normalized path
      stateManager.setActiveTarget('', 'claude');

      expect(stateManager.getState().projects['']).toBeDefined();
    });

    it('should handle special characters in project paths', () => {
      const specialPath = '/path/with spaces/and-dashes/and_underscores';

      stateManager.setActiveTarget(specialPath, 'claude');

      const projectState = stateManager.getProjectState(specialPath);
      expect(projectState).toBeDefined();
    });

    it('should handle Unicode in project paths', () => {
      const unicodePath = '/project/with/emoji/';

      stateManager.setActiveTarget(unicodePath, 'claude');

      const projectState = stateManager.getProjectState(unicodePath);
      expect(projectState).toBeDefined();
    });

    it('should handle very long project paths', () => {
      const longPath = '/' + 'a'.repeat(500);

      stateManager.setActiveTarget(longPath, 'claude');

      const projectState = stateManager.getProjectState(longPath);
      expect(projectState).toBeDefined();
    });

    it('should handle workflow with all optional fields', () => {
      const fullWorkflow: WorkflowState = {
        workflowId: 'full-workflow',
        version: '2.0.0',
        installedAt: new Date().toISOString(),
        lastInjectedAt: new Date().toISOString(),
        source: 'https://example.com/workflow',
        active: false,
        contentHash: 'abc123hash',
      };

      stateManager.addWorkflow('/project', fullWorkflow);

      const projectState = stateManager.getProjectState('/project');
      expect(projectState!.workflows[0]).toEqual(fullWorkflow);
    });

    it('should handle multiple workflows per project', () => {
      const projectPath = '/multi-workflow-project';

      for (let i = 0; i < 5; i++) {
        stateManager.addWorkflow(projectPath, createMockWorkflow(`wf-${i}`));
      }

      const projectState = stateManager.getProjectState(projectPath);
      expect(projectState!.workflows).toHaveLength(5);
    });

    it('should preserve workflow order', () => {
      const projectPath = '/ordered-project';
      const ids = ['first', 'second', 'third', 'fourth', 'fifth'];

      ids.forEach(id => {
        stateManager.addWorkflow(projectPath, createMockWorkflow(id));
      });

      const projectState = stateManager.getProjectState(projectPath);
      const retrievedIds = projectState!.workflows.map(w => w.workflowId);
      expect(retrievedIds).toEqual(ids);
    });
  });

  // ============================================================================
  // SECTION 12: State serialization
  // ============================================================================
  describe('state serialization', () => {
    it('should produce valid JSON on save', async () => {
      const mockState = createEmptyState();
      mockState.projects['/project'] = {
        ...createMockProjectState('/project'),
        workflows: [createMockWorkflow()],
        activeTarget: 'claude',
      };

      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(mockState));
      (fileSystem.mkdir as Mock).mockResolvedValue(undefined);
      (fileSystem.writeFile as Mock).mockResolvedValue(undefined);

      await stateManager.initialize();
      stateManager.setActiveTarget('/another', 'cursor');
      await stateManager.save();

      const writeCall = (fileSystem.writeFile as Mock).mock.calls[0];
      const writtenJson = writeCall[1];

      // Should be valid JSON
      expect(() => JSON.parse(writtenJson)).not.toThrow();
    });

    it('should preserve all state data through serialization cycle', async () => {
      const originalState = createEmptyState();
      originalState.projects['/project'] = {
        ...createMockProjectState('/project'),
        workflows: [createMockWorkflow('wf-1')],
        activeTarget: 'cursor',
      };
      originalState.globalConfig = {
        defaultTarget: 'claude',
        autoInject: true,
      };

      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.readFile as Mock).mockResolvedValue(JSON.stringify(originalState));

      await stateManager.initialize();

      const loadedState = stateManager.getState();
      expect(loadedState.globalConfig).toEqual(originalState.globalConfig);
      expect(loadedState.projects['/project'].workflows).toHaveLength(1);
    });
  });
});
