/**
 * BTW - Shared Types
 * Central type definitions for the BTW workflow injection system
 */

/**
 * Supported AI tool targets for workflow injection
 */
export type AITarget = 'claude' | 'cursor' | 'windsurf' | 'copilot';

/**
 * Definition of a single agent within a workflow
 */
export interface AgentDefinition {
  /** Unique identifier for the agent */
  id: string;
  /** Human-readable name of the agent */
  name: string;
  /** Description of what this agent does */
  description: string;
  /** System prompt or instructions for this agent */
  systemPrompt: string;
  /** Optional model override for this specific agent */
  model?: string;
  /** Optional temperature setting */
  temperature?: number;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Hook definitions for workflow lifecycle events
 */
export interface HookDefinitions {
  /** Commands to run before workflow injection */
  preInject?: string[];
  /** Commands to run after workflow injection */
  postInject?: string[];
  /** Commands to run before workflow removal */
  preRemove?: string[];
  /** Commands to run after workflow removal */
  postRemove?: string[];
}

/**
 * Workflow manifest definition (btw.yaml schema)
 */
export interface Manifest {
  /** Manifest schema version */
  version: string;
  /** Unique identifier for this workflow */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description of the workflow */
  description: string;
  /** Author information */
  author?: string;
  /** License identifier */
  license?: string;
  /** Repository URL */
  repository?: string;
  /** Supported AI targets */
  targets: AITarget[];
  /** Agent definitions */
  agents: AgentDefinition[];
  /** Lifecycle hooks */
  hooks?: HookDefinitions;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * State of a single workflow installation
 */
export interface WorkflowState {
  /** Workflow identifier */
  workflowId: string;
  /** Version of the installed workflow */
  version: string;
  /** Installation timestamp (ISO 8601) */
  installedAt: string;
  /** Last injection timestamp (ISO 8601) */
  lastInjectedAt?: string;
  /** Source path or URL of the workflow */
  source: string;
  /** Whether this workflow is currently active */
  active: boolean;
  /** Hash of the workflow content for change detection */
  contentHash?: string;
}

/**
 * Project-level state tracking
 */
export interface ProjectState {
  /** Absolute path to the project root */
  projectPath: string;
  /** Array of installed workflow states */
  workflows: WorkflowState[];
  /** Currently active AI target */
  activeTarget?: AITarget;
  /** Project initialization timestamp */
  initializedAt: string;
  /** Last modification timestamp */
  lastModifiedAt: string;
}

/**
 * Global BTW state
 */
export interface BTWState {
  /** State schema version */
  version: string;
  /** Map of project paths to their states */
  projects: Record<string, ProjectState>;
  /** Global configuration overrides */
  globalConfig?: {
    defaultTarget?: AITarget;
    autoInject?: boolean;
  };
}

/**
 * Repository information for workflow sources
 */
export interface WorkflowRepository {
  /** Repository name/identifier */
  name: string;
  /** Repository URL (git or HTTP) */
  url: string;
  /** Repository type */
  type: 'git' | 'local' | 'http';
  /** Branch to use (for git repositories) */
  branch?: string;
  /** Whether this is the default repository */
  isDefault?: boolean;
}

/**
 * Result of a workflow operation
 */
export interface OperationResult<T = void> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Warning messages */
  warnings?: string[];
}

/**
 * Injection result details
 */
export interface InjectionResult {
  /** Target AI tool that was injected */
  target: AITarget;
  /** Path to the injected configuration file */
  configPath: string;
  /** Number of agents injected */
  agentCount: number;
  /** Whether a backup was created */
  backupCreated: boolean;
  /** Path to backup file if created */
  backupPath?: string;
}
