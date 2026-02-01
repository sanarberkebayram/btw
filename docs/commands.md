# CLI Commands Reference

BTW provides a set of commands to manage AI workflows. This document covers all available commands and their options.

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Enable verbose output |
| `-q, --quiet` | Suppress non-error output |
| `--no-color` | Disable colored output |
| `-h, --help` | Display help information |
| `-V, --version` | Display version number |

---

## btw add

Install a workflow from a source.

### Usage

```bash
btw add <source> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `source` | Workflow source (GitHub URL, owner/repo, or local path) |

### Options

| Option | Description |
|--------|-------------|
| `-f, --force` | Overwrite existing workflow |
| `--id <id>` | Custom workflow ID |

### Examples

```bash
# From GitHub using shorthand
btw add sanarberkebayram/game-agent

# From GitHub using full URL
btw add https://github.com/sanarberkebayram/game-agent

# From local directory
btw add ./my-workflow

# With custom ID
btw add sanarberkebayram/game-agent --id my-custom-id

# Force overwrite existing
btw add sanarberkebayram/game-agent --force
```

### Source Types

BTW supports three source types:

1. **GitHub Shorthand**: `owner/repo` - Automatically resolves to `https://github.com/owner/repo`
2. **Full URL**: `https://github.com/owner/repo` - Direct GitHub URL
3. **Local Path**: `./path/to/workflow` or `/absolute/path` - Local directory containing a `btw.yaml` manifest

---

## btw list

List installed workflows.

### Usage

```bash
btw list [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-d, --detailed` | Show detailed information |
| `-a, --active` | Show only active workflows |
| `--tags <tags>` | Filter by tags (comma-separated) |
| `--json` | Output as JSON |

### Examples

```bash
# Simple list
btw list

# Detailed view with version, source, and agent info
btw list --detailed

# Only active workflows
btw list --active

# Filter by tags
btw list --tags game,development

# JSON output for scripting
btw list --json
```

### Output

The simple list shows:
- Workflow ID
- Name
- Version
- Status (active/inactive)

The detailed view additionally shows:
- Description
- Source repository
- Installation date
- Supported targets
- Number of agents

---

## btw inject

Inject a workflow into the current project's AI tool configuration.

### Usage

```bash
btw inject <workflow-id> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `workflow-id` | ID of the installed workflow |

### Options

| Option | Description |
|--------|-------------|
| `-t, --target <target>` | AI tool target (claude, cursor, windsurf, copilot). Default: claude |
| `-p, --project <path>` | Project path. Default: current directory |
| `--no-backup` | Skip creating backup of existing config |
| `-f, --force` | Force injection even if config exists |
| `--merge` | Merge with existing configuration |

### Examples

```bash
# Inject for Claude (default)
btw inject game-agent

# Inject for Cursor
btw inject game-agent --target cursor

# Inject to a specific project
btw inject game-agent --project /path/to/project

# Force overwrite existing config
btw inject game-agent --force

# Merge with existing config instead of replacing
btw inject game-agent --merge

# Skip backup
btw inject game-agent --no-backup
```

### Behavior

1. Validates the workflow exists and supports the target
2. Creates a backup of existing configuration (unless `--no-backup`)
3. Runs pre-inject hooks (if defined in manifest)
4. Generates and writes configuration files
5. Runs post-inject hooks (if defined)
6. Updates workflow state with injection timestamp

### Configuration Locations

| Target | Config Location |
|--------|-----------------|
| Claude | `.claude/instructions.md` |
| Cursor | `.cursorrules` |
| Windsurf | `.windsurfrules` |
| Copilot | `.github/copilot-instructions.md` |

---

## btw remove

Remove an installed workflow.

### Usage

```bash
btw remove <workflow-id> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `workflow-id` | ID of the workflow to remove |

### Options

| Option | Description |
|--------|-------------|
| `-p, --project <path>` | Project path for ejection |
| `-f, --force` | Skip confirmation prompt |
| `--purge` | Remove all traces including backups |
| `--keep-injection` | Keep injected configuration files |

### Examples

```bash
# Remove workflow (will prompt for confirmation)
btw remove game-agent

# Force remove without confirmation
btw remove game-agent --force

# Remove but keep injected config in projects
btw remove game-agent --keep-injection

# Completely purge including backups
btw remove game-agent --purge
```

### Behavior

1. Prompts for confirmation (unless `--force`)
2. Ejects from AI tools (unless `--keep-injection`)
3. Runs pre-remove hooks (if defined)
4. Deletes workflow directory from `~/.btw/workflows/`
5. Removes from global state
6. Runs post-remove hooks (if defined)

---

## btw update

Update installed workflows from their source repositories and re-inject them.

### Usage

```bash
btw update [workflow-id] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `workflow-id` | ID of the workflow to update (optional) |

### Options

| Option | Description |
|--------|-------------|
| `-a, --all` | Update all installed workflows |
| `--no-inject` | Skip re-injecting after update |
| `-t, --target <target>` | Target for re-injection (uses last injected target by default) |

### Examples

```bash
# Update a specific workflow (pulls + re-injects)
btw update game-agent

# Update all installed workflows
btw update --all

# Update all (shorthand - no args defaults to all)
btw update

# Update without re-injecting
btw update game-agent --no-inject

# Update and inject to a specific target
btw update game-agent --target cursor
```

### Behavior

1. Fetches the latest changes from the source repository (git pull)
2. Re-parses the manifest to get updated version
3. Updates the workflow state with new version and commit hash
4. **Re-injects the workflow** if it was previously injected (unless `--no-inject`)
5. Displays summary of changes

### Notes

- Only workflows installed from Git repositories can be updated
- Local workflows (installed from local paths) will be skipped
- The update performs a `git pull` on the workflow directory
- Re-injection uses the same target as the last injection, or falls back to the first supported target

---

## Environment Variables

BTW respects the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `BTW_HOME` | BTW home directory | `~/.btw` |
| `BTW_DEBUG` | Enable debug output | `false` |
| `BTW_NO_COLOR` | Disable colored output | `false` |
| `BTW_DEFAULT_TARGET` | Default AI target | `claude` |

### Example

```bash
# Use custom BTW home
BTW_HOME=/custom/path btw list

# Enable debug output
BTW_DEBUG=true btw add owner/repo
```

---

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Workflow not found |
| 4 | File system error |
| 5 | Git error |
| 6 | Network error |
