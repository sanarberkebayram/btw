/**
 * BTW - InjectionEngine Unit Tests
 * Comprehensive tests for the InjectionEngine orchestration layer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  InjectionStrategy,
  InjectOptions,
  EjectOptions,
  InjectionStatus,
} from '../strategies/InjectionStrategy.js';
import { AITarget, Manifest, InjectionResult } from '../../../types/index.js';
import { BTWError, ErrorCode } from '../../../types/errors.js';

// Mock the file system
vi.mock('../../../infrastructure/fs/FileSystem.js', () => ({
  fileSystem: {
    exists: vi.fn().mockResolvedValue(false),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    backup: vi.fn().mockResolvedValue('/test/backup.btw-backup'),
    restore: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the path resolver
vi.mock('../../../infrastructure/fs/PathResolver.js', () => ({
  pathResolver: {
    resolveAiToolPaths: vi.fn((projectRoot: string, target: string) => ({
      configPath: `${projectRoot}/.${target}/settings.json`,
      instructionsPath: `${projectRoot}/.${target}/instructions.md`,
      projectConfigPath: `${projectRoot}/.${target}/project.json`,
    })),
    normalize: vi.fn((path: string) => path),
  },
}));

// Mock state manager
vi.mock('../../state/StateManager.js', () => ({
  stateManager: {
    getProjectState: vi.fn(),
    updateWorkflow: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocks are set up
import { InjectionEngine } from '../InjectionEngine.js';
import { stateManager } from '../../state/StateManager.js';
import { fileSystem } from '../../../infrastructure/fs/FileSystem.js';

/**
 * Create a mock injection strategy for testing
 */
function createMockStrategy(target: AITarget): InjectionStrategy {
  return {
    target,
    canHandle: vi.fn().mockImplementation((t: AITarget) => t === target),
    inject: vi.fn().mockResolvedValue({
      target,
      configPath: `/project/.${target}/instructions.md`,
      agentCount: 1,
      backupCreated: false,
    } as InjectionResult),
    eject: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({
      isInjected: false,
      hasBackup: false,
    } as InjectionStatus),
    validate: vi.fn().mockResolvedValue(true),
    generateConfig: vi.fn().mockReturnValue('{}'),
    generateInstructions: vi.fn().mockReturnValue('# Instructions'),
  };
}

/**
 * Create a test manifest
 */
function createTestManifest(overrides?: Partial<Manifest>): Manifest {
  return {
    version: '1.0',
    id: 'test-workflow',
    name: 'Test Workflow',
    description: 'A test workflow for unit tests',
    targets: ['claude'] as AITarget[],
    agents: [
      {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        systemPrompt: 'You are a test agent.',
      },
    ],
    ...overrides,
  };
}

