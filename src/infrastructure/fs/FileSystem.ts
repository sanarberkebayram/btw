/**
 * BTW - File System Operations
 * Abstraction layer for file system operations
 */

import { promises as fs } from 'fs';
import path from 'path';
import { BTWError, ErrorCode } from '../../types/errors.js';
import { BACKUP_EXTENSION } from '../config/constants.js';

/**
 * Options for reading files
 */
export interface ReadOptions {
  /** File encoding (default: utf-8) */
  encoding?: BufferEncoding;
}

/**
 * Options for writing files
 */
export interface WriteOptions {
  /** File encoding (default: utf-8) */
  encoding?: BufferEncoding;
  /** Create parent directories if they don't exist */
  createDirs?: boolean;
  /** File mode/permissions */
  mode?: number;
}

/**
 * Options for copying files
 */
export interface CopyOptions {
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Preserve file timestamps */
  preserveTimestamps?: boolean;
}

/**
 * File information
 */
export interface FileInfo {
  /** File path */
  path: string;
  /** File name */
  name: string;
  /** Whether it's a directory */
  isDirectory: boolean;
  /** Whether it's a file */
  isFile: boolean;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  modifiedAt: Date;
  /** Created timestamp */
  createdAt: Date;
}

/**
 * File system abstraction for BTW operations
 */
