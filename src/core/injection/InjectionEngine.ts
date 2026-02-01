/**
 * BTW - Injection Engine
 * Orchestrates workflow injection across different AI tools
 */

import { AITarget, Manifest, InjectionResult, OperationResult } from '../../types/index.js';
import { BTWError, ErrorCode } from '../../types/errors.js';
import {
  InjectionStrategy,
  InjectOptions,
  EjectOptions,
  InjectionStatus,
} from './strategies/InjectionStrategy.js';
import { ClaudeStrategy } from './strategies/ClaudeStrategy.js';
import { stateManager } from '../state/StateManager.js';

/**
 * Options for the injection engine
 */
export interface InjectionEngineOptions {
  /** Custom strategies to register */
  strategies?: InjectionStrategy[];
}

/**
 * Options for multi-target injection
 */
export interface MultiInjectOptions extends Omit<InjectOptions, 'projectRoot'> {
  /** Project root directory */
  projectRoot: string;
  /** Specific targets to inject (defaults to all supported by manifest) */
  targets?: AITarget[];
}

/**
 * Result of multi-target injection
 */
export interface MultiInjectionResult {
  /** Results for each target */
  results: Map<AITarget, InjectionResult>;
  /** Targets that failed */
  failures: Map<AITarget, Error>;
  /** Overall success */
  success: boolean;
}

/**
 * Central engine for managing workflow injection across AI tools
 */
export class InjectionEngine {
  private strategies: Map<AITarget, InjectionStrategy>;

  constructor(options?: InjectionEngineOptions) {
    this.strategies = new Map();

    // Register default strategies
    this.registerStrategy(new ClaudeStrategy());

    // TODO: Register other strategies when implemented
    // this.registerStrategy(new CursorStrategy());
    // this.registerStrategy(new WindsurfStrategy());
    // this.registerStrategy(new CopilotStrategy());

    // Register custom strategies
    if (options?.strategies) {
      for (const strategy of options.strategies) {
        this.registerStrategy(strategy);
      }
    }
  }

  /**
   * Register an injection strategy
   * @param strategy - Strategy to register
   */
  registerStrategy(strategy: InjectionStrategy): void {
    this.strategies.set(strategy.target, strategy);
  }

  /**
   * Get a strategy for a specific target
   * @param target - AI target
   */
  getStrategy(target: AITarget): InjectionStrategy | undefined {
    return this.strategies.get(target);
  }

  /**
   * Check if a target is supported
   * @param target - AI target to check
   */
  isTargetSupported(target: AITarget): boolean {
    return this.strategies.has(target);
  }

