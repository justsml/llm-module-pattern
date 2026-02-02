# Mastra Plugin Examples

Four examples demonstrating key Mastra patterns. Each showcases a different way tools and agents can interact with users.

## Examples

### 1. [Trip Planner](./trip-planner/) - Multi-Tool Generative UI

A travel assistant with **three tools**, each rendering a distinct visual component.

**Pattern:** Multiple tools → Multiple UI components with different designs

**Tools:**
| Tool | Output | UI |
|------|--------|-----|
| `getWeather` | Weather + forecast | Blue gradient card |
| `findPlaces` | Places by category | Category-colored cards |
| `generateMap` | GeoJSON + viewer link | Emerald map card with geojson.io link |

**Files:** `config.ts`, `agent.ts`, `tools.ts`, `ui.tsx`

---

### 2. [Research Bot](./research-bot/) - Nested Agent Streaming

Watch a sub-agent "think out loud" as it streams its analysis to the UI.

**Pattern:** Tool calls nested agent → Stream piped to UI → Real-time thinking display

**Key Code:**
```typescript
// In tool execute:
const expertAgent = context.mastra.getAgent('expert-agent');
const stream = await expertAgent.stream({ messages: [...] });
await stream.fullStream.pipeTo(context.writer); // Creates data-tool-agent parts
```

**UI Part:** `data-tool-agent` renders the expert's streamed thinking

**Files:** `config.ts`, `agents.ts`, `tools.ts`, `ui.tsx`

---

### 3. [Ask User for Stuff](./ask-user-for-stuff/) - Client-Side Tools

Tools that render interactive UI and wait for user input.

**Pattern:** Tool renders UI → User interacts → `addToolResult()` sends response

**Tools:**
| Tool | UI | User Action |
|------|-----|-------------|
| `askForConfirmation` | Yes/No buttons | Click to confirm/cancel |
| `askMultipleChoice` | Option cards | Select one or more |
| `askForText` | Input field | Type and submit |

**Files:** `config.ts`, `agent.ts`, `tools.ts`, `ui.tsx`

---

### 4. [Content Moderation](./content-moderation/) - Guardrails with Processors

Add safety guardrails using `inputProcessors` and `outputProcessors`.

**Pattern:** Processors intercept messages → Validate/transform/block → Before or after LLM

**Built-in Processors:**
| Processor | Purpose |
|-----------|---------|
| `ModerationProcessor` | Detect/block harmful content |
| `PromptInjectionDetector` | Block jailbreak attempts |
| `PIIDetector` | Redact personal information |
| `UnicodeNormalizer` | Prevent unicode smuggling |

**Key Code (Mastra Agent):**
```typescript
import { layeredSecurity } from './content-moderation/processors';

const agent = new Agent({
  name: 'safe-agent',
  inputProcessors: layeredSecurity,
});
```

**AI SDK Compatible (via `withMastra`):**
```typescript
import { mastra } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { layeredSecurity, inputModeration, outputModeration } from './content-moderation/processors';

// Wrap any AI SDK model with processors
const safeChatModel = mastra.withMastra(openai('gpt-5-mini'), {
  inputProcessors: layeredSecurity,
});

// Use with standard AI SDK functions
const result = await streamText({
  model: safeChatModel,
  messages: [{ role: 'user', content: userInput }],
});

// Separate input/output moderation
const balancedModel = mastra.withMastra(openai('gpt-5-mini'), {
  inputProcessors: [inputModeration],   // Block harmful input
  outputProcessors: [outputModeration], // Rewrite harmful output
});
```

**Files:** `processors.ts` (no agent wrapper, tools, UI, or config needed)

---

## Pattern Comparison

| Example | Server Execution | UI Streaming | User Input | Guardrails |
|---------|------------------|--------------|------------|------------|
| Trip Planner | ✅ Tools call APIs | ✅ Tool states | ❌ | ❌ |
| Research Bot | ✅ Nested agent | ✅ Agent stream | ❌ | ❌ |
| Ask User | ❌ Client-side | ✅ Tool states | ✅ addToolResult | ❌ |
| Content Moderation | ✅ Agent only | ❌ | ❌ | ✅ Processors |

## Common File Structure

```
example-name/
├── config.ts    # Zod schemas and types
├── agent.ts     # Agent definition(s)
├── tools.ts     # Tool implementations
├── ui.tsx       # React components
└── README.md    # Documentation
```

## Registering with Mastra

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { tripPlannerAgent } from './plugins/trip-planner/agent';
import { researchBot, expertAgent } from './plugins/research-bot/agents';
import { askUserAgent } from './plugins/ask-user-for-stuff/agent';
import { layeredSecurity } from './plugins/content-moderation/processors';

export const mastra = new Mastra({
  agents: {
    'trip-planner': tripPlannerAgent,
    'research-bot': researchBot,
    'expert-agent': expertAgent, // Required for nested streaming
    'ask-user-for-stuff': askUserAgent,
  },
});

// Apply processors to any agent:
// inputProcessors: layeredSecurity
```

## Environment Variables

```bash
NEXT_PUBLIC_MASTRA_URL=http://localhost:4111
OPENAI_API_KEY=sk-...
```

## Running Examples

```bash
pnpm install
pnpm mastra dev    # Start Mastra server
pnpm dev           # Start frontend
```

## Additional Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [AI SDK UI Guide](https://mastra.ai/guides/build-your-ui/ai-sdk-ui)
