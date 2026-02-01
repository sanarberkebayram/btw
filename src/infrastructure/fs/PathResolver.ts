/**
 * BTW - Path Resolver
 * Utilities for resolving and managing paths
 */

import path from 'path';
import { access } from 'fs/promises';
import { AITarget } from '../../types/index.js';
import { AI_TOOL_MAPPINGS, BTW_HOME, WORKFLOWS_DIR, CACHE_DIR } from '../config/constants.js';
import { BTWError, ErrorCode } from '../../types/errors.js';

/**
 * Resolved paths for a project
 */
export interface ProjectPaths {
  /** Project root directory */
  root: string;
  /** Path to BTW project state file */
  stateFile: string;
  /** Path to BTW project cache */
  cacheDir: string;
}

/**
 * Resolved paths for an AI tool in a project
 */
export interface AiToolPaths {
  /** Path to the AI tool's config file */
  configPath: string;
  /** Path to the AI tool's instructions file */
  instructionsPath: string;
  /** Path to the AI tool's project config */
  projectConfigPath: string;
}

/**
 * Path resolver for BTW operations
 */
export class PathResolver {
  /**
   * Get the BTW home directory
   */
  getBtwHome(): string {
    return BTW_HOME;
  }

  /**
   * Get the workflows directory
   */
  getWorkflowsDir(): string {
    return WORKFLOWS_DIR;
  }

  /**
   * Get the cache directory
   */
  getCacheDir(): string {
    return CACHE_DIR;
  }

  /**
   * Get the path to a specific workflow
   * @param workflowId - Workflow identifier
   */
  getWorkflowPath(workflowId: string): string {
    if (!workflowId || workflowId.trim() === '') {
      throw new BTWError(ErrorCode.INVALID_INPUT, 'Workflow ID cannot be empty');
    }
    return path.join(WORKFLOWS_DIR, workflowId);
  }

  /**
   * Resolve project paths
   * @param projectRoot - Root directory of the project
   */
  resolveProjectPaths(projectRoot: string): ProjectPaths {
    if (!projectRoot || projectRoot.trim() === '') {
      throw new BTWError(ErrorCode.INVALID_INPUT, 'Project root cannot be empty');
    }
    const normalizedRoot = this.normalize(projectRoot);
    const btwDir = path.join(normalizedRoot, '.btw');

    return {
      root: normalizedRoot,
      stateFile: path.join(btwDir, 'state.json'),
      cacheDir: path.join(btwDir, 'cache'),
    };
  }

  /**
   * Resolve AI tool paths for a project
   * @param projectRoot - Root directory of the project
   * @param target - AI target to resolve paths for
   */
  resolveAiToolPaths(projectRoot: string, target: AITarget): AiToolPaths {
    if (!projectRoot || projectRoot.trim() === '') {
      throw new BTWError(ErrorCode.INVALID_INPUT, 'Project root cannot be empty');
    }

    const toolConfig = AI_TOOL_MAPPINGS[target];
    if (!toolConfig) {
      throw new BTWError(ErrorCode.INVALID_INPUT, `Unknown AI target: ${target}`);
    }

    const normalizedRoot = this.normalize(projectRoot);

    return {
      configPath: path.join(normalizedRoot, toolConfig.configPath),
      instructionsPath: path.join(normalizedRoot, toolConfig.instructionsPath),
      projectConfigPath: path.join(normalizedRoot, toolConfig.projectConfigPath),
    };
  }

  /**
   * Find the project root from a given path
   * @param startPath - Path to start searching from
   */
  async findProjectRoot(startPath: string): Promise<string | null> {
    if (!startPath || startPath.trim() === '') {
      return null;
    }

    const markers = ['.git', 'package.json', 'btw.yaml'];
    let currentPath = this.normalize(startPath);

    while (true) {
      // Check for each marker in the current directory
      for (const marker of markers) {
        const markerPath = path.join(currentPath, marker);
        try {
          await access(markerPath);
          // Marker found, this is the project root
          return currentPath;
        } catch {
          // Marker not found, continue checking
        }
      }

      // Move to parent directory
      const parentPath = path.dirname(currentPath);

      // Check if we've reached the filesystem root
      if (parentPath === currentPath) {
        return null;
      }

      currentPath = parentPath;
    }
  }

  /**
   * Check if a path is within the BTW home directory
   * @param checkPath - Path to check
   */
  isWithinBtwHome(checkPath: string): boolean {
    if (!checkPath || checkPath.trim() === '') {
      return false;
    }

    const normalizedPath = this.normalize(checkPath);
    const normalizedBtwHome = this.normalize(BTW_HOME);

    // Ensure we compare with a trailing separator to avoid false positives
    // e.g., /home/user/.btw-other should not match /home/user/.btw
    return normalizedPath === normalizedBtwHome ||
      normalizedPath.startsWith(normalizedBtwHome + path.sep);
  }

  /**
   * Make a path relative to a base path
   * @param fullPath - Full path to convert
   * @param basePath - Base path for relativity
   */
  makeRelative(fullPath: string, basePath: string): string {
    if (!fullPath || fullPath.trim() === '') {
      return '';
    }
    if (!basePath || basePath.trim() === '') {
      return this.normalize(fullPath);
    }

    const normalizedFull = this.normalize(fullPath);
    const normalizedBase = this.normalize(basePath);

    return path.relative(normalizedBase, normalizedFull);
  }

  /**
   * Normalize a path (resolve . and .., normalize separators)
   * @param inputPath - Path to normalize
   */
  normalize(inputPath: string): string {
    if (!inputPath || inputPath.trim() === '') {
      return '';
    }

    // First normalize the path (resolve . and .., normalize separators)
    const normalized = path.normalize(inputPath);

    // If it's already absolute, return as is
    if (path.isAbsolute(normalized)) {
      return normalized;
    }

    // Make relative paths absolute by resolving against cwd
    return path.resolve(normalized);
  }

  /**
   * Join path segments
   * @param segments - Path segments to join
   */
  join(...segments: string[]): string {
    // Filter out empty segments
    const validSegments = segments.filter(s => s && s.trim() !== '');

    if (validSegments.length === 0) {
      return '';
    }

    return path.join(...validSegments);
  }
}

/**
 * Singleton instance of PathResolver
 */
export const pathResolver = new PathResolver();
