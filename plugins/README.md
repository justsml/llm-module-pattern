# Mastra Plugin Packages

Reference implementations for **publishable AI plugin packages**. Each plugin is a self-contained package designed to be imported into a main agent application.

## Architecture Overview

Plugins are **monorepo packages** that export agentic AI features. Each plugin declares what it provides through its entry point.

```
plugins/
├── trip-planner/          # Package: @myorg/trip-planner
├── research-bot/          # Package: @myorg/research-bot
├── ask-user-for-stuff/    # Package: @myorg/ask-user-input
└── content-moderation/    # Package: @myorg/content-moderation
```

### Plugin Interface

Plugins use an **optional property pattern** - only implement what you need:

```typescript
interface AIPluginDefinition {
  // Required
  name: string
  version: string

  // Optional features - implement any combination
  tools?: ToolDefinition[]
  agents?: AgentDefinition[]
  ui?: UIComponentMap
  processors?: ProcessorDefinition[]
  storage?: StorageDefinition

  // Optional lifecycle hooks
  register?(context: PluginContext): void | Promise<void>
  initialize?(context: PluginContext): void | Promise<void>
}
```

### Required: Entry Point with Manifest

Every plugin **must** have a `config.ts` or `index.ts` that declares available features:

```typescript
// config.ts - Required entry point
export const tripPlannerPlugin = {
  name: 'trip-planner',
  version: '1.0.0',

  // Declare what this plugin provides
  tools: {
    getWeather: weatherTool,
    findPlaces: placesTool,
    generateMap: geojsonTool,
  },

  agents: {
    tripPlanner: tripPlannerAgent,
  },

  ui: {
    'tool-getWeather': WeatherCard,
    'tool-findPlaces': PlacesCard,
    'tool-generateMap': MapCard,
  },

  // Schemas for type safety across boundaries
  schemas: {
    weatherInput: weatherInputSchema,
    weatherOutput: weatherOutputSchema,
    // ...
  },
} as const

export default tripPlannerPlugin
```

### Optional: Feature Files

All other files are **optional** - include only what your plugin needs:

| File | Purpose | When to Include |
|------|---------|-----------------|
| `tools.ts` | Tool implementations | Plugin provides tools |
| `agent.ts` | Agent definitions | Plugin provides agents |
| `ui.tsx` | UI components | Plugin has visual output |
| `processors.ts` | Input/output processors | Plugin adds guardrails |
| `storage.ts` | Memory/storage config | Plugin persists data |
| `schemas.ts` | Zod schemas (can be in config) | Plugin has typed I/O |

---

## Package Structure

Each plugin follows the **dual-export pattern** for development and publishing:

```
trip-planner/
├── package.json          # Package manifest
├── src/
│   ├── index.ts          # Re-exports everything
│   ├── config.ts         # Plugin manifest (required)
│   ├── tools.ts          # Tool implementations (optional)
│   ├── agent.ts          # Agent definition (optional)
│   ├── ui.tsx            # UI components (optional)
│   └── schemas.ts        # Zod schemas (optional, can be in config)
├── tsconfig.json
└── README.md
```

### package.json

```json
{
  "name": "@myorg/trip-planner",
  "version": "1.0.0",
  "type": "module",

  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./tools": {
      "import": "./src/tools.ts",
      "types": "./src/tools.ts"
    },
    "./ui": {
      "import": "./src/ui.tsx",
      "types": "./src/ui.tsx"
    }
  },

  "publishConfig": {
    "exports": {
      ".": {
        "import": "./dist/index.js",
        "types": "./dist/index.d.ts"
      },
      "./tools": {
        "import": "./dist/tools.js",
        "types": "./dist/tools.d.ts"
      },
      "./ui": {
        "import": "./dist/ui.js",
        "types": "./dist/ui.d.ts"
      }
    }
  },

  "peerDependencies": {
    "@mastra/core": "^1.0.0",
    "react": "^18.0.0"
  },

  "files": ["dist", "README.md"]
}
```

---

## Example Plugins

### 1. [trip-planner](./trip-planner/) - Full Plugin

**Provides:** Tools, Agent, UI, Schemas

A complete plugin demonstrating all features working together.

```typescript
// What this plugin exports
export const tripPlannerPlugin = {
  name: 'trip-planner',
  version: '1.0.0',
  tools: { getWeather, findPlaces, generateMap },
  agents: { tripPlanner },
  ui: { 'tool-getWeather': WeatherCard, ... },
  schemas: { weatherInput, weatherOutput, ... },
}
```

---

### 2. [research-bot](./research-bot/) - Multi-Agent Plugin

**Provides:** Tools, Agents (multiple), UI, Schemas

Demonstrates nested agent streaming - a tool that orchestrates a sub-agent.