export class FileSystem {
  /**
   * Read a file as string
   * @param filePath - Path to the file
   * @param options - Read options
   */
  async readFile(filePath: string, options?: ReadOptions): Promise<string> {
    const encoding = options?.encoding ?? 'utf-8';
    try {
      return await fs.readFile(filePath, { encoding });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new BTWError(ErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`, {
          context: { filePath },
          cause: err,
        });
      }
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new BTWError(ErrorCode.PERMISSION_DENIED, `Permission denied: ${filePath}`, {
          context: { filePath },
          cause: err,
        });
      }
      throw new BTWError(ErrorCode.FILE_READ_ERROR, `Failed to read file: ${filePath}`, {
        context: { filePath },
        cause: err,
      });
    }
  }

  /**
   * Write content to a file
   * @param filePath - Path to the file
   * @param content - Content to write
   * @param options - Write options
   */
  async writeFile(filePath: string, content: string, options?: WriteOptions): Promise<void> {
    const encoding = options?.encoding ?? 'utf-8';
    try {
      if (options?.createDirs) {
        const dirPath = path.dirname(filePath);
        await fs.mkdir(dirPath, { recursive: true });
      }
      await fs.writeFile(filePath, content, {
        encoding,
        mode: options?.mode,
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new BTWError(ErrorCode.DIRECTORY_NOT_FOUND, `Parent directory not found: ${path.dirname(filePath)}`, {
          context: { filePath },
          cause: err,
        });
      }
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new BTWError(ErrorCode.PERMISSION_DENIED, `Permission denied: ${filePath}`, {
          context: { filePath },
          cause: err,
        });
      }
      throw new BTWError(ErrorCode.FILE_WRITE_ERROR, `Failed to write file: ${filePath}`, {
        context: { filePath },
        cause: err,
      });
    }
  }

  /**
   * Check if a file or directory exists
   * @param path - Path to check
   */
  async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a directory (and parent directories if needed)
   * @param dirPath - Directory path to create
   */
  async mkdir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new BTWError(ErrorCode.PERMISSION_DENIED, `Permission denied: ${dirPath}`, {
          context: { dirPath },
          cause: err,
        });
      }
      throw new BTWError(ErrorCode.FILE_WRITE_ERROR, `Failed to create directory: ${dirPath}`, {
        context: { dirPath },
        cause: err,
      });
    }
  }

  /**
   * Remove a file or directory
   * @param path - Path to remove
   * @param recursive - Remove directories recursively
   */
  async remove(targetPath: string, recursive: boolean = false): Promise<void> {
    try {
      await fs.rm(targetPath, { recursive, force: false });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new BTWError(ErrorCode.FILE_NOT_FOUND, `Path not found: ${targetPath}`, {
          context: { path: targetPath },
          cause: err,
        });
      }
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new BTWError(ErrorCode.PERMISSION_DENIED, `Permission denied: ${targetPath}`, {
          context: { path: targetPath },
          cause: err,
        });
      }
      if (err.code === 'ENOTEMPTY') {
        throw new BTWError(ErrorCode.FILE_WRITE_ERROR, `Directory not empty: ${targetPath}. Use recursive option to remove.`, {
          context: { path: targetPath },
          cause: err,
        });
      }
      throw new BTWError(ErrorCode.FILE_WRITE_ERROR, `Failed to remove: ${targetPath}`, {
        context: { path: targetPath },
        cause: err,
      });
    }
  }

  /**
   * Copy a file or directory
   * @param source - Source path
   * @param destination - Destination path
   * @param options - Copy options
   */
  async copy(source: string, destination: string, options?: CopyOptions): Promise<void> {
    try {
      await fs.cp(source, destination, {
        recursive: true,
        force: options?.overwrite ?? false,
        preserveTimestamps: options?.preserveTimestamps ?? false,
      });
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new BTWError(ErrorCode.FILE_NOT_FOUND, `Source not found: ${source}`, {
          context: { source, destination },
          cause: err,
        });
      }
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new BTWError(ErrorCode.PERMISSION_DENIED, `Permission denied during copy`, {
          context: { source, destination },
          cause: err,
        });
      }
      if (err.code === 'EEXIST') {
        throw new BTWError(ErrorCode.FILE_WRITE_ERROR, `Destination already exists: ${destination}. Use overwrite option.`, {
          context: { source, destination },
          cause: err,
        });
      }
      throw new BTWError(ErrorCode.FILE_WRITE_ERROR, `Failed to copy from ${source} to ${destination}`, {
        context: { source, destination },
        cause: err,
      });
    }
  }

  /**
   * List directory contents
   * @param dirPath - Directory to list
   */
  async readdir(dirPath: string): Promise<FileInfo[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const fileInfos: FileInfo[] = [];

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        try {
          const stats = await fs.stat(entryPath);
          fileInfos.push({
            path: entryPath,
            name: entry.name,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            size: stats.size,
            modifiedAt: stats.mtime,
            createdAt: stats.birthtime,
          });
        } catch {
          // Skip entries we can't stat (e.g., broken symlinks)
          continue;
        }
      }

      return fileInfos;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new BTWError(ErrorCode.DIRECTORY_NOT_FOUND, `Directory not found: ${dirPath}`, {
          context: { dirPath },
          cause: err,
        });
      }
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new BTWError(ErrorCode.PERMISSION_DENIED, `Permission denied: ${dirPath}`, {
          context: { dirPath },
          cause: err,
        });
      }
      if (err.code === 'ENOTDIR') {
        throw new BTWError(ErrorCode.DIRECTORY_NOT_FOUND, `Not a directory: ${dirPath}`, {
          context: { dirPath },
          cause: err,
        });
      }
      throw new BTWError(ErrorCode.FILE_READ_ERROR, `Failed to read directory: ${dirPath}`, {
        context: { dirPath },
        cause: err,
      });
    }
  }

  /**
   * Get file information
   * @param path - Path to get info for
   */
  async stat(targetPath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(targetPath);
      return {
        path: targetPath,
        name: path.basename(targetPath),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        modifiedAt: stats.mtime,
        createdAt: stats.birthtime,
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new BTWError(ErrorCode.FILE_NOT_FOUND, `Path not found: ${targetPath}`, {
          context: { path: targetPath },
          cause: err,
        });
      }
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        throw new BTWError(ErrorCode.PERMISSION_DENIED, `Permission denied: ${targetPath}`, {
          context: { path: targetPath },
          cause: err,
        });
      }
      throw new BTWError(ErrorCode.FILE_READ_ERROR, `Failed to get stats for: ${targetPath}`, {
        context: { path: targetPath },
        cause: err,
      });
    }
  }

  /**
   * Create a backup of a file
   * @param filePath - File to backup
   * @param backupPath - Backup destination (optional, defaults to .btw-backup extension)
   */
  async backup(filePath: string, backupPath?: string): Promise<string> {
    const targetBackupPath = backupPath ?? `${filePath}${BACKUP_EXTENSION}`;
    try {
      // Verify source file exists
      const exists = await this.exists(filePath);
      if (!exists) {
        throw new BTWError(ErrorCode.FILE_NOT_FOUND, `Source file not found: ${filePath}`, {
          context: { filePath, backupPath: targetBackupPath },
        });
      }

      // Copy file to backup location
      await this.copy(filePath, targetBackupPath, { overwrite: true });
      return targetBackupPath;
    } catch (error) {
      if (error instanceof BTWError) {
        throw error;
      }
      const err = error as NodeJS.ErrnoException;
      throw new BTWError(ErrorCode.FILE_WRITE_ERROR, `Failed to create backup of: ${filePath}`, {
        context: { filePath, backupPath: targetBackupPath },
        cause: err,
      });
    }
  }

  /**
   * Restore a file from backup
   * @param backupPath - Backup file path
   * @param targetPath - Target restore path
   */
  async restore(backupPath: string, targetPath: string): Promise<void> {
    try {
      // Verify backup file exists
      const exists = await this.exists(backupPath);
      if (!exists) {
        throw new BTWError(ErrorCode.FILE_NOT_FOUND, `Backup file not found: ${backupPath}`, {
          context: { backupPath, targetPath },
        });
      }

      // Copy backup to target location
      await this.copy(backupPath, targetPath, { overwrite: true });
    } catch (error) {
      if (error instanceof BTWError) {
        throw error;
      }
      const err = error as NodeJS.ErrnoException;
      throw new BTWError(ErrorCode.FILE_WRITE_ERROR, `Failed to restore backup from: ${backupPath}`, {
        context: { backupPath, targetPath },
        cause: err,
      });
    }
  }
}

/**
 * Singleton instance of FileSystem
 */
export const fileSystem = new FileSystem();
