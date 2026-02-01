# BTW (Bring The Workflow)

**AI-aware workflow package manager for developers**

BTW lets you share and manage AI coding workflows across different tools (Claude, Cursor, Windsurf, Copilot) without vendor lock-in. Package your AI instructions, rules, and configurations in GitHub repositories and inject them into any project with a single command.

## Why BTW?

- **No Vendor Lock-in**: Your workflows are plain YAML and markdown in Git repos
- **Tool Agnostic**: One workflow, multiple AI tools (Claude, Cursor, Windsurf, Copilot)
- **Shareable**: Share workflows via GitHub - just `btw add user/repo`
- **Version Controlled**: Track changes, roll back, collaborate on AI instructions
- **Zero Config in Projects**: Keep AI config out of your project repos

## Installation

```bash
npm install -g @sanarberkebayram/btw
```

**Requirements:**
- Node.js 18.0.0 or higher
- Git

## Quick Start

```bash
# Add a workflow from GitHub
btw add sanarberkebayram/game-agent

# List installed workflows
btw list

# Inject into your project (for Claude)
btw inject game-agent

# Remove when done
btw remove game-agent
```

## Commands

| Command | Description |
|---------|-------------|
| `btw add <source>` | Install a workflow from GitHub or local path |
| `btw list` | List installed workflows |
| `btw inject <id>` | Inject workflow into current project |
| `btw remove <id>` | Remove an installed workflow |

### Examples

```bash
# Add from GitHub (shorthand)
btw add user/repo

# Add from GitHub (full URL)
btw add https://github.com/user/repo

# Add from local directory
btw add ./my-workflow

# List with details
btw list --detailed

# Inject for specific AI tool
btw inject my-workflow --target cursor

# Force overwrite existing config
btw inject my-workflow --force
```

## Creating a Workflow

Create a `btw.yaml` in your repository:

```yaml
version: "1.0"
id: my-workflow
name: My Workflow
description: A helpful AI workflow
author: your-name

targets:
  - claude
  - cursor

agents:
  - id: main-agent
    name: Main Agent
    description: Primary agent for this workflow
    system_prompt: |
      You are an expert assistant specialized in...

      Your responsibilities:
      1. Help with task A
      2. Provide guidance on B
      3. Review and improve C
```

Then push to GitHub and share:

```bash
btw add your-username/your-workflow
```

## Supported AI Tools

| Tool | Status | Config Location |
|------|--------|-----------------|
| Claude | Supported | `.claude/instructions.md` |
| Cursor | Planned | `.cursorrules` |
| Windsurf | Planned | `.windsurfrules` |
| Copilot | Planned | `.github/copilot-instructions.md` |

## Documentation

- [Getting Started](./docs/getting-started.md) - Installation and first steps
- [Commands Reference](./docs/commands.md) - Complete CLI documentation
- [Manifest Reference](./docs/manifest.md) - Full `btw.yaml` specification
- [Creating Workflows](./docs/creating-workflows.md) - Build and publish workflows

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GitHub Repo    │────▶│      BTW        │────▶│  Your Project   │
│  (btw.yaml)     │     │  (CLI Manager)  │     │  (.claude/...)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Add**: BTW clones the workflow repo to `~/.btw/workflows/`
2. **Inject**: BTW reads the manifest and writes config to your project
3. **Use**: Your AI tool picks up the injected configuration
4. **Update**: Pull latest changes with `btw add --force`

## Directory Structure

BTW stores data in `~/.btw/`:

```
~/.btw/
├── workflows/           # Installed workflows
│   └── owner/repo/
│       └── btw.yaml
├── cache/              # Temporary files
└── state.json          # Installation state
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BTW_HOME` | BTW home directory | `~/.btw` |
| `BTW_DEBUG` | Enable debug output | `false` |
| `BTW_NO_COLOR` | Disable colors | `false` |
| `BTW_DEFAULT_TARGET` | Default AI target | `claude` |

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

```bash
# Clone the repo
git clone https://github.com/sanarberkebayram/btw.git
cd btw

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Link for local development
npm link
```

## License

MIT

## Author

[sanarberkebayram](https://github.com/sanarberkebayram)