  /**
   * Get all supported targets
   */
  getSupportedTargets(): AITarget[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Inject a workflow into a single AI tool
   * @param manifest - Workflow manifest
   * @param target - Target AI tool
   * @param options - Injection options
   */
  async inject(
    manifest: Manifest,
    target: AITarget,
    options: InjectOptions
  ): Promise<OperationResult<InjectionResult>> {
    try {
      // 1. Get strategy for target
      const strategy = this.getStrategy(target);
      if (!strategy) {
        throw new BTWError(
          ErrorCode.TARGET_NOT_SUPPORTED,
          `Target '${target}' is not supported`,
          { context: { target } }
        );
      }

      // 2. Validate manifest supports target
      if (!this.validateManifestForTarget(manifest, target)) {
        return {
          success: false,
          error: `Manifest does not support target '${target}'`,
        };
      }

      // 3. Execute strategy injection
      const result = await strategy.inject(manifest, options);

      // 4. Update state manager
      try {
        const projectState = stateManager.getProjectState(options.projectRoot);
        if (projectState) {
          const workflow = projectState.workflows.find(
            (w) => w.workflowId === manifest.id
          );
          if (workflow) {
            stateManager.updateWorkflow(options.projectRoot, manifest.id, {
              lastInjectedAt: new Date().toISOString(),
            });
            await stateManager.save();
          }
        }
      } catch {
        // State update is best-effort, don't fail the injection
      }

      // 5. Return success result
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof BTWError) {
        if (error.code === ErrorCode.TARGET_NOT_SUPPORTED) {
          throw error;
        }
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Inject a workflow into multiple AI tools
   * @param manifest - Workflow manifest
   * @param options - Multi-injection options
   */
  async injectMultiple(
    manifest: Manifest,
    options: MultiInjectOptions
  ): Promise<OperationResult<MultiInjectionResult>> {
    try {
      // 1. Determine targets
      const requestedTargets = options.targets ?? manifest.targets;

      // 2. Filter to supported targets only
      const supportedTargets = requestedTargets.filter((target) =>
        this.isTargetSupported(target)
      );

      // 3. Create results and failures maps
      const results = new Map<AITarget, InjectionResult>();
      const failures = new Map<AITarget, Error>();

      // 4. For each target, try to inject
      for (const target of supportedTargets) {
        try {
          const injectResult = await this.inject(manifest, target, {
            projectRoot: options.projectRoot,
            backup: options.backup,
            force: options.force,
            merge: options.merge,
          });

          if (injectResult.success && injectResult.data) {
            results.set(target, injectResult.data);
          } else {
            failures.set(
              target,
              new Error(injectResult.error ?? 'Injection failed')
            );
          }
        } catch (error) {
          failures.set(
            target,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      // 5. Return MultiInjectionResult
      return {
        success: true,
        data: {
          results,
          failures,
          success: failures.size === 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Remove injection from a single AI tool
   * @param target - Target AI tool
   * @param options - Ejection options
   */
  async eject(target: AITarget, options: EjectOptions): Promise<OperationResult> {
    try {
      // 1. Get strategy for target
      const strategy = this.getStrategy(target);
      if (!strategy) {
        throw new BTWError(
          ErrorCode.TARGET_NOT_SUPPORTED,
          `Target '${target}' is not supported`,
          { context: { target } }
        );
      }

      // 2. Execute strategy ejection
      await strategy.eject(options);

      // 3. Return success result
      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof BTWError && error.code === ErrorCode.TARGET_NOT_SUPPORTED) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Remove injection from all AI tools in a project
   * @param projectRoot - Project root directory
   * @param options - Ejection options
   */
  async ejectAll(
    projectRoot: string,
    options?: Omit<EjectOptions, 'projectRoot'>
  ): Promise<OperationResult> {
    try {
      // 1. Get statuses for all targets
      const statuses = await this.getAllStatuses(projectRoot);
      const warnings: string[] = [];

      // 2. For each status where isInjected is true, eject
      for (const [target, status] of statuses) {
        if (status.isInjected) {
          try {
            const strategy = this.getStrategy(target);
            if (strategy) {
              await strategy.eject({
                projectRoot,
                ...options,
              });
            }
          } catch (error) {
            // Collect errors as warnings
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            warnings.push(`Failed to eject from ${target}: ${errorMessage}`);
          }
        }
      }

      // 3. Return result with any warnings for failed ejections
      return {
        success: true,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get injection status for a specific target
   * @param target - AI target
   * @param projectRoot - Project root directory
   */
  async getStatus(target: AITarget, projectRoot: string): Promise<InjectionStatus> {
    // 1. Get strategy for target
    const strategy = this.getStrategy(target);
    if (!strategy) {
      throw new BTWError(
        ErrorCode.TARGET_NOT_SUPPORTED,
        `Target '${target}' is not supported`,
        { context: { target } }
      );
    }

    // 2. Return strategy status
    return strategy.getStatus(projectRoot);
  }

  /**
   * Get injection status for all targets in a project
   * @param projectRoot - Project root directory
   */
  async getAllStatuses(projectRoot: string): Promise<Map<AITarget, InjectionStatus>> {
    // 1. Create result Map
    const result = new Map<AITarget, InjectionStatus>();

    // 2. For each strategy, get status and add to result map
    for (const [target, strategy] of this.strategies) {
      const status = await strategy.getStatus(projectRoot);
      result.set(target, status);
    }

    // 3. Return map
    return result;
  }

  /**
   * Validate that a manifest can be injected into a target
   * @param manifest - Workflow manifest
   * @param target - AI target
   */
  validateManifestForTarget(manifest: Manifest, target: AITarget): boolean {
    // Check if manifest declares support for this target
    return manifest.targets.includes(target);
  }
}

/**
 * Singleton instance of InjectionEngine
 */
export const injectionEngine = new InjectionEngine();
