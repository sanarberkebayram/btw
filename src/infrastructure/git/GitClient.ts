/**
 * BTW - Git Client
 * Handles git operations for workflow repositories
 */

import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import { fileSystem } from '../fs/FileSystem.js';
import { BTWError, ErrorCode } from '../../types/errors.js';

/**
 * Options for git clone operation
 */
export interface CloneOptions {
  /** Target directory for clone */
  targetDir: string;
  /** Branch to checkout */
  branch?: string;
  /** Shallow clone depth */
  depth?: number;
  /** Whether to clone quietly */
  quiet?: boolean;
}

/**
 * Options for git pull operation
 */
export interface PullOptions {
  /** Repository directory */
  repoDir: string;
  /** Remote name (default: origin) */
  remote?: string;
  /** Branch to pull */
  branch?: string;
}

/**
 * Result of a git operation
 */
export interface GitResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Stdout output */
  stdout?: string;
  /** Stderr output */
  stderr?: string;
  /** Exit code */
  exitCode: number;
}

/**
 * Information about a parsed repository identifier
 */
export interface RepoInfo {
  owner: string;
  repo: string;
  url: string;
  type: 'github' | 'gitlab' | 'bitbucket' | 'other';
}

/**
 * Git client for managing workflow repositories
 */
export class GitClient {
  /**
   * Create a simple-git instance with optional base directory
   */
  private createGit(baseDir?: string): SimpleGit {
    const options: Partial<SimpleGitOptions> = {
      baseDir: baseDir || process.cwd(),
      binary: 'git',
      maxConcurrentProcesses: 1,
    };
    return simpleGit(options);
  }

