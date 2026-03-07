# Installation

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- A **GitHub personal access token** with `repo`, `project`, and `read:org` scopes
- [GitHub CLI](https://cli.github.com/) (`gh`) recommended for token management

## Option 1: Claude Code Plugin (Recommended)

The plugin bundles the MCP server with 8 governance skills, a PM agent, and governance hooks.

```bash
# Clone and build
git clone https://github.com/ido4-dev/ido4.git
cd ido4-MCP
npm install && npm run build

# Set your GitHub token
export GITHUB_TOKEN=$(gh auth token)

# Launch Claude Code with ido4
claude --plugin-dir ./packages/plugin
```

Once loaded, you'll see ido4 tools available in Claude Code. Try `/ido4:health` for a quick governance status check.

## Option 2: Standalone MCP Server

Install the MCP server package directly:

```bash
npm install @ido4/mcp
```

Configure your MCP client (e.g., Claude Code, or any MCP-compatible environment):

```json
{
  "mcpServers": {
    "ido4": {
      "command": "npx",
      "args": ["@ido4/mcp"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

## Option 3: Core Library Only

For programmatic use or building custom integrations:

```bash
npm install @ido4/core
```

```typescript
import { ServiceContainer } from '@ido4/core';

const container = await ServiceContainer.create({
  projectRoot: '/path/to/project',
  githubToken: process.env.GITHUB_TOKEN!,
});

// Use any service
const status = await container.waveService.getWaveStatus('wave-001');
const result = await container.taskService.validateTransition(42, 'start', actor);
```

## GitHub Token Scopes

ido4 interacts with GitHub Projects V2 via the GraphQL API. Your token needs:

| Scope | Why |
|---|---|
| `repo` | Read/write issues, PRs, and repository data |
| `project` | Read/write GitHub Projects V2 |
| `read:org` | Read organization data (for org-owned projects) |

## Verifying Installation

After setup, verify everything works:

```bash
# In Claude Code with the plugin:
> /ido4:health

# Or check project status:
> What's the status of our project?
# Claude will call get_project_status automatically
```

## Next Steps

- [Quick Start](quick-start.md) — Initialize governance on your project
- [Sandbox Demo](sandbox.md) — Try the interactive sandbox with embedded violations
