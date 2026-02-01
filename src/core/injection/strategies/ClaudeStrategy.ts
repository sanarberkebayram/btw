/**
 * BTW - Claude Injection Strategy
 * Handles injection into Claude Code's configuration
 */

import { AITarget, Manifest, InjectionResult } from '../../../types/index.js';
import { BTWError, ErrorCode } from '../../../types/errors.js';
import {
  BaseInjectionStrategy,
  InjectOptions,
  EjectOptions,
  InjectionStatus,
} from './InjectionStrategy.js';
import { fileSystem } from '../../../infrastructure/fs/FileSystem.js';
import { pathResolver } from '../../../infrastructure/fs/PathResolver.js';
import path from 'path';

/**
 * Claude-specific configuration structure
 */
interface ClaudeConfig {
  /** Custom instructions for Claude */
  instructions?: string;
  /** Model preferences */
  model?: string;
  /** Additional settings */
  settings?: Record<string, unknown>;
  /** BTW metadata */
  _btw?: {
    workflowId: string;
    injectedAt: string;
    version: string;
  };
}

/**
 * BTW content markers for identifying injected content
 */
const BTW_START_MARKER = '<!-- BTW_START -->';
const BTW_END_MARKER = '<!-- BTW_END -->';
const BTW_VERSION = '1.0.0';

/**
 * Injection strategy for Claude Code
 * Handles .claude/settings.json and .claude/instructions.md
 */
export class ClaudeStrategy extends BaseInjectionStrategy {
  readonly target: AITarget = 'claude';