  /**
   * Check if git is available on the system
   */
  async isGitAvailable(): Promise<boolean> {
    try {
      const git = this.createGit();
      await git.version();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clone a git repository
   * @param url - Repository URL to clone
   * @param options - Clone options
   */
  async clone(url: string, options: CloneOptions): Promise<GitResult> {
    try {
      const git = this.createGit();

      // Build clone arguments
      const cloneArgs: string[] = [];

      if (options.depth !== undefined) {
        cloneArgs.push('--depth', String(options.depth));
      }

      if (options.branch) {
        cloneArgs.push('--branch', options.branch);
      }

      if (options.quiet) {
        cloneArgs.push('--quiet');
      }

      // Execute clone
      const result = await git.clone(url, options.targetDir, cloneArgs);

      return {
        success: true,
        stdout: result,
        exitCode: 0,
      };
    } catch (error) {
      const err = error as Error;
      throw new BTWError(ErrorCode.GIT_CLONE_FAILED, `Failed to clone repository: ${err.message}`, {
        context: { url, targetDir: options.targetDir },
        cause: err,
      });
    }
  }

  /**
   * Pull latest changes from remote
   * @param options - Pull options
   */
  async pull(options: PullOptions): Promise<GitResult> {
    try {
      const git = this.createGit(options.repoDir);

      const remote = options.remote || 'origin';
      const result = await git.pull(remote, options.branch);

      return {
        success: true,
        stdout: result.summary ? JSON.stringify(result.summary) : undefined,
        exitCode: 0,
      };
    } catch (error) {
      const err = error as Error;
      throw new BTWError(ErrorCode.GIT_PULL_FAILED, `Failed to pull repository: ${err.message}`, {
        context: { repoDir: options.repoDir, remote: options.remote, branch: options.branch },
        cause: err,
      });
    }
  }

  /**
   * Check if a directory is a git repository
   * @param dirPath - Directory to check
   */
  async isRepository(dirPath: string): Promise<boolean> {
    try {
      // First check if directory exists
      const exists = await fileSystem.exists(dirPath);
      if (!exists) {
        return false;
      }

      const git = this.createGit(dirPath);
      return await git.checkIsRepo();
    } catch {
      return false;
    }
  }

  /**
   * Get the current commit hash
   * @param repoDir - Repository directory
   */
  async getCurrentCommit(repoDir: string): Promise<string> {
    try {
      const git = this.createGit(repoDir);
      const commitHash = await git.revparse(['HEAD']);
      return commitHash.trim();
    } catch (error) {
      const err = error as Error;
      throw new BTWError(ErrorCode.GIT_NOT_A_REPOSITORY, `Failed to get current commit: ${err.message}`, {
        context: { repoDir },
        cause: err,
      });
    }
  }

  /**
   * Get the remote URL for a repository
   * @param repoDir - Repository directory
   * @param remote - Remote name (default: origin)
   */
  async getRemoteUrl(repoDir: string, remote: string = 'origin'): Promise<string> {
    try {
      const git = this.createGit(repoDir);
      const url = await git.remote(['get-url', remote]);
      return url ? url.trim() : '';
    } catch (error) {
      const err = error as Error;
      // Return empty string if remote doesn't exist
      if (err.message.includes('No such remote') || err.message.includes('not found')) {
        return '';
      }
      throw new BTWError(ErrorCode.GIT_NOT_A_REPOSITORY, `Failed to get remote URL: ${err.message}`, {
        context: { repoDir, remote },
        cause: err,
      });
    }
  }

  /**
   * Parse various repository identifier formats
   * @param identifier - Repository identifier (owner/repo, URL, etc.)
   */
  parseRepoIdentifier(identifier: string): RepoInfo {
    // Pattern for owner/repo format
    const shorthandPattern = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;

    // Pattern for HTTPS URL
    const httpsPattern = /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/;

    // Pattern for SSH URL (git@host:owner/repo.git)
    const sshPattern = /^git@(github\.com|gitlab\.com|bitbucket\.org):([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/;

    // Try shorthand format (owner/repo)
    const shorthandMatch = identifier.match(shorthandPattern);
    if (shorthandMatch && shorthandMatch[1] && shorthandMatch[2]) {
      const owner = shorthandMatch[1];
      const repo = shorthandMatch[2];
      return {
        owner,
        repo,
        url: `https://github.com/${owner}/${repo}.git`,
        type: 'github',
      };
    }

    // Try HTTPS URL
    const httpsMatch = identifier.match(httpsPattern);
    if (httpsMatch && httpsMatch[1] && httpsMatch[2] && httpsMatch[3]) {
      const host = httpsMatch[1];
      const owner = httpsMatch[2];
      const repo = httpsMatch[3];
      const type = this.getHostType(host);
      return {
        owner,
        repo,
        url: `https://${host}/${owner}/${repo}.git`,
        type,
      };
    }

    // Try SSH URL
    const sshMatch = identifier.match(sshPattern);
    if (sshMatch && sshMatch[1] && sshMatch[2] && sshMatch[3]) {
      const host = sshMatch[1];
      const owner = sshMatch[2];
      const repo = sshMatch[3];
      const type = this.getHostType(host);
      return {
        owner,
        repo,
        url: `https://${host}/${owner}/${repo}.git`,
        type,
      };
    }

    throw new BTWError(ErrorCode.INVALID_ARGUMENT, `Invalid repository identifier: ${identifier}`, {
      context: { identifier },
    });
  }

  /**
   * Get the host type from a hostname
   */
  private getHostType(host: string): 'github' | 'gitlab' | 'bitbucket' | 'other' {
    if (host.includes('github')) return 'github';
    if (host.includes('gitlab')) return 'gitlab';
    if (host.includes('bitbucket')) return 'bitbucket';
    return 'other';
  }

  /**
   * Resolve a repository identifier to a GitHub URL
   * @param identifier - Repository identifier
   */
  resolveGitHubUrl(identifier: string): string {
    // If already a full URL
    if (identifier.startsWith('https://') || identifier.startsWith('git@') || identifier.startsWith('git://')) {
      // Ensure .git suffix
      if (!identifier.endsWith('.git')) {
        return `${identifier}.git`;
      }
      return identifier;
    }

    // Try to parse as owner/repo
    const shorthandPattern = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;
    const match = identifier.match(shorthandPattern);

    if (match && match[1] && match[2]) {
      const owner = match[1];
      const repo = match[2];
      return `https://github.com/${owner}/${repo}.git`;
    }

    throw new BTWError(ErrorCode.INVALID_ARGUMENT, `Invalid repository identifier format: ${identifier}`, {
      context: { identifier },
    });
  }

  /**
   * Check if a URL is a valid git URL
   * @param url - URL to validate
   */
  isValidGitUrl(url: string): boolean {
    // HTTPS URLs
    const httpsPattern = /^https?:\/\/[a-zA-Z0-9_.-]+\.[a-zA-Z]{2,}(\/[a-zA-Z0-9_.-]+)+$/;

    // SSH URLs (git@host:owner/repo.git)
    const sshPattern = /^git@[a-zA-Z0-9_.-]+\.[a-zA-Z]{2,}:[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

    // Git protocol URLs
    const gitPattern = /^git:\/\/[a-zA-Z0-9_.-]+\.[a-zA-Z]{2,}(\/[a-zA-Z0-9_.-]+)+$/;

    // Remove optional .git suffix for matching
    const urlWithoutGit = url.replace(/\.git$/, '');

    return (
      httpsPattern.test(urlWithoutGit) ||
      sshPattern.test(urlWithoutGit) ||
      gitPattern.test(urlWithoutGit)
    );
  }
}

/**
 * Singleton instance of GitClient
 */
export const gitClient = new GitClient();
