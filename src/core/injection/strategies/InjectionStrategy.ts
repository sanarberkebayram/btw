/**
 * BTW - Injection Strategy Interface
 * Defines the contract for AI tool injection strategies
 */

import { AITarget, Manifest, InjectionResult } from '../../../types/index.js';

/**
 * Options for injection operation
 */
export interface InjectOptions {
  /** Target project root directory */
  projectRoot: string;
  /** Create backup before injection */
  backup?: boolean;
  /** Force injection even if target config exists */
  force?: boolean;
  /** Merge with existing configuration */
  merge?: boolean;
}

/**
 * Options for ejection (removal) operation
 */
export interface EjectOptions {
  /** Target project root directory */
  projectRoot: string;
  /** Restore from backup if available */
  restoreBackup?: boolean;
  /** Remove all BTW-related content */
  clean?: boolean;
}

/**
 * Result of checking injection status
 */
export interface InjectionStatus {
  /** Whether BTW content is currently injected */
  isInjected: boolean;
  /** Workflow ID if injected */
  workflowId?: string;
  /** Timestamp of injection */
  injectedAt?: string;
  /** Whether backup exists */
  hasBackup?: boolean;
  /** Path to backup file */
  backupPath?: string;
}

/**
 * Interface for AI tool-specific injection strategies
 * Each AI tool (Claude, Cursor, etc.) has its own implementation
 */
export interface InjectionStrategy {
  /**
   * The AI target this strategy handles
   */
  readonly target: AITarget;

  /**
   * Check if this strategy can handle the given target
   * @param target - AI target to check
   */
  canHandle(target: AITarget): boolean;

  /**
   * Inject workflow content into the AI tool's configuration
   * @param manifest - Workflow manifest to inject
   * @param options - Injection options
   */
  inject(manifest: Manifest, options: InjectOptions): Promise<InjectionResult>;

  /**
   * Remove injected workflow content from the AI tool's configuration
   * @param options - Ejection options
   */
  eject(options: EjectOptions): Promise<void>;

  /**
   * Check the current injection status
   * @param projectRoot - Project root directory
   */
  getStatus(projectRoot: string): Promise<InjectionStatus>;

  /**
   * Validate that the target configuration is in a valid state
   * @param projectRoot - Project root directory
   */
  validate(projectRoot: string): Promise<boolean>;

  /**
   * Generate the configuration content for this target
   * @param manifest - Workflow manifest
   */
  generateConfig(manifest: Manifest): string;

  /**
   * Generate the instructions/rules content for this target
   * @param manifest - Workflow manifest
   */
  generateInstructions(manifest: Manifest): string;
}

/**
 * Abstract base class providing common functionality for injection strategies
 */
export abstract class BaseInjectionStrategy implements InjectionStrategy {
  abstract readonly target: AITarget;

  canHandle(target: AITarget): boolean {
    return this.target === target;
  }

  abstract inject(manifest: Manifest, options: InjectOptions): Promise<InjectionResult>;
  abstract eject(options: EjectOptions): Promise<void>;
  abstract getStatus(projectRoot: string): Promise<InjectionStatus>;
  abstract validate(projectRoot: string): Promise<boolean>;
  abstract generateConfig(manifest: Manifest): string;
  abstract generateInstructions(manifest: Manifest): string;

  /**
   * Create BTW marker comment for tracking injections
   * @param workflowId - Workflow identifier
   */
  protected createMarker(workflowId: string): string {
    return `<!-- BTW:${workflowId}:${new Date().toISOString()} -->`;
  }

  /**
   * Extract BTW marker from content
   * @param content - Content to search
   */
  protected extractMarker(content: string): { workflowId: string; timestamp: string } | null {
    const match = content.match(/<!-- BTW:([^:]+):([^>]+) -->/);
    if (match && match[1] && match[2]) {
      return { workflowId: match[1], timestamp: match[2] };
    }
    return null;
  }
}
