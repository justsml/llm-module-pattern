# AI Skillz

Claude Code skills for scaffolding Mastra.ai projects with agents, tools, memory, workflows, evals, and UI.

## What is this?

This repository contains [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills) - reusable prompts that help Claude Code scaffold complete Mastra.ai modules and components with best practices built in.

## Available Skills

### mastra-module

Create comprehensive Mastra.ai agent modules with full feature support.

```
/mastra-module weatherAgent
```

**Features:**
- Agents with custom instructions and tool bindings
- Tools with typed schemas and streaming support
- Memory with semantic recall and working memory
- Workflows with human-in-the-loop approval
- Evals for quality assurance
- UI components for tool rendering
- Workspace variants for multi-tenant configs

**Generated files:**
```
{directory}/
├── config.ts           # Module ID, shared types, schemas
├── agent.ts            # Agent definition
├── tools.ts            # Tool definitions
├── memory.ts           # Memory configuration
├── workflow.ts         # Workflow with suspend/resume
├── processors.ts       # Input/Output processors
├── ui.tsx              # Client-side UI components
├── evals.ts            # Agent evaluation tests
├── {moduleName}.test.ts
├── package.json
├── vitest.config.ts
├── tsconfig.json
└── README.md
```

### mastra-plugin

Create Mastra.ai plugins following the plugin directory convention.

```
/mastra-plugin weatherAgent
```

Same features as `mastra-module`, but defaults to `src/mastra/plugins/{plugin-id}/` directory structure.

### create-tool-ui

Create UI components for rendering AI SDK tool calls in chat interfaces.

```
/create-tool-ui rubricFeedback
```

**Generated files:**
```
{directory}/
├── config.ts   # Tool ID, Input/Output types
├── tool.ts     # createTool() definition (server-side)
└── ui.tsx      # createToolUI() client components
```

**Tool states handled:**
| State | When | Props |
|-------|------|-------|
| `input-streaming` | LLM generating args | `input` (partial) |
| `input-available` | Args complete, executing | `input` |
| `output-streaming` | Tool streaming output | `input`, `output` (partial) |
| `output-available` | Tool complete | `input`, `output` |
| `output-error` | Tool failed | `input`, `errorText` |

## Installation

Copy the `skills/` directory to your Claude Code skills location:

```bash
# Copy to global skills
cp -r skills/* ~/.claude/skills/

# Or copy to project-local skills
cp -r skills/* .claude/skills/
```

## Usage

Once installed, invoke skills in Claude Code:

```
/mastra-plugin myAgent --features agent,tools,memory,workflow
```

Claude will interactively prompt for any missing arguments like directory path.

## Research

The `research/` directory contains design documents and analysis:

- [Chat Plugin Registry Design](research/chat-plugin-registry-design.md) - Registry architecture for chat plugins
- [Mastra Memory Impact Analysis](research/mastra-memory-impact-analysis.md) - Analysis of Mastra's memory system

## Requirements

- [Claude Code](https://claude.com/claude-code) CLI
- Node.js 18+
- pnpm (recommended) or npm

## Related

- [Mastra.ai Documentation](https://mastra.ai/docs)
- [Claude Code Skills](https://docs.anthropic.com/en/docs/claude-code/skills)
- [AI SDK](https://sdk.vercel.ai/docs)