  /**
   * Inject workflow into Claude configuration
   * @param manifest - Workflow manifest
   * @param options - Injection options
   */
  async inject(manifest: Manifest, options: InjectOptions): Promise<InjectionResult> {
    const paths = pathResolver.resolveAiToolPaths(options.projectRoot, 'claude');
    const { instructionsPath } = paths;
    const claudeDir = path.dirname(instructionsPath);

    let backupCreated = false;
    let backupPath: string | undefined;

    try {
      // 1. Create .claude directory if needed
      await fileSystem.mkdir(claudeDir);

      // 2. Check if instructions file exists
      const instructionsExist = await fileSystem.exists(instructionsPath);

      // 3. Create backup if requested and file exists
      if (options.backup && instructionsExist) {
        try {
          backupPath = await fileSystem.backup(instructionsPath);
          backupCreated = true;
        } catch (error) {
          throw new BTWError(
            ErrorCode.BACKUP_FAILED,
            `Failed to create backup of ${instructionsPath}`,
            { cause: error instanceof Error ? error : undefined }
          );
        }
      }

      // 4. Check for existing BTW marker if not forcing
      if (!options.force && instructionsExist) {
        const existingContent = await fileSystem.readFile(instructionsPath);
        const existingMarker = this.extractMarker(existingContent);

        if (existingMarker && existingMarker.workflowId !== manifest.id) {
          throw new BTWError(
            ErrorCode.INJECTION_FAILED,
            `A different workflow (${existingMarker.workflowId}) is already injected. Use --force to override.`,
            {
              context: {
                existingWorkflowId: existingMarker.workflowId,
                newWorkflowId: manifest.id,
              },
            }
          );
        }
      }

      // 5. Generate instructions content
      const btwContent = this.generateInstructions(manifest);

      // 6. Handle merge option
      let finalContent: string;
      if (options.merge && instructionsExist) {
        const existingContent = await fileSystem.readFile(instructionsPath);
        // Remove any existing BTW content first
        const cleanedContent = this.removeBtwContent(existingContent);
        // Append new BTW content with separator
        finalContent = cleanedContent.trim()
          ? `${cleanedContent.trim()}\n\n---\n\n${btwContent}`
          : btwContent;
      } else {
        finalContent = btwContent;
      }

      // 7. Write instructions file
      await fileSystem.writeFile(instructionsPath, finalContent, { createDirs: true });

      // 8. Return injection result
      return {
        target: 'claude',
        configPath: instructionsPath,
        agentCount: manifest.agents.length,
        backupCreated,
        backupPath,
      };
    } catch (error) {
      if (error instanceof BTWError) {
        throw error;
      }
      throw new BTWError(
        ErrorCode.INJECTION_FAILED,
        `Failed to inject workflow into Claude configuration: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Remove injected workflow from Claude configuration
   * @param options - Ejection options
   */
  async eject(options: EjectOptions): Promise<void> {
    const paths = pathResolver.resolveAiToolPaths(options.projectRoot, 'claude');
    const { instructionsPath } = paths;
    const claudeDir = path.dirname(instructionsPath);
    const backupPath = `${instructionsPath}.btw-backup`;

    try {
      // 1. Check if instructions file exists
      const instructionsExist = await fileSystem.exists(instructionsPath);

      if (!instructionsExist) {
        // Nothing to eject
        return;
      }

      // 2. Check if backup exists
      const backupExists = await fileSystem.exists(backupPath);

      // 3. Handle restore from backup
      if (options.restoreBackup && backupExists) {
        try {
          await fileSystem.restore(backupPath, instructionsPath);
          // Remove backup after restore
          await fileSystem.remove(backupPath);
          return;
        } catch (error) {
          throw new BTWError(
            ErrorCode.RESTORE_FAILED,
            `Failed to restore from backup: ${backupPath}`,
            { cause: error instanceof Error ? error : undefined }
          );
        }
      }

      // 4. Handle clean option - remove entire .claude directory
      if (options.clean) {
        try {
          await fileSystem.remove(claudeDir, true);
          return;
        } catch (error) {
          // Directory might not exist, that's ok
          if (!(error instanceof BTWError && error.code === ErrorCode.FILE_NOT_FOUND)) {
            throw error;
          }
        }
        return;
      }

      // 5. Remove only BTW content while preserving user content
      const existingContent = await fileSystem.readFile(instructionsPath);
      const cleanedContent = this.removeBtwContent(existingContent);

      // 6. Write back or remove file if empty
      if (cleanedContent.trim()) {
        await fileSystem.writeFile(instructionsPath, cleanedContent.trim() + '\n');
      } else {
        await fileSystem.remove(instructionsPath);
      }
    } catch (error) {
      if (error instanceof BTWError) {
        throw error;
      }
      throw new BTWError(
        ErrorCode.INJECTION_FAILED,
        `Failed to eject workflow from Claude configuration: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  /**
   * Get current injection status for Claude
   * @param projectRoot - Project root directory
   */
  async getStatus(projectRoot: string): Promise<InjectionStatus> {
    const paths = pathResolver.resolveAiToolPaths(projectRoot, 'claude');
    const { instructionsPath } = paths;
    const backupPath = `${instructionsPath}.btw-backup`;

    try {
      // 1. Check if instructions file exists
      const instructionsExist = await fileSystem.exists(instructionsPath);

      if (!instructionsExist) {
        return {
          isInjected: false,
          hasBackup: await fileSystem.exists(backupPath),
          backupPath: (await fileSystem.exists(backupPath)) ? backupPath : undefined,
        };
      }

      // 2. Read content and extract marker
      const content = await fileSystem.readFile(instructionsPath);
      const marker = this.extractMarker(content);

      // 3. Check if backup exists
      const backupExists = await fileSystem.exists(backupPath);

      // 4. Return status
      return {
        isInjected: marker !== null,
        workflowId: marker?.workflowId,
        injectedAt: marker?.timestamp,
        hasBackup: backupExists,
        backupPath: backupExists ? backupPath : undefined,
      };
    } catch (error) {
      // If we can't read the file, assume not injected
      return {
        isInjected: false,
        hasBackup: false,
      };
    }
  }

  /**
   * Validate Claude configuration
   * @param projectRoot - Project root directory
   */
  async validate(projectRoot: string): Promise<boolean> {
    const paths = pathResolver.resolveAiToolPaths(projectRoot, 'claude');
    const { instructionsPath, configPath } = paths;

    try {
      // 1. Check instructions file if it exists
      const instructionsExist = await fileSystem.exists(instructionsPath);
      if (instructionsExist) {
        try {
          await fileSystem.readFile(instructionsPath);
        } catch {
          return false;
        }
      }

      // 2. Check settings file if it exists
      const settingsExist = await fileSystem.exists(configPath);
      if (settingsExist) {
        try {
          const content = await fileSystem.readFile(configPath);
          JSON.parse(content);
        } catch {
          return false;
        }
      }

      // 3. Files don't exist yet - valid state
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate Claude settings.json content
   * @param manifest - Workflow manifest
   */
  generateConfig(manifest: Manifest): string {
    const config: ClaudeConfig = {};

    // Only include defined values
    if (manifest.agents[0]?.model) {
      config.model = manifest.agents[0].model;
    }

    // Add BTW metadata
    config._btw = {
      workflowId: manifest.id,
      injectedAt: new Date().toISOString(),
      version: BTW_VERSION,
    };

    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate Claude instructions.md content
   * @param manifest - Workflow manifest
   */
  generateInstructions(manifest: Manifest): string {
    const marker = this.createMarker(manifest.id);
    const lines: string[] = [];

    // Start marker
    lines.push(BTW_START_MARKER);
    lines.push(marker);
    lines.push('');

    // Header section
    lines.push(`# ${manifest.name}`);
    lines.push('');

    if (manifest.description) {
      lines.push(manifest.description);
      lines.push('');
    }

    // Workflow metadata
    lines.push('## Workflow Information');
    lines.push('');
    lines.push(`- **Workflow ID:** ${manifest.id}`);
    lines.push(`- **Version:** ${manifest.version}`);
    if (manifest.author) {
      lines.push(`- **Author:** ${manifest.author}`);
    }
    if (manifest.repository) {
      lines.push(`- **Repository:** ${manifest.repository}`);
    }
    lines.push('');

    // Agent sections
    if (manifest.agents.length > 0) {
      lines.push('## Agents');
      lines.push('');

      manifest.agents.forEach((agent, index) => {
        lines.push(`### ${agent.name}`);
        lines.push('');

        if (agent.description) {
          lines.push(`> ${agent.description}`);
          lines.push('');
        }

        if (agent.tags && agent.tags.length > 0) {
          lines.push(`**Tags:** ${agent.tags.join(', ')}`);
          lines.push('');
        }

        lines.push('#### Instructions');
        lines.push('');
        lines.push(agent.systemPrompt);
        lines.push('');

        // Add separator between agents (except for last)
        if (index < manifest.agents.length - 1) {
          lines.push('---');
          lines.push('');
        }
      });
    }

    // Footer
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`*Injected by BTW v${BTW_VERSION} at ${new Date().toISOString()}*`);
    lines.push('');
    lines.push(BTW_END_MARKER);

    return lines.join('\n');
  }

  /**
   * Get the path to Claude's instructions file
   * @param projectRoot - Project root directory
   */
  private getInstructionsPath(projectRoot: string): string {
    const paths = pathResolver.resolveAiToolPaths(projectRoot, 'claude');
    return paths.instructionsPath;
  }

  /**
   * Get the path to Claude's settings file
   * @param projectRoot - Project root directory
   */
  private getSettingsPath(projectRoot: string): string {
    const paths = pathResolver.resolveAiToolPaths(projectRoot, 'claude');
    return paths.configPath;
  }

  /**
   * Remove BTW content from existing instructions
   * @param content - Existing instructions content
   */
  private removeBtwContent(content: string): string {
    // Remove content between BTW markers
    const startIndex = content.indexOf(BTW_START_MARKER);
    const endIndex = content.indexOf(BTW_END_MARKER);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const before = content.substring(0, startIndex);
      const after = content.substring(endIndex + BTW_END_MARKER.length);
      return (before + after).trim();
    }

    // Fallback: Try to remove content based on BTW marker comment
    const markerRegex = /<!-- BTW:[^:]+:[^>]+ -->[\s\S]*$/;
    return content.replace(markerRegex, '').trim();
  }
}

/**
 * Singleton instance of ClaudeStrategy
 */
export const claudeStrategy = new ClaudeStrategy();
