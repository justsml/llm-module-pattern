# AI Skillz

Reference patterns and Claude Code skills for building **modular AI plugin packages** with Mastra.ai.

## The Problem

Tightly coupled AI inference code causes real pain:

- **Duplicated logic** across multiple entry points
- **Risky changes** - touching one agent breaks others
- **Team collisions** - UI, Tools, and Agent teams stepping on each other
- **No clear boundaries** - hard to know who owns what

## The Solution: Plugin Packages

Each plugin is a **self-contained, publishable package** that declares what it provides:

```typescript
export const myPlugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',

  // Declare available features (all optional)
  features: {
    tools: true,       // Provides tools
    agents: true,      // Provides agents
    ui: true,          // Provides UI components
    processors: false, // No guardrails
    storage: false,    // No persistence
  },
}
```

Import into any Mastra application:

```typescript
import myPlugin from '@myorg/my-plugin'
import { myTool } from '@myorg/my-plugin/tools'
import { MyComponent } from '@myorg/my-plugin/ui'
```

---

## Plugin Structure

Each plugin is a package with a required manifest and optional feature files:

```
my-plugin/
├── package.json          # npm package config
├── index.ts              # Entry point (re-exports)
├── config.ts             # Plugin manifest (REQUIRED)
├── tools.ts              # Tool implementations (optional)
├── agent.ts              # Agent definition (optional)
├── ui.tsx                # UI components (optional)
├── processors.ts         # Guardrails (optional)
└── storage.ts            # Persistence (optional)
```

### Plugin Interface

```typescript
interface AIPluginDefinition {
  // Required
  id: string
  name: string
  version: string

  // Optional features - implement any combination
  tools?: Record<string, ToolDefinition>
  agents?: Record<string, AgentDefinition>
  ui?: Record<string, ComponentDefinition>
  processors?: { input?: Processor[], output?: Processor[] }
  storage?: StorageDefinition
  schemas?: Record<string, ZodSchema>
}
```

---

## Example Plugins

The `plugins/` directory contains reference implementations:

| Plugin | Provides | Pattern |
|--------|----------|---------|
| [trip-planner](plugins/trip-planner/) | Tools, Agent, UI | Multi-tool with generative UI |
| [research-bot](plugins/research-bot/) | Tools, Agents, UI | Nested agent streaming |
| [ask-user-for-stuff](plugins/ask-user-for-stuff/) | Tools, Agent, UI | Client-side tools with user input |
| [content-moderation](plugins/content-moderation/) | Processors only | Guardrails without tools/agents |

See [plugins/README.md](plugins/README.md) for detailed documentation.

---

## Architecture Goals

| Goal | How It's Addressed |
|------|-------------------|
| Centralize inference | Mastra handles inference; plugins only configure |
| Clean boundaries | `config → tools → agent → UI` dependency flow |
| Team independence | Each file owned by different team |
| Publishable packages | Standard npm package structure |
| Type safety | Zod schemas shared across boundaries |

### Dependency Flow

```
config.ts    →  tools.ts    →  agent.ts
    ↓              ↓
 schemas        uses schemas
    ↓
  ui.tsx (imports ONLY types from config)
```

**Key principle:** UI never imports tools or agents directly. This enables UI updates without touching inference code.

---

## Known Gaps

| Gap | Status | Notes |
|-----|--------|-------|
| Feature flags | Not demonstrated | Could use conditional tool registration |
| Centralized prompts | Partial | Prompts near usage; could add shared templates |
| Tracing | Partial | Mastra has built-in tracing, not shown |

---

## Claude Code Skills

This repo includes [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills) for scaffolding new plugins.

### /mastra-plugin

Create a new plugin package:

```
/mastra-plugin weatherAgent
```

Generates:
```
plugins/weather-agent/
├── index.ts, config.ts, tools.ts, agent.ts, ui.tsx
├── package.json, tsconfig.json
└── README.md
```

### /create-tool-ui

Create UI components for a tool:

```
/create-tool-ui rubricFeedback
```

### Installation

```bash
# Global
cp -r skills/* ~/.claude/skills/

# Project-local
cp -r skills/* .claude/skills/
```

---

## Research

- [Plugin Architecture Patterns](research/plugin-architecture-patterns.md) - Patterns from Payload CMS, Medusa.js, Strapi, Vite
- [Chat Plugin Registry Design](research/chat-plugin-registry-design.md)
- [Mastra Memory Impact Analysis](research/mastra-memory-impact-analysis.md)

## Related

- [Mastra.ai Documentation](https://mastra.ai/docs)
- [AI SDK](https://sdk.vercel.ai/docs)
- [Claude Code Skills](https://docs.anthropic.com/en/docs/claude-code/skills)