```typescript
// What this plugin exports
export const researchBotPlugin = {
  name: 'research-bot',
  version: '1.0.0',
  tools: { deepResearch },
  agents: {
    researchBot,    // User-facing agent
    expertAgent,    // Internal agent (called by tool)
  },
  ui: { 'tool-deepResearch': ResearchPanel },
  schemas: { ... },
}
```

**Key Pattern:** Tool orchestrates agent via `context.mastra.getAgent()`:

```typescript
// In tool execute:
const expertAgent = context.mastra.getAgent('expert-agent')
const stream = await expertAgent.stream({ messages: [...] })
await stream.fullStream.pipeTo(context.writer)
```

---

### 3. [ask-user-for-stuff](./ask-user-for-stuff/) - Client-Side Tools

**Provides:** Tools, Agent, UI, Schemas

Tools that render interactive UI and wait for user input.

```typescript
// What this plugin exports
export const askUserPlugin = {
  name: 'ask-user-for-stuff',
  version: '1.0.0',
  tools: { askForConfirmation, askMultipleChoice, askForText },
  agents: { askUser },
  ui: {
    'tool-askForConfirmation': ConfirmationDialog,
    'tool-askMultipleChoice': MultipleChoiceCard,
    'tool-askForText': TextInputForm,
  },
  schemas: { ... },
}
```

**Key Pattern:** UI calls `addToolResult()` to send user response back to agent.

---

### 4. [content-moderation](./content-moderation/) - Processors Only

**Provides:** Processors only (no tools, agent, or UI)

Demonstrates a minimal plugin that only provides guardrails.

```typescript
// What this plugin exports
export const contentModerationPlugin = {
  name: 'content-moderation',
  version: '1.0.0',
  processors: {
    input: [layeredSecurity],
    output: [outputModeration],
  },
}
```

**Usage:** Apply to any agent:

```typescript
import { layeredSecurity } from '@myorg/content-moderation'

const agent = new Agent({
  name: 'safe-agent',
  inputProcessors: layeredSecurity,
})
```

---

## Consuming Plugins

### In a Mastra Application

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core'
import tripPlannerPlugin from '@myorg/trip-planner'
import researchBotPlugin from '@myorg/research-bot'
import contentModerationPlugin from '@myorg/content-moderation'

export const mastra = new Mastra({
  // Register agents from plugins
  agents: {
    ...tripPlannerPlugin.agents,
    ...researchBotPlugin.agents,
  },

  // Apply processors globally or per-agent
  // processors: contentModerationPlugin.processors,
})
```

### Selective Imports

Import only what you need for better tree-shaking:

```typescript
// Just the tools
import { weatherTool, placesTool } from '@myorg/trip-planner/tools'

// Just the UI components
import { WeatherCard, PlacesCard } from '@myorg/trip-planner/ui'

// Just the processors
import { layeredSecurity } from '@myorg/content-moderation'
```

---

## Communication Pattern

Plugins use **reactive state flow** - tools emit states, UI renders based on state:

```
┌─────────────────────────────┐
│  Agent (Server)             │
│  - Executes tools           │
│  - Emits tool states        │
│  - Streams via writer       │
└──────────────┬──────────────┘
               │ DefaultChatTransport
               ▼
┌─────────────────────────────┐
│  UI (Client)                │
│  - useChat() hook           │
│  - Renders based on state   │
│  - addToolResult() for input│
└─────────────────────────────┘
```

Tools never import UI. UI imports only types/schemas from config. This enables:
- UI updates without touching inference code
- Tool updates without touching UI code
- Publishing packages with clear boundaries

---

## Tool States

UI components handle these tool states:

| State | When | Available Props |
|-------|------|-----------------|
| `input-streaming` | LLM generating args | `input` (partial) |
| `input-available` | Args complete, executing | `input` |
| `output-streaming` | Tool streaming output | `input`, `output` (partial) |
| `output-available` | Tool complete | `input`, `output` |
| `output-error` | Tool failed | `input`, `errorText` |

---

## Development

```bash
# Install dependencies
pnpm install

# Start Mastra server
pnpm mastra dev

# Start frontend (if applicable)
pnpm dev

# Build for publishing
pnpm build
```

### Environment Variables

```bash
NEXT_PUBLIC_MASTRA_URL=http://localhost:4111
OPENAI_API_KEY=sk-...
```

---

## Not Yet Demonstrated

Future patterns to explore:

| Pattern | Description |
|---------|-------------|
| Feature flags | Conditional tool/agent registration |
| Plugin dependencies | Plugins that extend other plugins |
| Shared prompt templates | Centralized prompt management |
| Tracing integration | OpenTelemetry export |
| Plugin marketplace | Discovery and installation |

---

## Additional Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [AI SDK UI Guide](https://mastra.ai/guides/build-your-ui/ai-sdk-ui)
- [Plugin Architecture Research](../research/plugin-architecture-patterns.md)
