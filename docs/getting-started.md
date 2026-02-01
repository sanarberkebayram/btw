# Getting Started with BTW

This guide will help you get up and running with BTW (Bring The Workflow) in minutes.

## Prerequisites

- **Node.js** 18.0.0 or higher
- **Git** installed and available in PATH
- An AI coding assistant (Claude, Cursor, Windsurf, or Copilot)

## Installation

### From npm (Recommended)

```bash
npm install -g @sanarberkebayram/btw
```

### From Source

```bash
git clone https://github.com/sanarberkebayram/btw.git
cd btw
npm install
npm run build
npm link
```

## Quick Start

### 1. Add Your First Workflow

Install a workflow from GitHub:

```bash
# Using owner/repo shorthand
btw add sanarberkebayram/game-agent

# Or using full URL
btw add https://github.com/sanarberkebayram/game-agent
```

You can also add a local workflow:

```bash
btw add ./my-local-workflow
```

### 2. List Installed Workflows

```bash
# Simple list
btw list

# Detailed view
btw list --detailed
```

### 3. Inject a Workflow

Inject a workflow into your current project:

```bash
# Inject for Claude (default)
btw inject game-agent

# Inject for a specific AI tool
btw inject game-agent --target cursor
```

### 4. Remove a Workflow

When you no longer need a workflow:

```bash
btw remove game-agent
```

## Understanding BTW

### What is a Workflow?

A workflow is a packaged set of AI instructions, rules, and configurations stored in a GitHub repository. It includes:

- **Agents**: AI personas with specific expertise and instructions
- **Rules**: Hard constraints for the AI to follow
- **Prompts**: Reusable prompt templates
- **Hooks**: Automation scripts that run during lifecycle events

### Directory Structure

BTW stores its data in `~/.btw/`:

```
~/.btw/
├── workflows/           # Installed workflows
│   └── owner/repo/     # Each workflow in its own directory
├── cache/              # Temporary files
└── state.json          # BTW state tracking
```

### Supported AI Tools

| Tool | Status |
|------|--------|
| Claude | Supported |
| Cursor | Planned |
| Windsurf | Planned |
| Copilot | Planned |

## Next Steps

- Learn about all [CLI Commands](./commands.md)
- Understand the [Manifest Format](./manifest.md)
- [Create Your Own Workflow](./creating-workflows.md)

## Getting Help

```bash
# Show help
btw --help

# Show command-specific help
btw add --help
btw inject --help
```
