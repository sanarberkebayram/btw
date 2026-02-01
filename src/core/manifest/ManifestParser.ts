/**
 * BTW - Manifest Parser
 * Parses and validates btw.yaml manifest files
 */

import YAML from 'yaml';
import { z } from 'zod';
import { fileSystem } from '../../infrastructure/fs/FileSystem.js';
import { Manifest, AgentDefinition, HookDefinitions, AITarget } from '../../types/index.js';
import { BTWError, ErrorCode } from '../../types/errors.js';
import {
  RawManifest,
  RawAgentDefinition,
  RawHookDefinitions,
  ManifestValidationResult,
  ManifestValidationError,
  ParsedManifest,
  MANIFEST_SCHEMA,
} from './types.js';
import path from 'path';

/**
 * Zod schema for AITarget validation
 */
export const AITargetSchema = z.enum(['claude', 'cursor', 'windsurf', 'copilot']);

/**
 * Zod schema for AgentDefinition validation
 */
export const AgentDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  systemPrompt: z.string().min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Zod schema for HookDefinitions validation
 */
export const HookDefinitionsSchema = z.object({
  preInject: z.array(z.string()).optional(),
  postInject: z.array(z.string()).optional(),
  preRemove: z.array(z.string()).optional(),
  postRemove: z.array(z.string()).optional(),
});

/**
 * Zod schema for full Manifest validation
 */
