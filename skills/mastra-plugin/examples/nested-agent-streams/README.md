# Nested Agent Streams Example

This example demonstrates how to stream output from an agent that is called from within a tool, creating rich, real-time UI experiences.

## Features

- **Nested Agent Invocation**: Call agents from within tools
- **Stream Piping**: Real-time streaming of nested agent output
- **Custom Events**: Progress tracking via `context.writer.custom()`
- **Multi-part Rendering**: Handle `data-tool-agent` parts in the UI

## File Structure

```
nested-agent-streams/
├── config.ts    # Plugin config and Zod schemas
├── agents.ts    # Research agent + Analysis agent definitions
├── tools.ts     # Deep research tool with nested agent
├── ui.tsx       # React components with stream handling
└── README.md    # This file
```

## How It Works

### 1. Tool Retrieves Nested Agent

```typescript
execute: async (inputData, context) => {
  const analysisAgent = context?.mastra?.getAgent('analysis-agent');
  // ...
}
```

### 2. Stream the Agent's Response

```typescript
const stream = await analysisAgent.stream({
  messages: [{ role: 'user', content: prompt }],
});

// Pipe to context writer for real-time streaming
await stream.fullStream.pipeTo(context.writer);
```

### 3. Handle Custom Events

```typescript
await context?.writer?.custom({
  type: 'research-started',
  data: { topic, startedAt: new Date().toISOString() },
});
```

### 4. Render in UI

```tsx
// Nested agent stream
if (part.type === 'data-tool-agent') {
  return <AgentThinkingStream content={part.content} />;
}

// Custom events
if (part.type === 'data-custom') {
  return <CustomEventBadge event={part.data} />;
}
```

## Message Part Types

| Part Type | Description |
|-----------|-------------|
| `text` | Regular text content |
| `tool-{toolId}` | Tool execution with states |
| `data-tool-agent` | Streamed content from nested agent |
| `data-custom` | Custom events from `context.writer.custom()` |

## Usage

### Register Both Agents

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { researchAgent, analysisAgent } from './plugins/research/agents';

export const mastra = new Mastra({
  agents: {
    researchAgent,
    analysisAgent, // Must be registered for getAgent() to work
  },
});
```

### Use in Your App

```tsx
import { NestedAgentStreamsDemo } from './plugins/research/ui';

export default function ResearchPage() {
  return <NestedAgentStreamsDemo />;
}
```

## Key Patterns

### Context Writer

The `context.writer` enables:
- Streaming nested agent output to the UI
- Emitting custom progress events
- Creating rich, interactive experiences

### Agent Retrieval

Agents must be registered with Mastra to be accessible via `context.mastra.getAgent()`.

### Stream Processing

The `fullStream` provides access to all stream events, which can be piped directly to the context writer for real-time UI updates.
