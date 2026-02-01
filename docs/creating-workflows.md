# Creating Workflows

This guide walks you through creating and publishing your own BTW workflows.

## Overview

A BTW workflow is a GitHub repository containing:
- A `btw.yaml` manifest file
- Agent instructions and configurations
- Optional hooks, rules, and scripts

## Quick Start

### 1. Create Repository Structure

```bash
mkdir my-workflow
cd my-workflow
git init
```

Create the following structure:

```
my-workflow/
├── btw.yaml           # Required: Manifest file
├── agents/            # Optional: Agent instruction files
├── rules/             # Optional: Rule files
├── prompts/           # Optional: Reusable prompts
├── hooks/             # Optional: Lifecycle scripts
├── scripts/           # Optional: Utility scripts
└── README.md          # Recommended: Documentation
```

### 2. Create the Manifest

Create `btw.yaml`:

```yaml
version: "1.0"
id: my-workflow
name: My Awesome Workflow
description: A workflow that does amazing things
author: your-github-username
license: MIT
repository: https://github.com/your-username/my-workflow

targets:
  - claude

agents:
  - id: main-agent
    name: Main Agent
    description: The primary agent for this workflow
    system_prompt: |
      You are a helpful assistant specialized in [your domain].

      Your responsibilities:
      1. [First responsibility]
      2. [Second responsibility]
      3. [Third responsibility]

      Guidelines:
      - Be concise and clear
      - Provide examples when helpful
      - Ask for clarification when needed
```

### 3. Publish to GitHub

```bash
git add .
git commit -m "Initial workflow"
git remote add origin https://github.com/your-username/my-workflow.git
git push -u origin main
```

### 4. Test Your Workflow

```bash
# Add from your repository
btw add your-username/my-workflow

# List to verify
btw list --detailed

# Inject to test
btw inject my-workflow
```

## Writing Effective Agent Prompts

### Structure Your Prompts

```yaml
system_prompt: |
  # Role Definition
  You are [role description].

  # Core Responsibilities
  1. [Primary responsibility]
  2. [Secondary responsibility]
  3. [Tertiary responsibility]

  # Guidelines
  - [Guideline 1]
  - [Guideline 2]

  # Constraints
  - DO NOT [constraint 1]
  - ALWAYS [constraint 2]

  # Output Format
  When responding, use this format:
  [format description]
```

### Best Practices

1. **Be Specific**: Vague instructions lead to inconsistent results
2. **Use Examples**: Show don't tell
3. **Set Boundaries**: Define what the agent should NOT do
4. **Structure Output**: Specify expected response formats
5. **Test Iteratively**: Refine prompts based on actual usage

### Example: Code Review Agent

```yaml
agents:
  - id: code-reviewer
    name: Code Reviewer
    description: Reviews code for quality, security, and best practices
    system_prompt: |
      You are an expert code reviewer. Your role is to review code
      submissions and provide constructive feedback.

      ## Review Checklist
      1. **Correctness**: Does the code do what it's supposed to?
      2. **Security**: Are there any security vulnerabilities?
      3. **Performance**: Are there obvious performance issues?
      4. **Readability**: Is the code clear and well-documented?
      5. **Best Practices**: Does it follow language conventions?

      ## Response Format
      For each issue found:

      **[SEVERITY]** - Line X
      *Issue*: Description of the problem
      *Suggestion*: How to fix it
      ```code
      // Example fix
      ```

      ## Severity Levels
      - CRITICAL: Security issues, data loss risks
      - HIGH: Bugs, incorrect behavior
      - MEDIUM: Performance issues, code smells
      - LOW: Style issues, minor improvements

      ## Guidelines
      - Be constructive, not critical
      - Explain WHY something is an issue
      - Provide concrete examples for fixes
      - Acknowledge good patterns when you see them
    temperature: 0.3
    tags:
      - code-review
      - quality-assurance
```

## Adding Multiple Agents

Workflows can contain multiple specialized agents:

```yaml
agents:
  - id: architect
    name: System Architect
    description: Designs system architecture
    system_prompt: |
      You are a system architect...
    tags:
      - architecture
      - design

  - id: implementer
    name: Code Implementer
    description: Implements features based on designs
    system_prompt: |
      You are a senior developer...
    tags:
      - implementation
      - coding

  - id: tester
    name: Test Engineer
    description: Writes and reviews tests
    system_prompt: |
      You are a test engineer...
    tags:
      - testing
      - quality
```

## Using Hooks

Hooks automate tasks during workflow lifecycle events.

### Creating a Hook Script

`hooks/pre-inject.sh`:
```bash
#!/bin/bash
# Validate environment before injection

echo "Checking prerequisites..."

# Check for required tools
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js 18+ is required"
    exit 1
fi

echo "All prerequisites met!"
exit 0
```

Make it executable:
```bash
chmod +x hooks/pre-inject.sh
```

### Reference in Manifest

```yaml
hooks:
  pre_inject:
    - hooks/pre-inject.sh
  post_inject:
    - hooks/setup.sh
```

## Supporting Multiple AI Tools

Design your workflow to support multiple targets:

```yaml
targets:
  - claude
  - cursor
  - windsurf

agents:
  - id: main-agent
    name: Universal Agent
    description: Works across all AI tools
    system_prompt: |
      # Keep prompts tool-agnostic
      You are a helpful coding assistant...
```

### Target-Specific Considerations

| Target | Considerations |
|--------|---------------|
| Claude | Full markdown support, code blocks work well |
| Cursor | Integrated with IDE, can reference files |
| Windsurf | Similar to Cursor, IDE-integrated |
| Copilot | Best for code completion, inline suggestions |

## Versioning Your Workflow

Use semantic versioning in your manifest:

```yaml
version: "1.0"  # Schema version (keep as "1.0")
```

For your workflow version, use git tags:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Publishing Checklist

Before publishing your workflow:

- [ ] `btw.yaml` is valid and complete
- [ ] All required fields are present
- [ ] Agent prompts are well-structured
- [ ] README.md documents usage
- [ ] Hook scripts are executable
- [ ] Repository is public on GitHub
- [ ] Tested with `btw add` locally

## Example Workflows

### Minimal Workflow

```yaml
version: "1.0"
id: minimal
name: Minimal Workflow
description: A minimal example workflow
targets:
  - claude
agents:
  - id: helper
    name: Helper
    description: A simple helper agent
    system_prompt: You are a helpful assistant.
```

### Full-Featured Workflow

See the [Manifest Reference](./manifest.md) for a complete example with all features.

## Sharing Your Workflow

Once published, others can use your workflow:

```bash
btw add your-username/your-workflow
btw inject your-workflow
```

Consider:
- Adding a badge to your README
- Sharing on social media
- Adding to workflow directories/lists