describe('InjectionEngine', () => {
  let engine: InjectionEngine;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset fileSystem mock defaults
    vi.mocked(fileSystem.exists).mockResolvedValue(false);
    vi.mocked(fileSystem.readFile).mockResolvedValue('');
    vi.mocked(fileSystem.writeFile).mockResolvedValue(undefined);
    vi.mocked(fileSystem.mkdir).mockResolvedValue(undefined);
    vi.mocked(fileSystem.remove).mockResolvedValue(undefined);
    vi.mocked(fileSystem.backup).mockResolvedValue('/test/backup.btw-backup');
    vi.mocked(fileSystem.restore).mockResolvedValue(undefined);

    // Create engine - includes default ClaudeStrategy
    engine = new InjectionEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and strategy management', () => {
    describe('registerStrategy()', () => {
      it('should register a new strategy', () => {
        const mockStrategy = createMockStrategy('cursor');
        engine.registerStrategy(mockStrategy);

        expect(engine.getStrategy('cursor')).toBe(mockStrategy);
      });

      it('should override existing strategy for the same target', () => {
        const firstStrategy = createMockStrategy('cursor');
        const secondStrategy = createMockStrategy('cursor');

        engine.registerStrategy(firstStrategy);
        engine.registerStrategy(secondStrategy);

        expect(engine.getStrategy('cursor')).toBe(secondStrategy);
        expect(engine.getStrategy('cursor')).not.toBe(firstStrategy);
      });

      it('should allow registering multiple strategies for different targets', () => {
        const cursorStrategy = createMockStrategy('cursor');
        const windsurfStrategy = createMockStrategy('windsurf');

        engine.registerStrategy(cursorStrategy);
        engine.registerStrategy(windsurfStrategy);

        expect(engine.getStrategy('cursor')).toBe(cursorStrategy);
        expect(engine.getStrategy('windsurf')).toBe(windsurfStrategy);
      });
    });

    describe('getStrategy()', () => {
      it('should return registered strategy', () => {
        const mockStrategy = createMockStrategy('cursor');
        engine.registerStrategy(mockStrategy);

        const result = engine.getStrategy('cursor');

        expect(result).toBe(mockStrategy);
      });

      it('should return undefined for unregistered target', () => {
        const result = engine.getStrategy('copilot');

        expect(result).toBeUndefined();
      });

      it('should return the default claude strategy', () => {
        // The constructor registers ClaudeStrategy by default
        const result = engine.getStrategy('claude');

        expect(result).toBeDefined();
        expect(result?.target).toBe('claude');
      });
    });

    describe('isTargetSupported()', () => {
      it('should return true for supported target', () => {
        const mockStrategy = createMockStrategy('cursor');
        engine.registerStrategy(mockStrategy);

        expect(engine.isTargetSupported('cursor')).toBe(true);
      });

      it('should return false for unsupported target', () => {
        expect(engine.isTargetSupported('windsurf')).toBe(false);
      });

      it('should return true for default claude target', () => {
        expect(engine.isTargetSupported('claude')).toBe(true);
      });
    });

    describe('getSupportedTargets()', () => {
      it('should return array of registered targets', () => {
        const cursorStrategy = createMockStrategy('cursor');
        const windsurfStrategy = createMockStrategy('windsurf');

        engine.registerStrategy(cursorStrategy);
        engine.registerStrategy(windsurfStrategy);

        const targets = engine.getSupportedTargets();

        expect(targets).toContain('claude'); // default
        expect(targets).toContain('cursor');
        expect(targets).toContain('windsurf');
      });

      it('should return only default targets initially', () => {
        const targets = engine.getSupportedTargets();

        expect(targets).toContain('claude');
        expect(targets).toHaveLength(1);
      });
    });

    describe('constructor options', () => {
      it('should register custom strategies from options', () => {
        const customStrategy = createMockStrategy('cursor');

        const customEngine = new InjectionEngine({
          strategies: [customStrategy],
        });

        expect(customEngine.getStrategy('cursor')).toBe(customStrategy);
      });

      it('should register multiple custom strategies', () => {
        const cursorStrategy = createMockStrategy('cursor');
        const windsurfStrategy = createMockStrategy('windsurf');

        const customEngine = new InjectionEngine({
          strategies: [cursorStrategy, windsurfStrategy],
        });

        expect(customEngine.getStrategy('cursor')).toBe(cursorStrategy);
        expect(customEngine.getStrategy('windsurf')).toBe(windsurfStrategy);
      });
    });
  });

  describe('validateManifestForTarget()', () => {
    it('should return true when manifest includes target', () => {
      const manifest = createTestManifest({ targets: ['claude', 'cursor'] });

      expect(engine.validateManifestForTarget(manifest, 'claude')).toBe(true);
      expect(engine.validateManifestForTarget(manifest, 'cursor')).toBe(true);
    });

    it('should return false when manifest does not include target', () => {
      const manifest = createTestManifest({ targets: ['claude'] });

      expect(engine.validateManifestForTarget(manifest, 'cursor')).toBe(false);
      expect(engine.validateManifestForTarget(manifest, 'windsurf')).toBe(false);
    });

    it('should return false for empty targets array', () => {
      const manifest = createTestManifest({ targets: [] });

      expect(engine.validateManifestForTarget(manifest, 'claude')).toBe(false);
    });
  });

  describe('inject()', () => {
    const projectRoot = '/test/project';
    const options: InjectOptions = { projectRoot };

    it('should successfully inject a workflow', async () => {
      const manifest = createTestManifest();
      vi.mocked(stateManager.getProjectState).mockReturnValue(undefined);

      const result = await engine.inject(manifest, 'claude', options);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.target).toBe('claude');
      expect(result.data?.agentCount).toBe(1);
    });

    it('should throw BTWError for unsupported target', async () => {
      const manifest = createTestManifest({ targets: ['cursor'] });

      await expect(engine.inject(manifest, 'cursor', options)).rejects.toThrow(BTWError);
      await expect(engine.inject(manifest, 'cursor', options)).rejects.toMatchObject({
        code: ErrorCode.TARGET_NOT_SUPPORTED,
      });
    });

    it('should return failure when manifest does not support target', async () => {
      const manifest = createTestManifest({ targets: ['cursor'] });

      const result = await engine.inject(manifest, 'claude', options);

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not support target 'claude'");
    });

    it('should update state manager on successful injection', async () => {
      const manifest = createTestManifest();
      vi.mocked(stateManager.getProjectState).mockReturnValue({
        projectPath: projectRoot,
        workflows: [
          {
            workflowId: 'test-workflow',
            version: '1.0',
            installedAt: new Date().toISOString(),
            source: 'local',
            active: true,
          },
        ],
        initializedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
      });

      await engine.inject(manifest, 'claude', options);

      expect(stateManager.updateWorkflow).toHaveBeenCalledWith(
        projectRoot,
        'test-workflow',
        expect.objectContaining({
          lastInjectedAt: expect.any(String),
        })
      );
      expect(stateManager.save).toHaveBeenCalled();
    });

    it('should not fail if state update fails', async () => {
      const manifest = createTestManifest();
      vi.mocked(stateManager.getProjectState).mockImplementation(() => {
        throw new Error('State error');
      });

      // Should still succeed - state update is best-effort
      const result = await engine.inject(manifest, 'claude', options);

      expect(result.success).toBe(true);
    });

    it('should pass options to strategy', async () => {
      const mockStrategy = createMockStrategy('cursor');
      engine.registerStrategy(mockStrategy);

      const manifest = createTestManifest({ targets: ['cursor'] });
      const fullOptions: InjectOptions = {
        projectRoot,
        backup: true,
        force: true,
        merge: true,
      };

      await engine.inject(manifest, 'cursor', fullOptions);

      expect(mockStrategy.inject).toHaveBeenCalledWith(manifest, fullOptions);
    });

    it('should handle strategy injection failure gracefully', async () => {
      const mockStrategy = createMockStrategy('cursor');
      vi.mocked(mockStrategy.inject).mockRejectedValue(new Error('Injection failed'));
      engine.registerStrategy(mockStrategy);

      const manifest = createTestManifest({ targets: ['cursor'] });

      const result = await engine.inject(manifest, 'cursor', options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Injection failed');
    });

    it('should propagate BTWError from strategy', async () => {
      const mockStrategy = createMockStrategy('cursor');
      const btwError = new BTWError(ErrorCode.BACKUP_FAILED, 'Backup creation failed');
      vi.mocked(mockStrategy.inject).mockRejectedValue(btwError);
      engine.registerStrategy(mockStrategy);

      const manifest = createTestManifest({ targets: ['cursor'] });

      const result = await engine.inject(manifest, 'cursor', options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Backup creation failed');
    });
  });

  describe('injectMultiple()', () => {
    const projectRoot = '/test/project';

    it('should inject into multiple targets', async () => {
      const cursorStrategy = createMockStrategy('cursor');
      const windsurfStrategy = createMockStrategy('windsurf');
      engine.registerStrategy(cursorStrategy);
      engine.registerStrategy(windsurfStrategy);

      const manifest = createTestManifest({
        targets: ['claude', 'cursor', 'windsurf'],
      });

      const result = await engine.injectMultiple(manifest, {
        projectRoot,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results.size).toBe(3);
      expect(result.data?.failures.size).toBe(0);
      expect(result.data?.success).toBe(true);
    });

    it('should use manifest targets by default', async () => {
      const manifest = createTestManifest({ targets: ['claude'] });

      const result = await engine.injectMultiple(manifest, {
        projectRoot,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results.has('claude')).toBe(true);
    });

    it('should use specified targets when provided', async () => {
      const cursorStrategy = createMockStrategy('cursor');
      engine.registerStrategy(cursorStrategy);

      const manifest = createTestManifest({
        targets: ['claude', 'cursor'],
      });

      const result = await engine.injectMultiple(manifest, {
        projectRoot,
        targets: ['cursor'],
      });

      expect(result.success).toBe(true);
      expect(result.data?.results.has('cursor')).toBe(true);
      expect(result.data?.results.has('claude')).toBe(false);
    });

    it('should skip unsupported targets', async () => {
      const manifest = createTestManifest({
        targets: ['claude', 'cursor', 'windsurf'],
      });

      const result = await engine.injectMultiple(manifest, {
        projectRoot,
      });

      // Only claude is registered by default
      expect(result.success).toBe(true);
      expect(result.data?.results.has('claude')).toBe(true);
      expect(result.data?.results.has('cursor')).toBe(false);
    });

    it('should collect failures for individual targets', async () => {
      const cursorStrategy = createMockStrategy('cursor');
      vi.mocked(cursorStrategy.inject).mockRejectedValue(new Error('Cursor failed'));
      engine.registerStrategy(cursorStrategy);

      const manifest = createTestManifest({
        targets: ['claude', 'cursor'],
      });

      const result = await engine.injectMultiple(manifest, {
        projectRoot,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results.has('claude')).toBe(true);
      expect(result.data?.failures.has('cursor')).toBe(true);
      expect(result.data?.failures.get('cursor')?.message).toBe('Cursor failed');
      expect(result.data?.success).toBe(false); // overall success is false due to failure
    });

    it('should pass options to all strategies', async () => {
      const cursorStrategy = createMockStrategy('cursor');
      engine.registerStrategy(cursorStrategy);

      const manifest = createTestManifest({
        targets: ['claude', 'cursor'],
      });

      await engine.injectMultiple(manifest, {
        projectRoot,
        backup: true,
        force: true,
        merge: true,
      });

      expect(cursorStrategy.inject).toHaveBeenCalledWith(
        manifest,
        expect.objectContaining({
          projectRoot,
          backup: true,
          force: true,
          merge: true,
        })
      );
    });

    it('should handle empty targets array', async () => {
      const manifest = createTestManifest({ targets: [] });

      const result = await engine.injectMultiple(manifest, {
        projectRoot,
      });

      expect(result.success).toBe(true);
      expect(result.data?.results.size).toBe(0);
      expect(result.data?.failures.size).toBe(0);
      expect(result.data?.success).toBe(true);
    });
  });

  describe('eject()', () => {
    const projectRoot = '/test/project';
    const options: EjectOptions = { projectRoot };

    it('should successfully eject from target', async () => {
      const result = await engine.eject('claude', options);

      expect(result.success).toBe(true);
    });

    it('should throw BTWError for unsupported target', async () => {
      await expect(engine.eject('cursor', options)).rejects.toThrow(BTWError);
      await expect(engine.eject('cursor', options)).rejects.toMatchObject({
        code: ErrorCode.TARGET_NOT_SUPPORTED,
      });
    });

    it('should pass options to strategy', async () => {
      const mockStrategy = createMockStrategy('cursor');
      engine.registerStrategy(mockStrategy);

      const fullOptions: EjectOptions = {
        projectRoot,
        restoreBackup: true,
        clean: true,
      };

      await engine.eject('cursor', fullOptions);

      expect(mockStrategy.eject).toHaveBeenCalledWith(fullOptions);
    });

    it('should handle strategy ejection failure gracefully', async () => {
      const mockStrategy = createMockStrategy('cursor');
      vi.mocked(mockStrategy.eject).mockRejectedValue(new Error('Ejection failed'));
      engine.registerStrategy(mockStrategy);

      const result = await engine.eject('cursor', options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Ejection failed');
    });
  });

  describe('ejectAll()', () => {
    const projectRoot = '/test/project';

    it('should eject from all injected targets', async () => {
      const mockStrategy = createMockStrategy('cursor');
      vi.mocked(mockStrategy.getStatus).mockResolvedValue({
        isInjected: true,
        workflowId: 'test-workflow',
        hasBackup: false,
      });
      engine.registerStrategy(mockStrategy);

      // Mock claude strategy status
      const claudeStrategy = engine.getStrategy('claude');
      if (claudeStrategy) {
        vi.spyOn(claudeStrategy, 'getStatus').mockResolvedValue({
          isInjected: true,
          workflowId: 'test-workflow',
          hasBackup: false,
        });
        vi.spyOn(claudeStrategy, 'eject').mockResolvedValue(undefined);
      }

      const result = await engine.ejectAll(projectRoot);

      expect(result.success).toBe(true);
      expect(mockStrategy.eject).toHaveBeenCalled();
    });

    it('should skip targets that are not injected', async () => {
      const mockStrategy = createMockStrategy('cursor');
      vi.mocked(mockStrategy.getStatus).mockResolvedValue({
        isInjected: false,
        hasBackup: false,
      });
      engine.registerStrategy(mockStrategy);

      // Mock claude strategy status as not injected
      const claudeStrategy = engine.getStrategy('claude');
      if (claudeStrategy) {
        vi.spyOn(claudeStrategy, 'getStatus').mockResolvedValue({
          isInjected: false,
          hasBackup: false,
        });
      }

      const result = await engine.ejectAll(projectRoot);

      expect(result.success).toBe(true);
      expect(mockStrategy.eject).not.toHaveBeenCalled();
    });

    it('should collect warnings for failed ejections', async () => {
      const mockStrategy = createMockStrategy('cursor');
      vi.mocked(mockStrategy.getStatus).mockResolvedValue({
        isInjected: true,
        workflowId: 'test-workflow',
        hasBackup: false,
      });
      vi.mocked(mockStrategy.eject).mockRejectedValue(new Error('Ejection failed'));
      engine.registerStrategy(mockStrategy);

      // Mock claude strategy status as not injected
      const claudeStrategy = engine.getStrategy('claude');
      if (claudeStrategy) {
        vi.spyOn(claudeStrategy, 'getStatus').mockResolvedValue({
          isInjected: false,
          hasBackup: false,
        });
      }

      const result = await engine.ejectAll(projectRoot);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
      expect(result.warnings?.[0]).toContain('cursor');
      expect(result.warnings?.[0]).toContain('Ejection failed');
    });

    it('should pass options to all strategies', async () => {
      const mockStrategy = createMockStrategy('cursor');
      vi.mocked(mockStrategy.getStatus).mockResolvedValue({
        isInjected: true,
        workflowId: 'test-workflow',
        hasBackup: true,
      });
      engine.registerStrategy(mockStrategy);

      // Mock claude strategy status as not injected
      const claudeStrategy = engine.getStrategy('claude');
      if (claudeStrategy) {
        vi.spyOn(claudeStrategy, 'getStatus').mockResolvedValue({
          isInjected: false,
          hasBackup: false,
        });
      }

      await engine.ejectAll(projectRoot, { restoreBackup: true });

      expect(mockStrategy.eject).toHaveBeenCalledWith(
        expect.objectContaining({
          projectRoot,
          restoreBackup: true,
        })
      );
    });
  });

  describe('getStatus()', () => {
    const projectRoot = '/test/project';

    it('should return status for supported target', async () => {
      const status = await engine.getStatus('claude', projectRoot);

      expect(status).toBeDefined();
      expect(status).toHaveProperty('isInjected');
      expect(status).toHaveProperty('hasBackup');
    });

    it('should throw BTWError for unsupported target', async () => {
      await expect(engine.getStatus('cursor', projectRoot)).rejects.toThrow(BTWError);
      await expect(engine.getStatus('cursor', projectRoot)).rejects.toMatchObject({
        code: ErrorCode.TARGET_NOT_SUPPORTED,
      });
    });

    it('should delegate to strategy getStatus', async () => {
      const mockStrategy = createMockStrategy('cursor');
      const expectedStatus: InjectionStatus = {
        isInjected: true,
        workflowId: 'test-workflow',
        injectedAt: '2024-01-01T00:00:00.000Z',
        hasBackup: true,
        backupPath: '/project/.cursor/instructions.md.btw-backup',
      };
      vi.mocked(mockStrategy.getStatus).mockResolvedValue(expectedStatus);
      engine.registerStrategy(mockStrategy);

      const status = await engine.getStatus('cursor', projectRoot);

      expect(status).toEqual(expectedStatus);
      expect(mockStrategy.getStatus).toHaveBeenCalledWith(projectRoot);
    });
  });

  describe('getAllStatuses()', () => {
    const projectRoot = '/test/project';

    it('should return statuses for all registered targets', async () => {
      const cursorStrategy = createMockStrategy('cursor');
      const windsurfStrategy = createMockStrategy('windsurf');
      engine.registerStrategy(cursorStrategy);
      engine.registerStrategy(windsurfStrategy);

      const statuses = await engine.getAllStatuses(projectRoot);

      expect(statuses.size).toBe(3); // claude + cursor + windsurf
      expect(statuses.has('claude')).toBe(true);
      expect(statuses.has('cursor')).toBe(true);
      expect(statuses.has('windsurf')).toBe(true);
    });

    it('should return individual status from each strategy', async () => {
      const mockStrategy = createMockStrategy('cursor');
      const cursorStatus: InjectionStatus = {
        isInjected: true,
        workflowId: 'cursor-workflow',
        hasBackup: true,
      };
      vi.mocked(mockStrategy.getStatus).mockResolvedValue(cursorStatus);
      engine.registerStrategy(mockStrategy);

      const statuses = await engine.getAllStatuses(projectRoot);

      expect(statuses.get('cursor')).toEqual(cursorStatus);
    });

    it('should return only default statuses for fresh engine', async () => {
      const statuses = await engine.getAllStatuses(projectRoot);

      expect(statuses.size).toBe(1);
      expect(statuses.has('claude')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should convert non-BTWError to result with error message', async () => {
      const mockStrategy = createMockStrategy('cursor');
      vi.mocked(mockStrategy.inject).mockRejectedValue('String error');
      engine.registerStrategy(mockStrategy);

      const manifest = createTestManifest({ targets: ['cursor'] });

      const result = await engine.inject(manifest, 'cursor', { projectRoot: '/test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });

    it('should handle undefined error message', async () => {
      const mockStrategy = createMockStrategy('cursor');
      vi.mocked(mockStrategy.inject).mockRejectedValue(undefined);
      engine.registerStrategy(mockStrategy);

      const manifest = createTestManifest({ targets: ['cursor'] });

      const result = await engine.inject(manifest, 'cursor', { projectRoot: '/test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('undefined');
    });
  });
});
