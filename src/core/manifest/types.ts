/**
 * BTW - Manifest Types
 * Type definitions specific to manifest parsing and validation
 */

import { z } from 'zod';
import { AITarget } from '../../types/index.js';

/**
 * Raw manifest as parsed from YAML (before validation)
 */
export interface RawManifest {
  version?: unknown;
  id?: unknown;
  name?: unknown;
  description?: unknown;
  author?: unknown;
  license?: unknown;
  repository?: unknown;
  targets?: unknown;
  agents?: unknown;
  hooks?: unknown;
  metadata?: unknown;
}

/**
 * Raw agent definition from YAML
 */
export interface RawAgentDefinition {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  systemPrompt?: unknown;
  system_prompt?: unknown; // Alternative snake_case format
  model?: unknown;
  temperature?: unknown;
  tags?: unknown;
}

/**
 * Raw hook definitions from YAML
 */
export interface RawHookDefinitions {
  preInject?: unknown;
  pre_inject?: unknown;
  postInject?: unknown;
  post_inject?: unknown;
  preRemove?: unknown;
  pre_remove?: unknown;
  postRemove?: unknown;
  post_remove?: unknown;
}

/**
 * Validation error for manifest parsing
 */
export interface ManifestValidationError {
  /** Field path that failed validation */
  path: string;
  /** Error message */
  message: string;
  /** Expected type or value */
  expected?: string;
  /** Actual value received */
  actual?: unknown;
}

/**
 * Result of manifest validation
 */
export interface ManifestValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if invalid */
  errors: ManifestValidationError[];
  /** Validation warnings (non-blocking) */
  warnings: ManifestValidationError[];
}

/**
 * Schema definition for manifest fields
 */
export interface ManifestSchema {
  version: string;
  requiredFields: string[];
  optionalFields: string[];
  agentRequiredFields: string[];
  supportedTargets: AITarget[];
}

/**
 * Current manifest schema definition
 */
export const MANIFEST_SCHEMA: ManifestSchema = {
  version: '1.0',
  requiredFields: ['version', 'id', 'name', 'description', 'targets', 'agents'],
  optionalFields: ['author', 'license', 'repository', 'hooks', 'metadata'],
  agentRequiredFields: ['id', 'name', 'systemPrompt'],
  supportedTargets: ['claude', 'cursor', 'windsurf', 'copilot'],
};

/**
 * Parsed manifest with source information
 */
export interface ParsedManifest {
  /** The validated manifest content */
  manifest: import('../../types/index.js').Manifest;
  /** Original source path */
  sourcePath: string;
  /** Parse timestamp */
  parsedAt: Date;
  /** Raw YAML content */
  rawContent: string;
}

// =============================================================================
// Zod Validation Schemas
// =============================================================================

/**
 * Zod schema for AI target validation
 */
export const AITargetSchema = z.enum(['claude', 'cursor', 'windsurf', 'copilot']);

/**
 * Zod schema for agent definition validation
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
 * Zod schema for hook definitions validation
 */
export const HookDefinitionsSchema = z.object({
  preInject: z.array(z.string()).optional(),
  postInject: z.array(z.string()).optional(),
  preRemove: z.array(z.string()).optional(),
  postRemove: z.array(z.string()).optional(),
});

/**
 * Zod schema for full manifest validation
 */
export const ManifestZodSchema = z.object({
  version: z.string(),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  author: z.string().optional(),
  license: z.string().optional(),
  repository: z.string().url().optional(),
  targets: z.array(AITargetSchema).min(1),
  agents: z.array(AgentDefinitionSchema).min(1),
  hooks: HookDefinitionsSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for loose/raw manifest parsing (allows unknown types initially)
 */
export const RawManifestSchema = z.object({
  version: z.unknown(),
  id: z.unknown(),
  name: z.unknown(),
  description: z.unknown(),
  author: z.unknown().optional(),
  license: z.unknown().optional(),
  repository: z.unknown().optional(),
  targets: z.unknown(),
  agents: z.unknown(),
  hooks: z.unknown().optional(),
  metadata: z.unknown().optional(),
}).passthrough();

// =============================================================================
// Type Exports from Zod Schemas
// =============================================================================

/**
 * Validated manifest type inferred from Zod schema
 */
export type ValidatedManifest = z.infer<typeof ManifestZodSchema>;

/**
 * Validated agent type inferred from Zod schema
 */
export type ValidatedAgent = z.infer<typeof AgentDefinitionSchema>;

/**
 * Validated hooks type inferred from Zod schema
 */
export type ValidatedHooks = z.infer<typeof HookDefinitionsSchema>;
