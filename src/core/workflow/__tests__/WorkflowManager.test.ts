/**
 * BTW - WorkflowManager Unit Tests
 * Comprehensive tests for workflow lifecycle management
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { WorkflowManager, AddWorkflowOptions, ListWorkflowsOptions, RemoveWorkflowOptions, WorkflowDetails } from '../WorkflowManager.js';
import { BTWError, ErrorCode } from '../../../types/errors.js';
import type { Manifest, WorkflowState, ProjectState, OperationResult } from '../../../types/index.js';

// Mock all dependencies
vi.mock('../../../infrastructure/git/GitClient.js', () => ({
  gitClient: {
    resolveGitHubUrl: vi.fn(),
    parseRepoIdentifier: vi.fn(),
    clone: vi.fn(),
    pull: vi.fn(),
    isRepository: vi.fn(),
    getCurrentCommit: vi.fn(),
  },
}));

vi.mock('../../manifest/ManifestParser.js', () => ({
  manifestParser: {
    parseFile: vi.fn(),
  },
}));

vi.mock('../../state/StateManager.js', () => ({
  stateManager: {
    initialize: vi.fn(),
    getProjectState: vi.fn(),
    addWorkflow: vi.fn(),
    removeWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock('../../../infrastructure/fs/FileSystem.js', () => ({
  fileSystem: {
    exists: vi.fn(),
    remove: vi.fn(),
    copy: vi.fn(),
  },
}));

vi.mock('../../../infrastructure/fs/PathResolver.js', () => ({
  pathResolver: {
    getWorkflowPath: vi.fn(),
    normalize: vi.fn((path: string) => path),
  },
}));

// Import mocked modules
import { gitClient } from '../../../infrastructure/git/GitClient.js';
import { manifestParser } from '../../manifest/ManifestParser.js';
import { stateManager } from '../../state/StateManager.js';
import { fileSystem } from '../../../infrastructure/fs/FileSystem.js';
import { pathResolver } from '../../../infrastructure/fs/PathResolver.js';

// Helper to create a mock manifest
function createMockManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    version: '1.0',
    id: 'test-workflow',
    name: 'Test Workflow',
    description: 'A test workflow',
    targets: ['claude'],
    agents: [
      {
        id: 'agent-1',
        name: 'Test Agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent.',
      },
    ],
    ...overrides,
  };
}

// Helper to create a mock workflow state
function createMockWorkflowState(overrides: Partial<WorkflowState> = {}): WorkflowState {
  return {
    workflowId: 'test-workflow',
    version: '1.0',
    installedAt: '2024-01-01T00:00:00.000Z',
    source: 'owner/repo',
    active: true,
    ...overrides,
  };
}

// Helper to create a mock project state
function createMockProjectState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    projectPath: '/test/project',
    workflows: [],
    initializedAt: '2024-01-01T00:00:00.000Z',
    lastModifiedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('WorkflowManager', () => {
  let workflowManager: WorkflowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    workflowManager = new WorkflowManager();

    // Default mock implementations
    (stateManager.initialize as Mock).mockResolvedValue(undefined);
    (stateManager.save as Mock).mockResolvedValue(undefined);
    (pathResolver.getWorkflowPath as Mock).mockImplementation((id: string) => `/workflows/${id}`);
    (pathResolver.normalize as Mock).mockImplementation((path: string) => path);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // add() - Install workflow from git/local/registry source
  // ==========================================================================
  describe('add()', () => {
    describe('Git URL Sources', () => {
      it('should add workflow from GitHub HTTPS URL', async () => {
        const source = 'https://github.com/owner/repo';
        const mockManifest = createMockManifest();

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo') return false;
          if (path === '/workflows/repo/btw.yaml') return true;
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/repo/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
        expect(result.data?.workflowId).toBe('repo');
        expect(gitClient.clone).toHaveBeenCalledWith(
          'https://github.com/owner/repo.git',
          expect.objectContaining({ targetDir: '/workflows/repo', depth: 1 })
        );
        expect(stateManager.addWorkflow).toHaveBeenCalled();
        expect(stateManager.save).toHaveBeenCalled();
      });

      it('should add workflow from owner/repo shorthand', async () => {
        const source = 'owner/repo';
        const mockManifest = createMockManifest();

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo') return false;
          if (path === '/workflows/repo/btw.yaml') return true;
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/repo/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
        expect(result.data?.workflowId).toBe('repo');
        expect(result.data?.source).toBe(source);
      });

      it('should add workflow from SSH git URL', async () => {
        const source = 'git@github.com:owner/repo.git';
        const mockManifest = createMockManifest();

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue(source);
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: source,
          type: 'github',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo') return false;
          if (path === '/workflows/repo/btw.yaml') return true;
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/repo/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
        expect(gitClient.clone).toHaveBeenCalled();
      });

      it('should add workflow from GitLab URL', async () => {
        const source = 'https://gitlab.com/owner/repo';
        const mockManifest = createMockManifest();

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://gitlab.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://gitlab.com/owner/repo.git',
          type: 'gitlab',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo') return false;
          if (path === '/workflows/repo/btw.yaml') return true;
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/repo/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
      });

      it('should add workflow from Bitbucket URL', async () => {
        const source = 'https://bitbucket.org/owner/repo';
        const mockManifest = createMockManifest();

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://bitbucket.org/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://bitbucket.org/owner/repo.git',
          type: 'bitbucket',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo') return false;
          if (path === '/workflows/repo/btw.yaml') return true;
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/repo/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
      });
    });

    describe('Local Path Sources', () => {
      it('should add workflow from absolute local path', async () => {
        const source = '/path/to/local/workflow';
        const mockManifest = createMockManifest({ id: 'local-workflow' });

        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === source) return true;
          if (path === `${source}/btw.yaml`) return true;
          if (path === '/workflows/local-workflow') return false;
          if (path === '/workflows/local-workflow/btw.yaml') return true;
          return false;
        });
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: `${source}/btw.yaml`,
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
        expect(result.data?.workflowId).toBe('local-workflow');
        expect(fileSystem.copy).toHaveBeenCalledWith(
          source,
          '/workflows/local-workflow',
          expect.objectContaining({ overwrite: undefined })
        );
      });

      it('should add workflow from relative path starting with ./', async () => {
        const source = './local/workflow';
        const normalizedSource = '/current/dir/local/workflow';
        const mockManifest = createMockManifest({ id: 'relative-workflow' });

        // Mock normalize to return an absolute path for relative source
        (pathResolver.normalize as Mock).mockImplementation((path: string) => {
          if (path === source) return normalizedSource;
          return path;
        });

        (fileSystem.exists as Mock).mockImplementation(async (checkPath: string) => {
          // Source directory exists
          if (checkPath === normalizedSource) return true;
          // Source manifest exists (path.join creates this)
          if (checkPath.endsWith('/current/dir/local/workflow/btw.yaml')) return true;
          // Workflow directory doesn't exist yet
          if (checkPath === '/workflows/relative-workflow') return false;
          // But manifest will exist after copy
          if (checkPath.endsWith('/workflows/relative-workflow/btw.yaml')) return true;
          return false;
        });
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/relative-workflow/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
        expect(result.data?.workflowId).toBe('relative-workflow');
      });

      it('should add workflow from parent relative path starting with ../', async () => {
        const source = '../parent/workflow';
        const normalizedSource = '/parent/dir/workflow';
        const mockManifest = createMockManifest({ id: 'parent-workflow' });

        // Mock normalize to return an absolute path for relative source
        (pathResolver.normalize as Mock).mockImplementation((path: string) => {
          if (path === source) return normalizedSource;
          return path;
        });

        (fileSystem.exists as Mock).mockImplementation(async (checkPath: string) => {
          // Source directory exists
          if (checkPath === normalizedSource) return true;
          // Source manifest exists (path.join creates this)
          if (checkPath.endsWith('/parent/dir/workflow/btw.yaml')) return true;
          // Workflow directory doesn't exist yet
          if (checkPath === '/workflows/parent-workflow') return false;
          // But manifest will exist after copy
          if (checkPath.endsWith('/workflows/parent-workflow/btw.yaml')) return true;
          return false;
        });
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/parent-workflow/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
        expect(result.data?.workflowId).toBe('parent-workflow');
      });

      it('should add workflow from home-relative path starting with ~', async () => {
        const source = '~/workflows/my-workflow';
        const normalizedSource = '/home/user/workflows/my-workflow';
        const mockManifest = createMockManifest({ id: 'home-workflow' });

        // Mock normalize to return an absolute path for home-relative source
        (pathResolver.normalize as Mock).mockImplementation((path: string) => {
          if (path === source) return normalizedSource;
          return path;
        });

        (fileSystem.exists as Mock).mockImplementation(async (checkPath: string) => {
          // Source directory exists
          if (checkPath === normalizedSource) return true;
          // Source manifest exists (path.join creates this)
          if (checkPath.endsWith('/home/user/workflows/my-workflow/btw.yaml')) return true;
          // Workflow directory doesn't exist yet
          if (checkPath === '/workflows/home-workflow') return false;
          // But manifest will exist after copy
          if (checkPath.endsWith('/workflows/home-workflow/btw.yaml')) return true;
          return false;
        });
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/home-workflow/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
        expect(result.data?.workflowId).toBe('home-workflow');
      });

      it('should use directory name as workflow ID when no manifest found locally', async () => {
        const source = '/path/to/my-custom-workflow';
        const mockManifest = createMockManifest();

        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === source) return true;
          if (path === `${source}/btw.yaml`) return false; // No manifest at source
          if (path === '/workflows/my-custom-workflow') return false;
          if (path === '/workflows/my-custom-workflow/btw.yaml') return true; // But found after copy
          return false;
        });
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/my-custom-workflow/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
        expect(result.data?.workflowId).toBe('my-custom-workflow');
      });
    });

    describe('Custom Workflow ID', () => {
      it('should use custom ID when provided for git source', async () => {
        const source = 'owner/repo';
        const customId = 'my-custom-id';
        const mockManifest = createMockManifest();

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === `/workflows/${customId}`) return false;
          if (path === `/workflows/${customId}/btw.yaml`) return true;
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: `/workflows/${customId}/btw.yaml`,
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source, customId });

        expect(result.success).toBe(true);
        expect(result.data?.workflowId).toBe(customId);
        expect(pathResolver.getWorkflowPath).toHaveBeenCalledWith(customId);
      });

      it('should use custom ID when provided for local source', async () => {
        const source = '/path/to/workflow';
        const customId = 'custom-local-id';
        const mockManifest = createMockManifest();

        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === source) return true;
          if (path === `${source}/btw.yaml`) return true;
          if (path === `/workflows/${customId}`) return false;
          if (path === `/workflows/${customId}/btw.yaml`) return true;
          return false;
        });
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: `/workflows/${customId}/btw.yaml`,
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source, customId });

        expect(result.success).toBe(true);
        expect(result.data?.workflowId).toBe(customId);
      });
    });

    describe('Force Overwrite', () => {
      it('should overwrite existing workflow when force is true', async () => {
        const source = 'owner/repo';
        const mockManifest = createMockManifest();
        const existingState = createMockProjectState({
          workflows: [createMockWorkflowState({ workflowId: 'repo' })],
        });

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo') return true; // Already exists
          if (path === '/workflows/repo/btw.yaml') return true;
          return false;
        });
        (fileSystem.remove as Mock).mockResolvedValue(undefined);
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/repo/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(existingState);
        (stateManager.addWorkflow as Mock).mockImplementation(() => {
          throw new BTWError(ErrorCode.WORKFLOW_ALREADY_EXISTS, 'Already exists');
        });

        const result = await workflowManager.add({ source, force: true });

        expect(result.success).toBe(true);
        expect(fileSystem.remove).toHaveBeenCalledWith('/workflows/repo', true);
        expect(stateManager.updateWorkflow).toHaveBeenCalled();
      });

      it('should fail when workflow exists and force is false', async () => {
        const source = 'owner/repo';
        const existingState = createMockProjectState({
          workflows: [createMockWorkflowState({ workflowId: 'repo' })],
        });

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockResolvedValue(true);
        (stateManager.getProjectState as Mock).mockReturnValue(existingState);

        const result = await workflowManager.add({ source, force: false });

        expect(result.success).toBe(false);
        expect(result.error).toContain('already installed');
        expect(gitClient.clone).not.toHaveBeenCalled();
      });

      it('should overwrite local workflow when force is true', async () => {
        const source = '/path/to/workflow';
        const mockManifest = createMockManifest({ id: 'local-wf' });
        const existingState = createMockProjectState({
          workflows: [createMockWorkflowState({ workflowId: 'local-wf' })],
        });

        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === source) return true;
          if (path === `${source}/btw.yaml`) return true;
          if (path === '/workflows/local-wf') return true;
          if (path === '/workflows/local-wf/btw.yaml') return true;
          return false;
        });
        (fileSystem.remove as Mock).mockResolvedValue(undefined);
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/local-wf/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(existingState);
        (stateManager.addWorkflow as Mock).mockImplementation(() => {
          throw new BTWError(ErrorCode.WORKFLOW_ALREADY_EXISTS, 'Already exists');
        });

        const result = await workflowManager.add({ source, force: true });

        expect(result.success).toBe(true);
        expect(fileSystem.remove).toHaveBeenCalled();
        expect(fileSystem.copy).toHaveBeenCalledWith(
          source,
          '/workflows/local-wf',
          expect.objectContaining({ overwrite: true })
        );
      });
    });

    describe('Error Handling', () => {
      it('should return error for invalid source format', async () => {
        const source = 'invalid-source-without-slash';

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid source format');
      });

      it('should return error when local path does not exist', async () => {
        const source = '/nonexistent/path';

        (fileSystem.exists as Mock).mockResolvedValue(false);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Source path not found');
      });

      it('should return error when git clone fails', async () => {
        const source = 'owner/repo';

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockResolvedValue(false);
        (gitClient.clone as Mock).mockRejectedValue(
          new BTWError(ErrorCode.GIT_CLONE_FAILED, 'Network error')
        );
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to clone');
      });

      it('should return error when manifest is not found after installation', async () => {
        const source = 'owner/repo';

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo') return false;
          if (path === '/workflows/repo/btw.yaml') return false; // Manifest not found
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (fileSystem.remove as Mock).mockResolvedValue(undefined);
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Manifest file');
        expect(fileSystem.remove).toHaveBeenCalledWith('/workflows/repo', true);
      });

      it('should return error when manifest parsing fails', async () => {
        const source = 'owner/repo';

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo') return false;
          if (path === '/workflows/repo/btw.yaml') return true;
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockRejectedValue(
          new BTWError(ErrorCode.MANIFEST_VALIDATION_ERROR, 'Invalid manifest')
        );
        (fileSystem.remove as Mock).mockResolvedValue(undefined);
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid manifest');
        expect(fileSystem.remove).toHaveBeenCalled();
      });

      it('should return error when local file copy fails', async () => {
        const source = '/path/to/workflow';

        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === source) return true;
          if (path === `${source}/btw.yaml`) return false;
          return false;
        });
        (fileSystem.copy as Mock).mockRejectedValue(new Error('Permission denied'));
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to copy');
      });

      it('should handle unexpected errors gracefully', async () => {
        const source = 'owner/repo';

        (gitClient.resolveGitHubUrl as Mock).mockImplementation(() => {
          throw new Error('Unexpected error');
        });

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unexpected error');
      });
    });

    describe('State Management', () => {
      it('should initialize state manager before operations', async () => {
        const source = 'owner/repo';
        const mockManifest = createMockManifest();

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo/btw.yaml') return true;
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/repo/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        await workflowManager.add({ source });

        expect(stateManager.initialize).toHaveBeenCalled();
      });

      it('should save state after successful add', async () => {
        const source = 'owner/repo';
        const mockManifest = createMockManifest();

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo/btw.yaml') return true;
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/repo/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        await workflowManager.add({ source });

        expect(stateManager.save).toHaveBeenCalled();
      });

      it('should include correct workflow state data', async () => {
        const source = 'owner/repo';
        const mockManifest = createMockManifest({ version: '2.0' });

        (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
        (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
          owner: 'owner',
          repo: 'repo',
          url: 'https://github.com/owner/repo.git',
          type: 'github',
        });
        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === '/workflows/repo/btw.yaml') return true;
          return false;
        });
        (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: mockManifest,
          sourcePath: '/workflows/repo/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        const result = await workflowManager.add({ source });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          workflowId: 'repo',
          version: '2.0',
          source: source,
          active: true,
        });
        expect(result.data?.installedAt).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // list() - List installed workflows with filtering
  // ==========================================================================
  describe('list()', () => {
    it('should return empty array when no workflows installed', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(null);

      const result = await workflowManager.list();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return empty array when project has no workflows', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [] })
      );

      const result = await workflowManager.list();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should return all installed workflows', async () => {
      const workflows = [
        createMockWorkflowState({ workflowId: 'workflow-1', active: true }),
        createMockWorkflowState({ workflowId: 'workflow-2', active: false }),
        createMockWorkflowState({ workflowId: 'workflow-3', active: true }),
      ];
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows })
      );

      const result = await workflowManager.list();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data?.map((d) => d.state.workflowId)).toEqual([
        'workflow-1',
        'workflow-2',
        'workflow-3',
      ]);
    });

    it('should filter by activeOnly when true', async () => {
      const workflows = [
        createMockWorkflowState({ workflowId: 'workflow-1', active: true }),
        createMockWorkflowState({ workflowId: 'workflow-2', active: false }),
        createMockWorkflowState({ workflowId: 'workflow-3', active: true }),
      ];
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows })
      );

      const result = await workflowManager.list({ activeOnly: true });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.every((d) => d.state.active)).toBe(true);
    });

    it('should include manifest when detailed is true', async () => {
      const mockManifest = createMockManifest({ id: 'workflow-1' });
      const workflows = [createMockWorkflowState({ workflowId: 'workflow-1' })];

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows })
      );
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: '/workflows/workflow-1/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });

      const result = await workflowManager.list({ detailed: true });

      expect(result.success).toBe(true);
      expect(result.data?.[0].manifest).toBeDefined();
      expect(result.data?.[0].manifest?.id).toBe('workflow-1');
    });

    it('should filter by tags when provided', async () => {
      const manifest1 = createMockManifest({
        id: 'workflow-1',
        agents: [{ id: 'a1', name: 'A1', description: '', systemPrompt: '', tags: ['frontend'] }],
      });
      const manifest2 = createMockManifest({
        id: 'workflow-2',
        agents: [{ id: 'a2', name: 'A2', description: '', systemPrompt: '', tags: ['backend'] }],
      });
      const workflows = [
        createMockWorkflowState({ workflowId: 'workflow-1' }),
        createMockWorkflowState({ workflowId: 'workflow-2' }),
      ];

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows })
      );
      (manifestParser.parseFile as Mock)
        .mockResolvedValueOnce({
          manifest: manifest1,
          sourcePath: '/workflows/workflow-1/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        })
        .mockResolvedValueOnce({
          manifest: manifest2,
          sourcePath: '/workflows/workflow-2/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });

      const result = await workflowManager.list({ detailed: true, tags: ['frontend'] });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].state.workflowId).toBe('workflow-1');
    });

    it('should handle manifest load errors gracefully in detailed mode', async () => {
      const workflows = [createMockWorkflowState({ workflowId: 'workflow-1' })];

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows })
      );
      (manifestParser.parseFile as Mock).mockRejectedValue(new Error('File not found'));

      const result = await workflowManager.list({ detailed: true });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].manifest).toBeUndefined();
    });

    it('should initialize state manager', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(null);

      await workflowManager.list();

      expect(stateManager.initialize).toHaveBeenCalled();
    });

    it('should return error on unexpected failure', async () => {
      (stateManager.initialize as Mock).mockRejectedValue(new Error('State corrupted'));

      const result = await workflowManager.list();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
    });
  });

  // ==========================================================================
  // get() - Retrieve specific workflow details
  // ==========================================================================
  describe('get()', () => {
    it('should return workflow details by ID', async () => {
      const mockManifest = createMockManifest({ id: 'my-workflow' });
      const workflowState = createMockWorkflowState({ workflowId: 'my-workflow' });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: '/workflows/my-workflow/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });

      const result = await workflowManager.get('my-workflow');

      expect(result.success).toBe(true);
      expect(result.data?.state.workflowId).toBe('my-workflow');
      expect(result.data?.manifest).toBeDefined();
    });

    it('should return error when workflow not found', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [] })
      );

      const result = await workflowManager.get('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Workflow not found');
    });

    it('should return error when project state is null', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(null);

      const result = await workflowManager.get('any-workflow');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Workflow not found');
    });

    it('should return workflow state even if manifest fails to load', async () => {
      const workflowState = createMockWorkflowState({ workflowId: 'my-workflow' });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (manifestParser.parseFile as Mock).mockRejectedValue(new Error('Manifest not found'));

      const result = await workflowManager.get('my-workflow');

      expect(result.success).toBe(true);
      expect(result.data?.state.workflowId).toBe('my-workflow');
      expect(result.data?.manifest).toBeUndefined();
    });

    it('should initialize state manager', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(null);

      await workflowManager.get('any');

      expect(stateManager.initialize).toHaveBeenCalled();
    });

    it('should handle BTWError correctly', async () => {
      (stateManager.initialize as Mock).mockRejectedValue(
        new BTWError(ErrorCode.STATE_CORRUPTED, 'State file corrupted')
      );

      const result = await workflowManager.get('any');

      expect(result.success).toBe(false);
      expect(result.error).toBe('State file corrupted');
    });
  });

  // ==========================================================================
  // remove() - Uninstall workflow
  // ==========================================================================
  describe('remove()', () => {
    it('should remove installed workflow', async () => {
      const workflowState = createMockWorkflowState({ workflowId: 'my-workflow' });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.remove as Mock).mockResolvedValue(undefined);

      const result = await workflowManager.remove({ workflowId: 'my-workflow' });

      expect(result.success).toBe(true);
      expect(fileSystem.remove).toHaveBeenCalledWith('/workflows/my-workflow', true);
      expect(stateManager.removeWorkflow).toHaveBeenCalled();
      expect(stateManager.save).toHaveBeenCalled();
    });

    it('should return error when workflow not installed', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [] })
      );
      (fileSystem.exists as Mock).mockResolvedValue(false);

      const result = await workflowManager.remove({ workflowId: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not installed');
    });

    it('should handle file removal errors gracefully when file not found', async () => {
      const workflowState = createMockWorkflowState({ workflowId: 'my-workflow' });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.remove as Mock).mockRejectedValue(
        new BTWError(ErrorCode.FILE_NOT_FOUND, 'Directory not found')
      );

      const result = await workflowManager.remove({ workflowId: 'my-workflow' });

      // Should still succeed since workflow was in state
      expect(result.success).toBe(true);
      expect(stateManager.removeWorkflow).toHaveBeenCalled();
    });

    it('should return error on other file removal errors', async () => {
      const workflowState = createMockWorkflowState({ workflowId: 'my-workflow' });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.remove as Mock).mockRejectedValue(
        new BTWError(ErrorCode.PERMISSION_DENIED, 'Permission denied')
      );

      const result = await workflowManager.remove({ workflowId: 'my-workflow' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to remove');
    });

    it('should handle state removal errors gracefully when workflow not in state', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [] })
      );
      (fileSystem.exists as Mock).mockResolvedValue(true); // Files exist but not in state
      (fileSystem.remove as Mock).mockResolvedValue(undefined);
      (stateManager.removeWorkflow as Mock).mockImplementation(() => {
        throw new BTWError(ErrorCode.WORKFLOW_NOT_FOUND, 'Not found in state');
      });

      // isInstalled returns true because files exist
      const result = await workflowManager.remove({ workflowId: 'orphan-workflow' });

      // Should still succeed because we cleaned up the files
      expect(result.success).toBe(true);
    });

    it('should initialize state manager', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(null);
      (fileSystem.exists as Mock).mockResolvedValue(false);

      await workflowManager.remove({ workflowId: 'any' });

      expect(stateManager.initialize).toHaveBeenCalled();
    });

    it('should handle unexpected errors', async () => {
      (stateManager.initialize as Mock).mockRejectedValue(new Error('Unexpected'));

      const result = await workflowManager.remove({ workflowId: 'any' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
    });
  });

  // ==========================================================================
  // update() - Update workflow from git source
  // ==========================================================================
  describe('update()', () => {
    it('should update workflow from git source', async () => {
      const mockManifest = createMockManifest({ version: '2.0' });
      const workflowState = createMockWorkflowState({
        workflowId: 'my-workflow',
        source: 'owner/repo',
        version: '1.0',
      });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: '/workflows/my-workflow/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });
      (gitClient.isRepository as Mock).mockResolvedValue(true);
      (gitClient.pull as Mock).mockResolvedValue({ success: true, exitCode: 0 });
      (gitClient.getCurrentCommit as Mock).mockResolvedValue('abc123');

      const result = await workflowManager.update('my-workflow');

      expect(result.success).toBe(true);
      expect(result.data?.version).toBe('2.0');
      expect(result.data?.contentHash).toBe('abc123');
      expect(gitClient.pull).toHaveBeenCalledWith({ repoDir: '/workflows/my-workflow' });
      expect(stateManager.updateWorkflow).toHaveBeenCalled();
      expect(stateManager.save).toHaveBeenCalled();
    });

    it('should return error when workflow not found', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [] })
      );

      const result = await workflowManager.update('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Workflow not found');
    });

    it('should return error when source is local path', async () => {
      const workflowState = createMockWorkflowState({
        workflowId: 'local-workflow',
        source: '/path/to/local',
      });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: createMockManifest(),
        sourcePath: '/workflows/local-workflow/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });

      const result = await workflowManager.update('local-workflow');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot update workflow from local path');
    });

    it('should return error when directory is not a git repository', async () => {
      const workflowState = createMockWorkflowState({
        workflowId: 'my-workflow',
        source: 'owner/repo',
      });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: createMockManifest(),
        sourcePath: '/workflows/my-workflow/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });
      (gitClient.isRepository as Mock).mockResolvedValue(false);

      const result = await workflowManager.update('my-workflow');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a git repository');
    });

    it('should return error when git pull fails', async () => {
      const workflowState = createMockWorkflowState({
        workflowId: 'my-workflow',
        source: 'owner/repo',
      });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: createMockManifest(),
        sourcePath: '/workflows/my-workflow/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });
      (gitClient.isRepository as Mock).mockResolvedValue(true);
      (gitClient.pull as Mock).mockRejectedValue(new Error('Network error'));

      const result = await workflowManager.update('my-workflow');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to pull');
    });

    it('should keep existing version when manifest re-parse fails', async () => {
      const workflowState = createMockWorkflowState({
        workflowId: 'my-workflow',
        source: 'owner/repo',
        version: '1.0',
      });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      // First call for get() succeeds
      (manifestParser.parseFile as Mock)
        .mockResolvedValueOnce({
          manifest: createMockManifest({ version: '1.0' }),
          sourcePath: '/workflows/my-workflow/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        })
        // Second call after pull fails
        .mockRejectedValueOnce(new Error('Parse error'));
      (gitClient.isRepository as Mock).mockResolvedValue(true);
      (gitClient.pull as Mock).mockResolvedValue({ success: true, exitCode: 0 });
      (gitClient.getCurrentCommit as Mock).mockResolvedValue('def456');

      const result = await workflowManager.update('my-workflow');

      expect(result.success).toBe(true);
      expect(result.data?.version).toBe('1.0'); // Kept original version
      expect(result.data?.contentHash).toBe('def456');
    });

    it('should handle commit hash retrieval errors gracefully', async () => {
      const workflowState = createMockWorkflowState({
        workflowId: 'my-workflow',
        source: 'owner/repo',
      });
      const mockManifest = createMockManifest({ version: '2.0' });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: '/workflows/my-workflow/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });
      (gitClient.isRepository as Mock).mockResolvedValue(true);
      (gitClient.pull as Mock).mockResolvedValue({ success: true, exitCode: 0 });
      (gitClient.getCurrentCommit as Mock).mockRejectedValue(new Error('Not a git repo'));

      const result = await workflowManager.update('my-workflow');

      expect(result.success).toBe(true);
      expect(result.data?.contentHash).toBeUndefined();
    });

    it('should recognize owner/repo format as git source', async () => {
      const workflowState = createMockWorkflowState({
        workflowId: 'my-workflow',
        source: 'owner/repo',
      });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: createMockManifest(),
        sourcePath: '/workflows/my-workflow/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });
      (gitClient.isRepository as Mock).mockResolvedValue(true);
      (gitClient.pull as Mock).mockResolvedValue({ success: true, exitCode: 0 });
      (gitClient.getCurrentCommit as Mock).mockResolvedValue('abc123');

      const result = await workflowManager.update('my-workflow');

      expect(result.success).toBe(true);
      expect(gitClient.pull).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // validate() - Validate workflow manifest
  // ==========================================================================
  describe('validate()', () => {
    it('should return parsed manifest on valid manifest', async () => {
      const mockManifest = createMockManifest();

      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: '/path/to/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });

      const result = await workflowManager.validate('/path/to/btw.yaml');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockManifest);
    });

    it('should return error on invalid manifest', async () => {
      (manifestParser.parseFile as Mock).mockRejectedValue(
        new BTWError(ErrorCode.MANIFEST_VALIDATION_ERROR, 'Missing required field: id')
      );

      const result = await workflowManager.validate('/path/to/invalid.yaml');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required field');
    });

    it('should return error when manifest file not found', async () => {
      (manifestParser.parseFile as Mock).mockRejectedValue(
        new BTWError(ErrorCode.MANIFEST_NOT_FOUND, 'Manifest not found')
      );

      const result = await workflowManager.validate('/nonexistent/btw.yaml');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Manifest not found');
    });

    it('should return error on YAML parse errors', async () => {
      (manifestParser.parseFile as Mock).mockRejectedValue(
        new BTWError(ErrorCode.MANIFEST_PARSE_ERROR, 'Invalid YAML syntax')
      );

      const result = await workflowManager.validate('/path/to/malformed.yaml');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid YAML');
    });

    it('should handle unexpected errors', async () => {
      (manifestParser.parseFile as Mock).mockRejectedValue(new Error('Unexpected'));

      const result = await workflowManager.validate('/path/to/btw.yaml');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to validate manifest');
    });
  });

  // ==========================================================================
  // isInstalled() - Check if workflow is installed
  // ==========================================================================
  describe('isInstalled()', () => {
    it('should return true when workflow exists in state and files exist', async () => {
      const workflowState = createMockWorkflowState({ workflowId: 'my-workflow' });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (fileSystem.exists as Mock).mockResolvedValue(true);

      const result = await workflowManager.isInstalled('my-workflow');

      expect(result).toBe(true);
    });

    it('should return true when workflow exists in state but files missing', async () => {
      const workflowState = createMockWorkflowState({ workflowId: 'my-workflow' });

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (fileSystem.exists as Mock).mockResolvedValue(false);

      const result = await workflowManager.isInstalled('my-workflow');

      expect(result).toBe(true); // Still returns true because it's in state
    });

    it('should return true when files exist but not in state', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [] })
      );
      (fileSystem.exists as Mock).mockResolvedValue(true);

      const result = await workflowManager.isInstalled('orphan-workflow');

      expect(result).toBe(true); // Returns true because files exist
    });

    it('should return false when workflow not in state and files missing', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [] })
      );
      (fileSystem.exists as Mock).mockResolvedValue(false);

      const result = await workflowManager.isInstalled('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when project state is null and files missing', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(null);
      (fileSystem.exists as Mock).mockResolvedValue(false);

      const result = await workflowManager.isInstalled('nonexistent');

      expect(result).toBe(false);
    });

    it('should return false on any error', async () => {
      (stateManager.initialize as Mock).mockRejectedValue(new Error('Init failed'));

      const result = await workflowManager.isInstalled('any');

      expect(result).toBe(false);
    });

    it('should initialize state manager', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(null);
      (fileSystem.exists as Mock).mockResolvedValue(false);

      await workflowManager.isInstalled('any');

      expect(stateManager.initialize).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Private method tests via public API behavior
  // ==========================================================================
  describe('Source Type Detection', () => {
    describe('Git URL Detection', () => {
      const gitSources = [
        'https://github.com/owner/repo',
        'https://gitlab.com/owner/repo',
        'https://bitbucket.org/owner/repo',
        'git@github.com:owner/repo.git',
        'owner/repo',
      ];

      gitSources.forEach((source) => {
        it(`should detect "${source}" as git source`, async () => {
          (gitClient.resolveGitHubUrl as Mock).mockReturnValue(`${source}.git`);
          (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
            owner: 'owner',
            repo: 'repo',
            url: `${source}.git`,
            type: 'github',
          });
          (fileSystem.exists as Mock).mockResolvedValue(false);
          (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
          (manifestParser.parseFile as Mock).mockResolvedValue({
            manifest: createMockManifest(),
            sourcePath: '/workflows/repo/btw.yaml',
            parsedAt: new Date(),
            rawContent: '',
          });
          (stateManager.getProjectState as Mock).mockReturnValue(null);

          await workflowManager.add({ source });

          expect(gitClient.clone).toHaveBeenCalled();
          expect(fileSystem.copy).not.toHaveBeenCalled();
        });
      });
    });

    describe('Local Path Detection', () => {
      it('should detect "/absolute/path/to/workflow" as local path', async () => {
        const source = '/absolute/path/to/workflow';

        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === source) return true;
          if (path === `${source}/btw.yaml`) return false;
          if (path.includes('/workflows/')) return false;
          if (path.includes('/btw.yaml')) return true;
          return false;
        });
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: createMockManifest(),
          sourcePath: '/workflows/workflow/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        await workflowManager.add({ source });

        expect(fileSystem.copy).toHaveBeenCalled();
        expect(gitClient.clone).not.toHaveBeenCalled();
      });

      it('should detect "./relative/path" as local path', async () => {
        const source = './relative/path';
        const normalizedSource = '/current/relative/path';

        (pathResolver.normalize as Mock).mockImplementation((path: string) => {
          if (path === source) return normalizedSource;
          return path;
        });

        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === normalizedSource) return true;
          if (path === `${normalizedSource}/btw.yaml`) return false;
          if (path.includes('/workflows/')) return false;
          if (path.includes('/btw.yaml')) return true;
          return false;
        });
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: createMockManifest(),
          sourcePath: '/workflows/workflow/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        await workflowManager.add({ source });

        expect(fileSystem.copy).toHaveBeenCalled();
        expect(gitClient.clone).not.toHaveBeenCalled();
      });

      it('should detect "../parent/path" as local path', async () => {
        const source = '../parent/path';
        const normalizedSource = '/parent/path';

        (pathResolver.normalize as Mock).mockImplementation((path: string) => {
          if (path === source) return normalizedSource;
          return path;
        });

        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === normalizedSource) return true;
          if (path === `${normalizedSource}/btw.yaml`) return false;
          if (path.includes('/workflows/')) return false;
          if (path.includes('/btw.yaml')) return true;
          return false;
        });
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: createMockManifest(),
          sourcePath: '/workflows/workflow/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        await workflowManager.add({ source });

        expect(fileSystem.copy).toHaveBeenCalled();
        expect(gitClient.clone).not.toHaveBeenCalled();
      });

      it('should detect "~/home/path" as local path', async () => {
        const source = '~/home/path';
        const normalizedSource = '/home/user/home/path';

        (pathResolver.normalize as Mock).mockImplementation((path: string) => {
          if (path === source) return normalizedSource;
          return path;
        });

        (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
          if (path === normalizedSource) return true;
          if (path === `${normalizedSource}/btw.yaml`) return false;
          if (path.includes('/workflows/')) return false;
          if (path.includes('/btw.yaml')) return true;
          return false;
        });
        (fileSystem.copy as Mock).mockResolvedValue(undefined);
        (manifestParser.parseFile as Mock).mockResolvedValue({
          manifest: createMockManifest(),
          sourcePath: '/workflows/workflow/btw.yaml',
          parsedAt: new Date(),
          rawContent: '',
        });
        (stateManager.getProjectState as Mock).mockReturnValue(null);

        await workflowManager.add({ source });

        expect(fileSystem.copy).toHaveBeenCalled();
        expect(gitClient.clone).not.toHaveBeenCalled();
      });
    });

    describe('Invalid Source Detection', () => {
      const invalidSources = [
        'single-word-no-slash',
        'not:a:valid:source',
        '',
      ];

      invalidSources.forEach((source) => {
        it(`should reject "${source || '(empty string)'}" as invalid source`, async () => {
          const result = await workflowManager.add({ source });

          expect(result.success).toBe(false);
          if (source) {
            expect(result.error).toContain('Invalid source format');
          }
        });
      });
    });
  });

  // ==========================================================================
  // Edge Cases and Complex Scenarios
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle concurrent operations gracefully', async () => {
      const mockManifest = createMockManifest();

      (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
      (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo.git',
        type: 'github',
      });
      (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
        // Workflow directories don't exist yet, but manifest will exist after clone
        if (path.includes('/workflows/workflow-1')) {
          return path.includes('btw.yaml');
        }
        if (path.includes('/workflows/workflow-2')) {
          return path.includes('btw.yaml');
        }
        return false;
      });
      (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: '/workflows/repo/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });
      (stateManager.getProjectState as Mock).mockReturnValue(null);

      // Simulate concurrent add operations
      const results = await Promise.all([
        workflowManager.add({ source: 'owner/repo', customId: 'workflow-1' }),
        workflowManager.add({ source: 'owner/repo', customId: 'workflow-2' }),
      ]);

      // Both should succeed (they have different IDs)
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle very long workflow IDs', async () => {
      const longId = 'a'.repeat(255);
      const source = `/path/to/${longId}`;
      const mockManifest = createMockManifest({ id: longId });

      (fileSystem.exists as Mock).mockImplementation(async (checkPath: string) => {
        // Source directory exists
        if (checkPath === source) return true;
        // Source manifest exists
        if (checkPath === `${source}/btw.yaml`) return true;
        // Workflow directory doesn't exist yet
        if (checkPath === `/workflows/${longId}`) return false;
        // But manifest will exist after copy
        if (checkPath === `/workflows/${longId}/btw.yaml`) return true;
        return false;
      });
      (fileSystem.copy as Mock).mockResolvedValue(undefined);
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: `/workflows/${longId}/btw.yaml`,
        parsedAt: new Date(),
        rawContent: '',
      });
      (stateManager.getProjectState as Mock).mockReturnValue(null);

      const result = await workflowManager.add({ source });

      expect(result.success).toBe(true);
      expect(result.data?.workflowId).toBe(longId);
    });

    it('should handle workflow ID with special characters', async () => {
      const customId = 'my-workflow_v2.0';
      const mockManifest = createMockManifest();

      (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
      (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo.git',
        type: 'github',
      });
      (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
        if (path.includes(`/workflows/${customId}`)) {
          return path.includes('btw.yaml');
        }
        return false;
      });
      (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: `/workflows/${customId}/btw.yaml`,
        parsedAt: new Date(),
        rawContent: '',
      });
      (stateManager.getProjectState as Mock).mockReturnValue(null);

      const result = await workflowManager.add({ source: 'owner/repo', customId });

      expect(result.success).toBe(true);
      expect(result.data?.workflowId).toBe(customId);
    });

    it('should handle workflow with multiple agents', async () => {
      const mockManifest = createMockManifest({
        agents: [
          { id: 'agent-1', name: 'Agent 1', description: '', systemPrompt: 'prompt 1', tags: ['frontend'] },
          { id: 'agent-2', name: 'Agent 2', description: '', systemPrompt: 'prompt 2', tags: ['backend'] },
          { id: 'agent-3', name: 'Agent 3', description: '', systemPrompt: 'prompt 3', tags: ['devops'] },
        ],
      });

      (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
      (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo.git',
        type: 'github',
      });
      (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
        if (path === '/workflows/repo') return false;
        if (path === '/workflows/repo/btw.yaml') return true;
        return false;
      });
      (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: '/workflows/repo/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });
      (stateManager.getProjectState as Mock).mockReturnValue(null);

      const result = await workflowManager.add({ source: 'owner/repo' });

      expect(result.success).toBe(true);
    });

    it('should handle empty workflows array in filter operations', async () => {
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [] })
      );

      const result = await workflowManager.list({ activeOnly: true, tags: ['frontend'] });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle workflows with no tags when filtering by tags', async () => {
      const manifest = createMockManifest({
        agents: [{ id: 'a1', name: 'A1', description: '', systemPrompt: '' }], // No tags
      });
      const workflows = [createMockWorkflowState({ workflowId: 'workflow-1' })];

      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows })
      );
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest,
        sourcePath: '/workflows/workflow-1/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });

      const result = await workflowManager.list({ detailed: true, tags: ['frontend'] });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0); // Filtered out because no matching tags
    });
  });

  // ==========================================================================
  // Integration-like scenarios (still using mocks but testing flow)
  // ==========================================================================
  describe('Workflow Lifecycle', () => {
    it('should support add -> get -> update -> remove lifecycle', async () => {
      const mockManifest = createMockManifest({ id: 'lifecycle-test', version: '1.0' });

      // Setup for add
      (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
      (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
        owner: 'owner',
        repo: 'lifecycle-test',
        url: 'https://github.com/owner/repo.git',
        type: 'github',
      });
      (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
        return path.includes('/btw.yaml');
      });
      (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: '/workflows/lifecycle-test/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });
      (stateManager.getProjectState as Mock).mockReturnValue(null);

      // 1. Add workflow
      const addResult = await workflowManager.add({ source: 'owner/lifecycle-test' });
      expect(addResult.success).toBe(true);

      // Setup for get/update
      const workflowState = createMockWorkflowState({
        workflowId: 'lifecycle-test',
        source: 'owner/lifecycle-test',
        version: '1.0',
      });
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );

      // 2. Get workflow
      const getResult = await workflowManager.get('lifecycle-test');
      expect(getResult.success).toBe(true);
      expect(getResult.data?.state.workflowId).toBe('lifecycle-test');

      // 3. Update workflow
      const updatedManifest = createMockManifest({ id: 'lifecycle-test', version: '2.0' });
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: updatedManifest,
        sourcePath: '/workflows/lifecycle-test/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });
      (gitClient.isRepository as Mock).mockResolvedValue(true);
      (gitClient.pull as Mock).mockResolvedValue({ success: true, exitCode: 0 });
      (gitClient.getCurrentCommit as Mock).mockResolvedValue('newcommit');

      const updateResult = await workflowManager.update('lifecycle-test');
      expect(updateResult.success).toBe(true);
      expect(updateResult.data?.version).toBe('2.0');

      // 4. Remove workflow
      (fileSystem.remove as Mock).mockResolvedValue(undefined);

      const removeResult = await workflowManager.remove({ workflowId: 'lifecycle-test' });
      expect(removeResult.success).toBe(true);
    });

    it('should support re-adding a removed workflow', async () => {
      const mockManifest = createMockManifest();

      // First add
      (gitClient.resolveGitHubUrl as Mock).mockReturnValue('https://github.com/owner/repo.git');
      (gitClient.parseRepoIdentifier as Mock).mockReturnValue({
        owner: 'owner',
        repo: 'repo',
        url: 'https://github.com/owner/repo.git',
        type: 'github',
      });
      (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
        if (path === '/workflows/repo') return false;
        if (path === '/workflows/repo/btw.yaml') return true;
        return false;
      });
      (gitClient.clone as Mock).mockResolvedValue({ success: true, exitCode: 0 });
      (manifestParser.parseFile as Mock).mockResolvedValue({
        manifest: mockManifest,
        sourcePath: '/workflows/repo/btw.yaml',
        parsedAt: new Date(),
        rawContent: '',
      });
      (stateManager.getProjectState as Mock).mockReturnValue(null);

      const firstAdd = await workflowManager.add({ source: 'owner/repo' });
      expect(firstAdd.success).toBe(true);

      // Remove
      const workflowState = createMockWorkflowState({ workflowId: 'repo' });
      (stateManager.getProjectState as Mock).mockReturnValue(
        createMockProjectState({ workflows: [workflowState] })
      );
      (fileSystem.exists as Mock).mockResolvedValue(true);
      (fileSystem.remove as Mock).mockResolvedValue(undefined);

      const removeResult = await workflowManager.remove({ workflowId: 'repo' });
      expect(removeResult.success).toBe(true);

      // Re-add (reset mocks for clean state)
      (stateManager.getProjectState as Mock).mockReturnValue(null);
      (fileSystem.exists as Mock).mockImplementation(async (path: string) => {
        if (path === '/workflows/repo') return false;
        if (path === '/workflows/repo/btw.yaml') return true;
        return false;
      });

      const secondAdd = await workflowManager.add({ source: 'owner/repo' });
      expect(secondAdd.success).toBe(true);
    });
  });
});
