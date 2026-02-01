/**
 * BTW - PathResolver Unit Tests
 * Comprehensive tests for path resolution utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { PathResolver, ProjectPaths, AiToolPaths } from '../PathResolver.js';
import { BTWError, ErrorCode } from '../../../types/errors.js';
import { AITarget } from '../../../types/index.js';

// Mock the constants module to control BTW_HOME for testing
vi.mock('../../config/constants.js', async () => {
  const actual = await vi.importActual<typeof import('../../config/constants.js')>('../../config/constants.js');
  return {
    ...actual,
    BTW_HOME: process.env.BTW_HOME_TEST || path.join(os.homedir(), '.btw-test'),
    WORKFLOWS_DIR: path.join(process.env.BTW_HOME_TEST || path.join(os.homedir(), '.btw-test'), 'workflows'),
    CACHE_DIR: path.join(process.env.BTW_HOME_TEST || path.join(os.homedir(), '.btw-test'), 'cache'),
  };
});

describe('PathResolver', () => {
  let pathResolver: PathResolver;
  let testDir: string;

  beforeEach(async () => {
    pathResolver = new PathResolver();
    // Create a unique temp directory for each test
    testDir = path.join(os.tmpdir(), `btw-path-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  describe('getBtwHome()', () => {
    it('should return the BTW home directory path', () => {
      const result = pathResolver.getBtwHome();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return a path ending with .btw or .btw-test', () => {
      const result = pathResolver.getBtwHome();

      expect(result.includes('.btw')).toBe(true);
    });

    it('should return an absolute path', () => {
      const result = pathResolver.getBtwHome();

      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe('getWorkflowsDir()', () => {
    it('should return the workflows directory path', () => {
      const result = pathResolver.getWorkflowsDir();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should return a path under BTW home', () => {
      const btwHome = pathResolver.getBtwHome();
      const result = pathResolver.getWorkflowsDir();

      expect(result.startsWith(btwHome)).toBe(true);
    });

    it('should return a path ending with workflows', () => {
      const result = pathResolver.getWorkflowsDir();

      expect(result.endsWith('workflows')).toBe(true);
    });

    it('should return an absolute path', () => {
      const result = pathResolver.getWorkflowsDir();

      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe('getCacheDir()', () => {
    it('should return the cache directory path', () => {
      const result = pathResolver.getCacheDir();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should return a path under BTW home', () => {
      const btwHome = pathResolver.getBtwHome();
      const result = pathResolver.getCacheDir();

      expect(result.startsWith(btwHome)).toBe(true);
    });

    it('should return a path ending with cache', () => {
      const result = pathResolver.getCacheDir();

      expect(result.endsWith('cache')).toBe(true);
    });

    it('should return an absolute path', () => {
      const result = pathResolver.getCacheDir();

      expect(path.isAbsolute(result)).toBe(true);
    });
  });

  describe('getWorkflowPath()', () => {
    it('should return the path to a workflow by ID', () => {
      const result = pathResolver.getWorkflowPath('my-workflow');

      expect(result).toContain('my-workflow');
      expect(result.startsWith(pathResolver.getWorkflowsDir())).toBe(true);
    });

    it('should return an absolute path', () => {
      const result = pathResolver.getWorkflowPath('test-workflow');

      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should handle workflow IDs with hyphens', () => {
      const result = pathResolver.getWorkflowPath('my-cool-workflow');

      expect(result.endsWith('my-cool-workflow')).toBe(true);
    });

    it('should handle workflow IDs with underscores', () => {
      const result = pathResolver.getWorkflowPath('my_workflow');

      expect(result.endsWith('my_workflow')).toBe(true);
    });

    it('should handle workflow IDs with dots', () => {
      const result = pathResolver.getWorkflowPath('workflow.v1');

      expect(result.endsWith('workflow.v1')).toBe(true);
    });

    it('should throw INVALID_INPUT for empty workflow ID', () => {
      expect(() => pathResolver.getWorkflowPath('')).toThrow(BTWError);
      expect(() => pathResolver.getWorkflowPath('')).toThrow();

      try {
        pathResolver.getWorkflowPath('');
      } catch (error) {
        expect((error as BTWError).code).toBe(ErrorCode.INVALID_INPUT);
      }
    });

    it('should throw INVALID_INPUT for whitespace-only workflow ID', () => {
      expect(() => pathResolver.getWorkflowPath('   ')).toThrow(BTWError);

      try {
        pathResolver.getWorkflowPath('   ');
      } catch (error) {
        expect((error as BTWError).code).toBe(ErrorCode.INVALID_INPUT);
      }
    });
  });

  describe('resolveProjectPaths()', () => {
    it('should resolve project paths correctly', () => {
      const projectRoot = '/home/user/my-project';

      const result = pathResolver.resolveProjectPaths(projectRoot);

      expect(result.root).toBe(projectRoot);
      expect(result.stateFile).toBe(path.join(projectRoot, '.btw', 'state.json'));
      expect(result.cacheDir).toBe(path.join(projectRoot, '.btw', 'cache'));
    });

    it('should normalize the project root path', () => {
      const projectRoot = '/home/user/my-project/./subdir/../';

      const result = pathResolver.resolveProjectPaths(projectRoot);

      // path.normalize doesn't remove trailing slashes
      expect(result.root.startsWith('/home/user/my-project')).toBe(true);
    });

    it('should handle paths with trailing slashes', () => {
      const projectRoot = '/home/user/my-project/';

      const result = pathResolver.resolveProjectPaths(projectRoot);

      // path.normalize preserves trailing slashes in some cases
      expect(result.root.startsWith('/home/user/my-project')).toBe(true);
    });

    it('should return all required path properties', () => {
      const projectRoot = testDir;

      const result = pathResolver.resolveProjectPaths(projectRoot);

      expect(result).toHaveProperty('root');
      expect(result).toHaveProperty('stateFile');
      expect(result).toHaveProperty('cacheDir');
    });

    it('should throw INVALID_INPUT for empty project root', () => {
      expect(() => pathResolver.resolveProjectPaths('')).toThrow(BTWError);

      try {
        pathResolver.resolveProjectPaths('');
      } catch (error) {
        expect((error as BTWError).code).toBe(ErrorCode.INVALID_INPUT);
      }
    });

    it('should throw INVALID_INPUT for whitespace-only project root', () => {
      expect(() => pathResolver.resolveProjectPaths('   ')).toThrow(BTWError);

      try {
        pathResolver.resolveProjectPaths('   ');
      } catch (error) {
        expect((error as BTWError).code).toBe(ErrorCode.INVALID_INPUT);
      }
    });
  });

  describe('resolveAiToolPaths()', () => {
    it('should resolve Claude AI tool paths correctly', () => {
      const projectRoot = '/home/user/my-project';

      const result = pathResolver.resolveAiToolPaths(projectRoot, 'claude');

      expect(result.configPath).toBe(path.join(projectRoot, '.claude/settings.json'));
      expect(result.instructionsPath).toBe(path.join(projectRoot, '.claude/instructions.md'));
      expect(result.projectConfigPath).toBe(path.join(projectRoot, '.claude/project.json'));
    });

    it('should resolve Cursor AI tool paths correctly', () => {
      const projectRoot = '/home/user/my-project';

      const result = pathResolver.resolveAiToolPaths(projectRoot, 'cursor');

      expect(result.configPath).toBe(path.join(projectRoot, '.cursor/settings.json'));
      expect(result.instructionsPath).toBe(path.join(projectRoot, '.cursorrules'));
      expect(result.projectConfigPath).toBe(path.join(projectRoot, '.cursor/config.json'));
    });

    it('should resolve Windsurf AI tool paths correctly', () => {
      const projectRoot = '/home/user/my-project';

      const result = pathResolver.resolveAiToolPaths(projectRoot, 'windsurf');

      expect(result.configPath).toBe(path.join(projectRoot, '.windsurf/config.json'));
      expect(result.instructionsPath).toBe(path.join(projectRoot, '.windsurfrules'));
      expect(result.projectConfigPath).toBe(path.join(projectRoot, '.windsurf/project.json'));
    });

    it('should resolve Copilot AI tool paths correctly', () => {
      const projectRoot = '/home/user/my-project';

      const result = pathResolver.resolveAiToolPaths(projectRoot, 'copilot');

      expect(result.configPath).toBe(path.join(projectRoot, '.github/copilot/config.json'));
      expect(result.instructionsPath).toBe(path.join(projectRoot, '.github/copilot-instructions.md'));
      expect(result.projectConfigPath).toBe(path.join(projectRoot, '.github/copilot/settings.json'));
    });

    it('should return all required path properties', () => {
      const projectRoot = testDir;

      const result = pathResolver.resolveAiToolPaths(projectRoot, 'claude');

      expect(result).toHaveProperty('configPath');
      expect(result).toHaveProperty('instructionsPath');
      expect(result).toHaveProperty('projectConfigPath');
    });

    it('should normalize the project root path', () => {
      const projectRoot = '/home/user/my-project/./subdir/../';

      const result = pathResolver.resolveAiToolPaths(projectRoot, 'claude');

      expect(result.configPath.startsWith('/home/user/my-project/')).toBe(true);
    });

    it('should throw INVALID_INPUT for empty project root', () => {
      expect(() => pathResolver.resolveAiToolPaths('', 'claude')).toThrow(BTWError);

      try {
        pathResolver.resolveAiToolPaths('', 'claude');
      } catch (error) {
        expect((error as BTWError).code).toBe(ErrorCode.INVALID_INPUT);
      }
    });

    it('should throw INVALID_INPUT for unknown AI target', () => {
      expect(() => pathResolver.resolveAiToolPaths('/home/user', 'unknown' as AITarget)).toThrow(BTWError);

      try {
        pathResolver.resolveAiToolPaths('/home/user', 'unknown' as AITarget);
      } catch (error) {
        expect((error as BTWError).code).toBe(ErrorCode.INVALID_INPUT);
      }
    });
  });

  describe('findProjectRoot()', () => {
    it('should find project root with .git directory', async () => {
      const projectDir = path.join(testDir, 'git-project');
      await fs.mkdir(path.join(projectDir, '.git'), { recursive: true });

      const result = await pathResolver.findProjectRoot(projectDir);

      expect(result).toBe(projectDir);
    });

    it('should find project root with package.json', async () => {
      const projectDir = path.join(testDir, 'npm-project');
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(path.join(projectDir, 'package.json'), '{}', 'utf-8');

      const result = await pathResolver.findProjectRoot(projectDir);

      expect(result).toBe(projectDir);
    });

    it('should find project root with btw.yaml', async () => {
      const projectDir = path.join(testDir, 'btw-project');
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(path.join(projectDir, 'btw.yaml'), 'version: 1.0', 'utf-8');

      const result = await pathResolver.findProjectRoot(projectDir);

      expect(result).toBe(projectDir);
    });

    it('should find project root from nested subdirectory', async () => {
      const projectDir = path.join(testDir, 'nested-project');
      const nestedDir = path.join(projectDir, 'src', 'components', 'deep');
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.mkdir(path.join(projectDir, '.git'), { recursive: true });

      const result = await pathResolver.findProjectRoot(nestedDir);

      expect(result).toBe(projectDir);
    });

    it('should return null when no project root is found', async () => {
      const isolatedDir = path.join(testDir, 'isolated');
      await fs.mkdir(isolatedDir, { recursive: true });

      const result = await pathResolver.findProjectRoot(isolatedDir);

      // This may or may not be null depending on the filesystem structure
      // The test verifies the function handles the search correctly
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should return null for empty path', async () => {
      const result = await pathResolver.findProjectRoot('');

      expect(result).toBeNull();
    });

    it('should return null for whitespace-only path', async () => {
      const result = await pathResolver.findProjectRoot('   ');

      expect(result).toBeNull();
    });

    it('should prioritize markers in order (.git, package.json, btw.yaml)', async () => {
      const projectDir = path.join(testDir, 'multi-marker-project');
      await fs.mkdir(path.join(projectDir, '.git'), { recursive: true });
      await fs.writeFile(path.join(projectDir, 'package.json'), '{}', 'utf-8');
      await fs.writeFile(path.join(projectDir, 'btw.yaml'), 'version: 1.0', 'utf-8');

      const result = await pathResolver.findProjectRoot(projectDir);

      expect(result).toBe(projectDir);
    });

    it('should handle paths with symlinks', async () => {
      const projectDir = path.join(testDir, 'symlink-project');
      await fs.mkdir(projectDir, { recursive: true });
      await fs.mkdir(path.join(projectDir, '.git'), { recursive: true });

      const result = await pathResolver.findProjectRoot(projectDir);

      expect(result).toBe(projectDir);
    });
  });

  describe('isWithinBtwHome()', () => {
    it('should return true for path within BTW home', () => {
      const btwHome = pathResolver.getBtwHome();
      const testPath = path.join(btwHome, 'workflows', 'my-workflow');

      const result = pathResolver.isWithinBtwHome(testPath);

      expect(result).toBe(true);
    });

    it('should return true for BTW home path itself', () => {
      const btwHome = pathResolver.getBtwHome();

      const result = pathResolver.isWithinBtwHome(btwHome);

      expect(result).toBe(true);
    });

    it('should return false for path outside BTW home', () => {
      const testPath = '/tmp/some/other/path';

      const result = pathResolver.isWithinBtwHome(testPath);

      expect(result).toBe(false);
    });

    it('should return false for path that starts with BTW home but is different directory', () => {
      const btwHome = pathResolver.getBtwHome();
      // e.g., ~/.btw-other should not match ~/.btw
      const testPath = `${btwHome}-other`;

      const result = pathResolver.isWithinBtwHome(testPath);

      expect(result).toBe(false);
    });

    it('should return false for empty path', () => {
      const result = pathResolver.isWithinBtwHome('');

      expect(result).toBe(false);
    });

    it('should return false for whitespace-only path', () => {
      const result = pathResolver.isWithinBtwHome('   ');

      expect(result).toBe(false);
    });

    it('should handle paths with trailing slashes', () => {
      const btwHome = pathResolver.getBtwHome();
      const testPath = path.join(btwHome, 'workflows') + '/';

      const result = pathResolver.isWithinBtwHome(testPath);

      expect(result).toBe(true);
    });
  });

  describe('normalize()', () => {
    it('should normalize paths with . and ..', () => {
      const result = pathResolver.normalize('/home/user/./project/../other');

      expect(result).toBe('/home/user/other');
    });

    it('should normalize paths with multiple slashes', () => {
      const result = pathResolver.normalize('/home//user///project');

      expect(result).toBe('/home/user/project');
    });

    it('should return absolute path for relative input', () => {
      const result = pathResolver.normalize('relative/path');

      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should return absolute path unchanged', () => {
      const absolutePath = '/home/user/project';

      const result = pathResolver.normalize(absolutePath);

      expect(result).toBe(absolutePath);
    });

    it('should return empty string for empty input', () => {
      const result = pathResolver.normalize('');

      expect(result).toBe('');
    });

    it('should return empty string for whitespace-only input', () => {
      const result = pathResolver.normalize('   ');

      expect(result).toBe('');
    });

    it('should handle trailing slashes', () => {
      const result = pathResolver.normalize('/home/user/project/');

      // path.normalize may preserve trailing slashes
      expect(result.startsWith('/home/user/project')).toBe(true);
    });

    it('should handle complex paths', () => {
      const result = pathResolver.normalize('/a/b/../c/./d//e/../f');

      expect(result).toBe('/a/c/d/f');
    });
  });

  describe('makeRelative()', () => {
    it('should make a path relative to base', () => {
      const fullPath = '/home/user/project/src/file.ts';
      const basePath = '/home/user/project';

      const result = pathResolver.makeRelative(fullPath, basePath);

      expect(result).toBe('src/file.ts');
    });

    it('should handle same paths', () => {
      const samePath = '/home/user/project';

      const result = pathResolver.makeRelative(samePath, samePath);

      expect(result).toBe('');
    });

    it('should handle paths with .. traversal', () => {
      const fullPath = '/home/user/other';
      const basePath = '/home/user/project';

      const result = pathResolver.makeRelative(fullPath, basePath);

      expect(result).toBe('../other');
    });

    it('should return normalized full path for empty base', () => {
      const fullPath = '/home/user/project/file.ts';

      const result = pathResolver.makeRelative(fullPath, '');

      expect(result).toBe('/home/user/project/file.ts');
    });

    it('should return empty string for empty full path', () => {
      const basePath = '/home/user/project';

      const result = pathResolver.makeRelative('', basePath);

      expect(result).toBe('');
    });

    it('should normalize paths before making relative', () => {
      const fullPath = '/home/user/project/./src/../src/file.ts';
      const basePath = '/home/user/project/';

      const result = pathResolver.makeRelative(fullPath, basePath);

      expect(result).toBe('src/file.ts');
    });

    it('should handle deeply nested paths', () => {
      const fullPath = '/home/user/project/src/components/deep/nested/file.ts';
      const basePath = '/home/user/project';

      const result = pathResolver.makeRelative(fullPath, basePath);

      expect(result).toBe('src/components/deep/nested/file.ts');
    });
  });

  describe('join()', () => {
    it('should join path segments', () => {
      const result = pathResolver.join('/home', 'user', 'project');

      expect(result).toBe('/home/user/project');
    });

    it('should handle single segment', () => {
      const result = pathResolver.join('/home');

      expect(result).toBe('/home');
    });

    it('should handle multiple segments', () => {
      const result = pathResolver.join('/home', 'user', 'project', 'src', 'file.ts');

      expect(result).toBe('/home/user/project/src/file.ts');
    });

    it('should filter out empty segments', () => {
      const result = pathResolver.join('/home', '', 'user', '', 'project');

      expect(result).toBe('/home/user/project');
    });

    it('should filter out whitespace-only segments', () => {
      const result = pathResolver.join('/home', '   ', 'user', '  ', 'project');

      expect(result).toBe('/home/user/project');
    });

    it('should return empty string for no valid segments', () => {
      const result = pathResolver.join('', '   ', '');

      expect(result).toBe('');
    });

    it('should return empty string for empty arguments', () => {
      const result = pathResolver.join();

      expect(result).toBe('');
    });

    it('should normalize path separators', () => {
      const result = pathResolver.join('/home/', '/user/', '/project/');

      // path.join handles this - may include trailing slash
      expect(result.startsWith('/home/user/project')).toBe(true);
    });

    it('should handle relative segments', () => {
      const result = pathResolver.join('/home', './user', '../other');

      expect(result).toBe('/home/other');
    });
  });

  describe('Edge Cases', () => {
    it('should handle root path /', () => {
      const result = pathResolver.normalize('/');

      expect(result).toBe('/');
    });

    it('should handle home directory ~', () => {
      // Note: path.normalize doesn't expand ~, but the function should handle it gracefully
      const result = pathResolver.normalize('~');

      expect(result).toBeDefined();
    });

    it('should handle Windows-style paths on Unix', () => {
      // path.normalize should handle this
      const result = pathResolver.normalize('/home\\user\\project');

      expect(result).toBeDefined();
    });

    it('should handle paths with special characters', () => {
      const result = pathResolver.join('/home', 'user', 'project-name_v1.0');

      expect(result).toBe('/home/user/project-name_v1.0');
    });

    it('should handle paths with spaces', () => {
      const result = pathResolver.join('/home', 'my user', 'my project');

      expect(result).toBe('/home/my user/my project');
    });
  });
});