export const ManifestZodSchema = z.object({
  version: z.string(),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  author: z.string().optional(),
  license: z.string().optional(),
  repository: z.string().optional(),
  targets: z.array(AITargetSchema).min(1),
  agents: z.array(AgentDefinitionSchema).min(1),
  hooks: HookDefinitionsSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Options for parsing manifests
 */
export interface ParseOptions {
  /** Strict mode - treat warnings as errors */
  strict?: boolean;
  /** Allow unknown fields */
  allowUnknownFields?: boolean;
}

/**
 * Helper function to convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Parser for BTW workflow manifests (btw.yaml)
 */
export class ManifestParser {
  /**
   * Parse a manifest from a file path
   * @param filePath - Path to the manifest file
   * @param options - Parse options
   */
  async parseFile(filePath: string, options?: ParseOptions): Promise<ParsedManifest> {
    let content: string;

    try {
      content = await fileSystem.readFile(filePath);
    } catch (error) {
      if (error instanceof BTWError) {
        if (error.code === ErrorCode.FILE_NOT_FOUND) {
          throw new BTWError(ErrorCode.MANIFEST_NOT_FOUND, `Manifest file not found: ${filePath}`, {
            context: { filePath },
            cause: error,
          });
        }
        throw new BTWError(ErrorCode.FILE_READ_ERROR, `Failed to read manifest file: ${filePath}`, {
          context: { filePath },
          cause: error,
        });
      }
      throw new BTWError(ErrorCode.FILE_READ_ERROR, `Failed to read manifest file: ${filePath}`, {
        context: { filePath },
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }

    return this.parseString(content, filePath, options);
  }

  /**
   * Parse a manifest from string content
   * @param content - YAML string content
   * @param sourcePath - Source path for error reporting
   * @param options - Parse options
   */
  async parseString(
    content: string,
    sourcePath: string = '<string>',
    options?: ParseOptions
  ): Promise<ParsedManifest> {
    // Parse YAML
    let raw: RawManifest;
    try {
      raw = YAML.parse(content) as RawManifest;
    } catch (error) {
      throw new BTWError(ErrorCode.MANIFEST_PARSE_ERROR, `Invalid YAML syntax in manifest: ${sourcePath}`, {
        context: {
          sourcePath,
          error: error instanceof Error ? error.message : String(error),
        },
        cause: error instanceof Error ? error : new Error(String(error)),
      });
    }

    // Handle null/undefined raw content
    if (!raw || typeof raw !== 'object') {
      throw new BTWError(ErrorCode.MANIFEST_PARSE_ERROR, `Manifest content is empty or not an object: ${sourcePath}`, {
        context: { sourcePath, actual: typeof raw },
      });
    }

    // Validate the raw manifest
    const validationResult = this.validate(raw);

    // If validation failed and strict mode is enabled, throw an error
    if (!validationResult.valid) {
      if (options?.strict || validationResult.errors.length > 0) {
        const errorDetails = validationResult.errors
          .map(e => `${e.path}: ${e.message}`)
          .join('; ');
        throw new BTWError(ErrorCode.MANIFEST_VALIDATION_ERROR, `Manifest validation failed: ${errorDetails}`, {
          context: {
            sourcePath,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
          },
        });
      }
    }

    // In strict mode, also fail on warnings
    if (options?.strict && validationResult.warnings.length > 0) {
      const warningDetails = validationResult.warnings
        .map(w => `${w.path}: ${w.message}`)
        .join('; ');
      throw new BTWError(ErrorCode.MANIFEST_VALIDATION_ERROR, `Manifest validation warnings (strict mode): ${warningDetails}`, {
        context: {
          sourcePath,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        },
      });
    }

    // Transform the raw manifest to typed Manifest
    const manifest = this.transform(raw);

    return {
      manifest,
      sourcePath,
      parsedAt: new Date(),
      rawContent: content,
    };
  }

  /**
   * Validate a raw manifest object
   * @param raw - Raw parsed manifest
   */
  validate(raw: RawManifest): ManifestValidationResult {
    const errors: ManifestValidationError[] = [];
    const warnings: ManifestValidationError[] = [];

    // Check required fields exist
    for (const field of MANIFEST_SCHEMA.requiredFields) {
      if (!(field in raw) || raw[field as keyof RawManifest] === undefined) {
        errors.push({
          path: field,
          message: `Required field '${field}' is missing`,
          expected: 'non-null value',
          actual: undefined,
        });
      }
    }

    // Validate version is a string
    if (raw.version !== undefined) {
      if (typeof raw.version !== 'string') {
        errors.push({
          path: 'version',
          message: `Field 'version' must be a string`,
          expected: 'string',
          actual: typeof raw.version,
        });
      } else if (raw.version !== MANIFEST_SCHEMA.version) {
        warnings.push({
          path: 'version',
          message: `Version '${raw.version}' may not be fully supported. Current supported version: ${MANIFEST_SCHEMA.version}`,
          expected: MANIFEST_SCHEMA.version,
          actual: raw.version,
        });
      }
    }

    // Validate targets is an array with valid AITarget values
    if (raw.targets !== undefined) {
      if (!Array.isArray(raw.targets)) {
        errors.push({
          path: 'targets',
          message: `Field 'targets' must be an array`,
          expected: 'array',
          actual: typeof raw.targets,
        });
      } else {
        if (raw.targets.length === 0) {
          errors.push({
            path: 'targets',
            message: `Field 'targets' must contain at least one target`,
            expected: 'non-empty array',
            actual: 'empty array',
          });
        }

        const validTargets = MANIFEST_SCHEMA.supportedTargets;
        for (let i = 0; i < raw.targets.length; i++) {
          const target = raw.targets[i];
          if (typeof target !== 'string' || !validTargets.includes(target as AITarget)) {
            errors.push({
              path: `targets[${i}]`,
              message: `Invalid target '${target}'. Must be one of: ${validTargets.join(', ')}`,
              expected: validTargets.join(' | '),
              actual: target,
            });
          }
        }
      }
    }

    // Validate agents is a non-empty array
    if (raw.agents !== undefined) {
      if (!Array.isArray(raw.agents)) {
        errors.push({
          path: 'agents',
          message: `Field 'agents' must be an array`,
          expected: 'array',
          actual: typeof raw.agents,
        });
      } else {
        if (raw.agents.length === 0) {
          errors.push({
            path: 'agents',
            message: `Field 'agents' must contain at least one agent`,
            expected: 'non-empty array',
            actual: 'empty array',
          });
        }

        // Validate each agent
        for (let i = 0; i < raw.agents.length; i++) {
          const agent = raw.agents[i] as RawAgentDefinition;
          if (!agent || typeof agent !== 'object') {
            errors.push({
              path: `agents[${i}]`,
              message: `Agent at index ${i} must be an object`,
              expected: 'object',
              actual: typeof agent,
            });
            continue;
          }

          // Check agent required fields (handle both camelCase and snake_case)
          for (const field of MANIFEST_SCHEMA.agentRequiredFields) {
            const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
            const hasCamelCase = field in agent && agent[field as keyof RawAgentDefinition] !== undefined;
            const hasSnakeCase = snakeField in agent && agent[snakeField as keyof RawAgentDefinition] !== undefined;

            if (!hasCamelCase && !hasSnakeCase) {
              errors.push({
                path: `agents[${i}].${field}`,
                message: `Required agent field '${field}' is missing`,
                expected: 'non-null value',
                actual: undefined,
              });
            }
          }

          // Validate agent id is a string
          if (agent.id !== undefined && typeof agent.id !== 'string') {
            errors.push({
              path: `agents[${i}].id`,
              message: `Agent 'id' must be a string`,
              expected: 'string',
              actual: typeof agent.id,
            });
          }

          // Validate agent name is a string
          if (agent.name !== undefined && typeof agent.name !== 'string') {
            errors.push({
              path: `agents[${i}].name`,
              message: `Agent 'name' must be a string`,
              expected: 'string',
              actual: typeof agent.name,
            });
          }

          // Validate systemPrompt or system_prompt is a string
          const systemPrompt = agent.systemPrompt ?? agent.system_prompt;
          if (systemPrompt !== undefined && typeof systemPrompt !== 'string') {
            errors.push({
              path: `agents[${i}].systemPrompt`,
              message: `Agent 'systemPrompt' must be a string`,
              expected: 'string',
              actual: typeof systemPrompt,
            });
          }

          // Validate temperature if present
          if (agent.temperature !== undefined) {
            const temp = Number(agent.temperature);
            if (isNaN(temp) || temp < 0 || temp > 2) {
              warnings.push({
                path: `agents[${i}].temperature`,
                message: `Agent 'temperature' should be a number between 0 and 2`,
                expected: 'number (0-2)',
                actual: agent.temperature,
              });
            }
          }

          // Validate tags if present
          if (agent.tags !== undefined) {
            if (!Array.isArray(agent.tags)) {
              warnings.push({
                path: `agents[${i}].tags`,
                message: `Agent 'tags' should be an array of strings`,
                expected: 'string[]',
                actual: typeof agent.tags,
              });
            }
          }
        }
      }
    }

    // Validate hooks if present
    if (raw.hooks !== undefined) {
      if (typeof raw.hooks !== 'object' || raw.hooks === null) {
        warnings.push({
          path: 'hooks',
          message: `Field 'hooks' should be an object`,
          expected: 'object',
          actual: typeof raw.hooks,
        });
      } else {
        const hooks = raw.hooks as RawHookDefinitions;
        const hookFields = ['preInject', 'pre_inject', 'postInject', 'post_inject', 'preRemove', 'pre_remove', 'postRemove', 'post_remove'];

        for (const field of hookFields) {
          const value = hooks[field as keyof RawHookDefinitions];
          if (value !== undefined && !Array.isArray(value)) {
            warnings.push({
              path: `hooks.${field}`,
              message: `Hook '${field}' should be an array of strings`,
              expected: 'string[]',
              actual: typeof value,
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Transform raw manifest to validated Manifest type
   * @param raw - Raw manifest object
   */
  transform(raw: RawManifest): Manifest {
    // Transform agents
    const agents: AgentDefinition[] = [];
    if (Array.isArray(raw.agents)) {
      for (const agent of raw.agents) {
        agents.push(this.transformAgent(agent as RawAgentDefinition));
      }
    }

    // Transform hooks if present
    let hooks: HookDefinitions | undefined;
    if (raw.hooks && typeof raw.hooks === 'object') {
      hooks = this.transformHooks(raw.hooks as RawHookDefinitions);
    }

    // Build the manifest object
    const manifest: Manifest = {
      version: String(raw.version ?? MANIFEST_SCHEMA.version),
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      description: String(raw.description ?? ''),
      targets: this.transformTargets(raw.targets),
      agents,
    };

    // Add optional fields if present
    if (raw.author !== undefined) {
      manifest.author = String(raw.author);
    }
    if (raw.license !== undefined) {
      manifest.license = String(raw.license);
    }
    if (raw.repository !== undefined) {
      manifest.repository = String(raw.repository);
    }
    if (hooks) {
      manifest.hooks = hooks;
    }
    if (raw.metadata !== undefined && typeof raw.metadata === 'object') {
      manifest.metadata = raw.metadata as Record<string, unknown>;
    }

    // Use Zod safeParse for final validation and type coercion
    const parseResult = ManifestZodSchema.safeParse(manifest);
    if (parseResult.success) {
      return parseResult.data;
    }

    // If Zod validation fails, return the manually constructed manifest
    // (validation errors would have been caught in validate())
    return manifest;
  }

  /**
   * Transform raw targets to AITarget array
   * @param raw - Raw targets value
   */
  private transformTargets(raw: unknown): AITarget[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const validTargets = MANIFEST_SCHEMA.supportedTargets;
    return raw
      .filter(t => typeof t === 'string' && validTargets.includes(t as AITarget))
      .map(t => t as AITarget);
  }

  /**
   * Transform a raw agent definition
   * @param raw - Raw agent definition
   */
  private transformAgent(raw: RawAgentDefinition): AgentDefinition {
    // Handle both camelCase and snake_case for systemPrompt
    const systemPrompt = raw.systemPrompt ?? raw.system_prompt;

    const agent: AgentDefinition = {
      id: String(raw.id ?? ''),
      name: String(raw.name ?? ''),
      description: String(raw.description ?? ''),
      systemPrompt: String(systemPrompt ?? ''),
    };

    // Add optional fields if present
    if (raw.model !== undefined) {
      agent.model = String(raw.model);
    }

    if (raw.temperature !== undefined) {
      const temp = Number(raw.temperature);
      if (!isNaN(temp)) {
        agent.temperature = temp;
      }
    }

    if (raw.tags !== undefined) {
      if (Array.isArray(raw.tags)) {
        agent.tags = raw.tags.map(t => String(t));
      }
    }

    // Use Zod safeParse for type coercion
    const parseResult = AgentDefinitionSchema.safeParse(agent);
    if (parseResult.success) {
      return parseResult.data;
    }

    return agent;
  }

  /**
   * Transform raw hook definitions
   * @param raw - Raw hook definitions
   */
  private transformHooks(raw: RawHookDefinitions): HookDefinitions {
    const hooks: HookDefinitions = {};

    // Helper to get string array from various formats
    const toStringArray = (value: unknown): string[] | undefined => {
      if (!value) return undefined;
      if (Array.isArray(value)) {
        return value.map(v => String(v));
      }
      return undefined;
    };

    // Handle both camelCase and snake_case versions
    // preInject / pre_inject
    const preInject = raw.preInject ?? raw.pre_inject;
    if (preInject !== undefined) {
      hooks.preInject = toStringArray(preInject);
    }

    // postInject / post_inject
    const postInject = raw.postInject ?? raw.post_inject;
    if (postInject !== undefined) {
      hooks.postInject = toStringArray(postInject);
    }

    // preRemove / pre_remove
    const preRemove = raw.preRemove ?? raw.pre_remove;
    if (preRemove !== undefined) {
      hooks.preRemove = toStringArray(preRemove);
    }

    // postRemove / post_remove
    const postRemove = raw.postRemove ?? raw.post_remove;
    if (postRemove !== undefined) {
      hooks.postRemove = toStringArray(postRemove);
    }

    // Use Zod safeParse for type coercion
    const parseResult = HookDefinitionsSchema.safeParse(hooks);
    if (parseResult.success) {
      return parseResult.data;
    }

    return hooks;
  }

  /**
   * Serialize a manifest to YAML string
   * @param manifest - Manifest to serialize
   */
  serialize(manifest: Manifest): string {
    // Convert manifest to YAML-friendly object (using snake_case for consistency)
    const obj: Record<string, unknown> = {
      version: manifest.version,
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
    };

    // Add optional string fields
    if (manifest.author) {
      obj.author = manifest.author;
    }
    if (manifest.license) {
      obj.license = manifest.license;
    }
    if (manifest.repository) {
      obj.repository = manifest.repository;
    }

    // Add targets
    obj.targets = manifest.targets;

    // Transform agents (convert systemPrompt to system_prompt for YAML)
    obj.agents = manifest.agents.map(agent => {
      const agentObj: Record<string, unknown> = {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        system_prompt: agent.systemPrompt,
      };

      if (agent.model) {
        agentObj.model = agent.model;
      }
      if (agent.temperature !== undefined) {
        agentObj.temperature = agent.temperature;
      }
      if (agent.tags && agent.tags.length > 0) {
        agentObj.tags = agent.tags;
      }

      return agentObj;
    });

    // Transform hooks (convert camelCase to snake_case for YAML)
    if (manifest.hooks) {
      const hooks: Record<string, string[]> = {};

      if (manifest.hooks.preInject && manifest.hooks.preInject.length > 0) {
        hooks.pre_inject = manifest.hooks.preInject;
      }
      if (manifest.hooks.postInject && manifest.hooks.postInject.length > 0) {
        hooks.post_inject = manifest.hooks.postInject;
      }
      if (manifest.hooks.preRemove && manifest.hooks.preRemove.length > 0) {
        hooks.pre_remove = manifest.hooks.preRemove;
      }
      if (manifest.hooks.postRemove && manifest.hooks.postRemove.length > 0) {
        hooks.post_remove = manifest.hooks.postRemove;
      }

      if (Object.keys(hooks).length > 0) {
        obj.hooks = hooks;
      }
    }

    // Add metadata if present
    if (manifest.metadata && Object.keys(manifest.metadata).length > 0) {
      obj.metadata = manifest.metadata;
    }

    return YAML.stringify(obj, { indent: 2 });
  }

  /**
   * Check if a file is a valid manifest file
   * @param filePath - Path to check
   */
  async isManifestFile(filePath: string): Promise<boolean> {
    try {
      // Check if file exists
      const exists = await fileSystem.exists(filePath);
      if (!exists) {
        return false;
      }

      // Check filename is btw.yaml or btw.yml
      const filename = path.basename(filePath);
      if (filename !== 'btw.yaml' && filename !== 'btw.yml') {
        return false;
      }

      return true;
    } catch {
      // Don't throw errors, just return false
      return false;
    }
  }
}

/**
 * Singleton instance of ManifestParser
 */
export const manifestParser = new ManifestParser();
