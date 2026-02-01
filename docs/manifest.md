# Manifest Reference

The `btw.yaml` manifest file defines a workflow's metadata, agents, rules, and configuration. This document provides a complete reference for the manifest format.

## Overview

Every BTW workflow must have a `btw.yaml` file in its root directory. This file describes the workflow and its components.

## Basic Structure

```yaml
version: "1.0"
id: my-workflow
name: My Workflow
description: A brief description of what this workflow does
author: your-name
license: MIT
repository: https://github.com/your-name/my-workflow

targets:
  - claude
  - cursor

agents:
  - id: main-agent
    name: Main Agent
    description: Primary agent for this workflow
    system_prompt: |
      Your detailed instructions here...
```

## Fields Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Manifest schema version (currently "1.0") |
| `id` | string | Unique identifier for the workflow |
| `name` | string | Human-readable name |
| `description` | string | Brief description of the workflow |
| `targets` | array | List of supported AI tools |
| `agents` | array | List of agent definitions |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `author` | string | Workflow author name |
| `license` | string | License type (MIT, Apache-2.0, etc.) |
| `repository` | string | Source repository URL |
| `hooks` | object | Lifecycle hook scripts |
| `metadata` | object | Custom key-value data |

---

## Targets

The `targets` field specifies which AI tools this workflow supports.

### Valid Targets

| Target | Description |
|--------|-------------|
| `claude` | Anthropic Claude (Claude Code, Claude Desktop) |
| `cursor` | Cursor IDE |
| `windsurf` | Windsurf IDE |
| `copilot` | GitHub Copilot |

### Example

```yaml
targets:
  - claude
  - cursor
  - windsurf
```

---

## Agents

Agents are the core of a workflow. Each agent represents a specialized AI persona with specific instructions.

### Agent Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier within the workflow |
| `name` | string | Yes | Human-readable name |
| `description` | string | Yes | Brief description of the agent's purpose |
| `system_prompt` | string | Yes | Instructions for the AI |
| `model` | string | No | Preferred model (e.g., "claude-3-opus") |
| `temperature` | number | No | Response temperature (0-2) |
| `tags` | array | No | Tags for filtering and categorization |

### Example

```yaml
agents:
  - id: code-reviewer
    name: Code Reviewer
    description: Reviews code for best practices and potential issues
    system_prompt: |
      You are an expert code reviewer. Your responsibilities:

      1. Review code for correctness and potential bugs
      2. Check for security vulnerabilities
      3. Suggest performance improvements
      4. Ensure code follows best practices

      Be constructive and explain your suggestions clearly.
    model: claude-3-opus
    temperature: 0.3
    tags:
      - code-review
      - quality

  - id: documentation-writer
    name: Documentation Writer
    description: Writes clear and comprehensive documentation
    system_prompt: |
      You are a technical writer specializing in documentation.
      Write clear, concise, and well-structured documentation.
    tags:
      - documentation
      - writing
```

### System Prompt Best Practices

1. **Be Specific**: Clearly define the agent's role and responsibilities
2. **Use Structure**: Break instructions into numbered lists or sections
3. **Set Boundaries**: Define what the agent should and shouldn't do
4. **Include Examples**: Provide examples of expected behavior when helpful
5. **Keep Updated**: Maintain prompts as requirements evolve

---

## Hooks

Hooks allow you to run scripts at specific points in the workflow lifecycle.

### Available Hooks

| Hook | When It Runs |
|------|--------------|
| `pre_inject` | Before injecting workflow into AI tool |
| `post_inject` | After successful injection |
| `pre_remove` | Before removing workflow |
| `post_remove` | After workflow removal |

### Example

```yaml
hooks:
  pre_inject:
    - hooks/validate-env.sh
    - hooks/check-dependencies.py
  post_inject:
    - hooks/notify-team.sh
  pre_remove:
    - hooks/backup-config.sh
  post_remove:
    - hooks/cleanup.sh
```

### Hook Scripts

- Scripts are relative to the workflow root
- Must be executable
- Receive environment variables with context information
- Non-zero exit code cancels the operation (for pre-hooks)

### Environment Variables in Hooks

| Variable | Description |
|----------|-------------|
| `BTW_WORKFLOW_ID` | ID of the current workflow |
| `BTW_TARGET` | Target AI tool |
| `BTW_PROJECT_PATH` | Path to the project |
| `BTW_ACTION` | Current action (inject/remove) |

---

## Metadata

The `metadata` field allows custom key-value data for workflow-specific configuration.

### Example

```yaml
metadata:
  minNodeVersion: "18.0.0"
  categories:
    - game-development
    - unity
  requiredTools:
    - unity
    - git
  customConfig:
    defaultBranch: main
    autoUpdate: true
```

---

## Complete Example

Here's a comprehensive example manifest:

```yaml
version: "1.0"
id: game-development-suite
name: Game Development Suite
description: Complete workflow for game development with Unity and Unreal Engine
author: sanarberkebayram
license: MIT
repository: https://github.com/sanarberkebayram/game-dev-suite

targets:
  - claude
  - cursor

agents:
  - id: gameplay-architect
    name: Gameplay Architect
    description: Designs game mechanics and systems
    system_prompt: |
      You are an expert gameplay architect with deep knowledge of:
      - Game design patterns
      - Player psychology and engagement
      - Balance and progression systems
      - Core loop design

      When designing game mechanics:
      1. Consider player experience first
      2. Ensure systems are scalable
      3. Plan for iteration and testing
      4. Document design decisions
    model: claude-3-opus
    temperature: 0.7
    tags:
      - game-design
      - architecture

  - id: unity-specialist
    name: Unity Specialist
    description: Expert in Unity game development
    system_prompt: |
      You are a Unity expert specializing in:
      - C# scripting best practices
      - Performance optimization
      - Unity's component system
      - Asset pipeline management

      Write clean, performant Unity code following:
      - Single responsibility principle
      - Proper memory management
      - Efficient update loops
    tags:
      - unity
      - csharp
      - performance

  - id: code-reviewer
    name: Game Code Reviewer
    description: Reviews game code for quality and performance
    system_prompt: |
      Review game code focusing on:
      1. Performance bottlenecks
      2. Memory leaks
      3. Frame rate impact
      4. Code maintainability
    temperature: 0.3
    tags:
      - code-review
      - performance

hooks:
  pre_inject:
    - hooks/check-unity-version.sh
  post_inject:
    - hooks/setup-project-settings.sh

metadata:
  minUnityVersion: "2022.3"
  supportedPlatforms:
    - windows
    - macos
    - linux
  categories:
    - game-development
    - unity
```

---

## Validation

BTW validates manifests on load. Common validation errors:

| Error | Cause |
|-------|-------|
| Missing required field | A required field is not present |
| Invalid target | Target not in allowed list |
| Empty agents array | At least one agent is required |
| Duplicate agent ID | Agent IDs must be unique |
| Invalid temperature | Temperature must be between 0 and 2 |

### Validating Your Manifest

You can validate a manifest before publishing:

```bash
# Will report any validation errors
btw add ./my-workflow
```

---

## Field Name Conventions

BTW supports both camelCase and snake_case for compatibility:

| Preferred (snake_case) | Also Accepted (camelCase) |
|------------------------|---------------------------|
| `system_prompt` | `systemPrompt` |
| `pre_inject` | `preInject` |
| `post_inject` | `postInject` |
| `pre_remove` | `preRemove` |
| `post_remove` | `postRemove` |

We recommend using snake_case for consistency with YAML conventions.
