/**
 * BTW - Configuration Constants
 * Central location for all configuration constants and paths
 */

import { AITarget } from '../../types/index.js';
import { homedir } from 'os';
import { join } from 'path';

/**
 * BTW home directory (default: ~/.btw)
 */
export const BTW_HOME = process.env.BTW_HOME || join(homedir(), '.btw');

/**
 * Directory for storing installed workflows
 */
export const WORKFLOWS_DIR = join(BTW_HOME, 'workflows');

/**
 * Directory for caching downloaded workflows
 */
export const CACHE_DIR = join(BTW_HOME, 'cache');

/**
 * Path to the global BTW state file
 */
export const STATE_FILE = join(BTW_HOME, 'state.json');

/**
 * Path to the BTW configuration file
 */
export const CONFIG_FILE = join(BTW_HOME, 'config.json');

/**
 * Manifest file name
 */
export const MANIFEST_FILENAME = 'btw.yaml';

/**
 * Backup file extension
 */
export const BACKUP_EXTENSION = '.btw-backup';

/**
 * Current state schema version
 */
export const STATE_VERSION = '1.0.0';

/**
 * Current manifest schema version
 */
export const MANIFEST_VERSION = '1.0';

/**
 * AI Tool configuration file mappings
 * Maps AI targets to their configuration file paths relative to project root
 */
export const AI_TOOL_MAPPINGS: Record<AITarget, AiToolConfig> = {
  claude: {
    configPath: '.claude/settings.json',
    instructionsPath: '.claude/instructions.md',
    projectConfigPath: '.claude/project.json',
    supportsSystemPrompt: true,
    supportsMultiAgent: false,
  },
  cursor: {
    configPath: '.cursor/settings.json',
    instructionsPath: '.cursorrules',
    projectConfigPath: '.cursor/config.json',
    supportsSystemPrompt: true,
    supportsMultiAgent: true,
  },
  windsurf: {
    configPath: '.windsurf/config.json',
    instructionsPath: '.windsurfrules',
    projectConfigPath: '.windsurf/project.json',
    supportsSystemPrompt: true,
    supportsMultiAgent: true,
  },
  copilot: {
    configPath: '.github/copilot/config.json',
    instructionsPath: '.github/copilot-instructions.md',
    projectConfigPath: '.github/copilot/settings.json',
    supportsSystemPrompt: true,
    supportsMultiAgent: false,
  },
};

/**
 * Configuration for a specific AI tool
 */
export interface AiToolConfig {
  /** Path to the main configuration file */
  configPath: string;
  /** Path to the instructions/rules file */
  instructionsPath: string;
  /** Path to project-specific configuration */
  projectConfigPath: string;
  /** Whether the tool supports custom system prompts */
  supportsSystemPrompt: boolean;
  /** Whether the tool supports multiple agents */
  supportsMultiAgent: boolean;
}

/**
 * Default AI target when not specified
 */
export const DEFAULT_AI_TARGET: AITarget = 'claude';

/**
 * Supported manifest versions
 */
export const SUPPORTED_MANIFEST_VERSIONS = ['1.0'];

/**
 * Default workflow repository URL
 */
export const DEFAULT_WORKFLOW_REPOSITORY = 'https://github.com/btw-workflows/registry';

/**
 * Environment variable names
 */
export const ENV_VARS = {
  BTW_HOME: 'BTW_HOME',
  BTW_DEBUG: 'BTW_DEBUG',
  BTW_NO_COLOR: 'BTW_NO_COLOR',
  BTW_DEFAULT_TARGET: 'BTW_DEFAULT_TARGET',
} as const;

/**
 * CLI command names
 */
export const COMMANDS = {
  ADD: 'add',
  LIST: 'list',
  INJECT: 'inject',
  REMOVE: 'remove',
} as const;
