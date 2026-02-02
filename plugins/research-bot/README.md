# Research Bot

Demonstrates **Nested Agent Streaming** - the pattern of calling an agent from within a tool and streaming its output to the UI in real-time. Users see the expert agent "thinking out loud" as it analyzes their topic.

## Features

- **Nested Agent Streaming**: Tool calls a sub-agent and pipes its stream to the UI
- **Real-time Thinking**: Watch the expert agent reason through the topic live
- **Progress Events**: Custom events show research phases (starting → analyzing → complete)
- **Structured Output**: Final results include importance-ranked findings

## File Structure

```
research-bot/
├── config.ts    # Research and expert schemas
├── agents.ts    # Research Bot + Expert Agent definitions
├── tools.ts     # Deep research tool with nested streaming
├── ui.tsx       # React components for stream rendering
└── README.md    # This file
```

## The Nested Agent Streaming Pattern

This is the key pattern demonstrated:

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│    User     │────▶│ Research Bot│────▶│ deepResearch │
└─────────────┘     └─────────────┘     │    Tool      │
                                        └──────┬───────┘
                                               │
                    ┌──────────────────────────┘
                    │  context.mastra.getAgent()
                    ▼
              ┌─────────────┐
              │Expert Agent │
              └──────┬──────┘
                     │  agent.stream()
                     ▼
              ┌─────────────┐
              │   Stream    │───▶ stream.fullStream.pipeTo(context.writer)
              └─────────────┘              │
                                           ▼
                                    ┌─────────────┐
                                    │     UI      │
                                    │ data-tool-  │
                                    │   agent     │
                                    └─────────────┘
```

## Key Code Patterns

### 1. Get Agent from Context

```typescript
// Inside tool execute function
const expertAgent = context?.mastra?.getAgent('expert-agent');

if (!expertAgent) {
  throw new Error('Expert agent not registered');
}
```

### 2. Stream and Pipe to UI

```typescript
// Stream the expert's response
const stream = await expertAgent.stream({
  messages: [{ role: 'user', content: prompt }],
});

// Pipe directly to UI - this creates `data-tool-agent` parts
await stream.fullStream.pipeTo(context.writer);

// Get final text after streaming completes
const analysisText = await stream.text;
```

### 3. Emit Progress Events

```typescript
// Custom events appear as `data-custom` parts
await context?.writer?.custom({
  type: 'research-phase',
  data: {
    phase: 'analyzing',
    message: 'Expert agent is thinking...',
  },
});
```

### 4. Render Nested Agent Stream

```tsx
// The key UI handler
if (part.type === 'data-tool-agent') {
  // This is the expert agent's streamed content!
  return <ExpertThinking content={part.content} />;
}
```

## Message Part Types

| Part Type | Source | UI Component |
|-----------|--------|--------------|
| `text` | Regular text responses | Message bubble |
| `tool-deepResearch` | Tool execution states | Loading/Results card |
| `data-tool-agent` | **Nested agent stream** | Expert thinking panel |
| `data-custom` | Progress events | Phase indicator |

## Two-Agent Architecture

### Expert Agent (Nested)

Called internally by the tool. Users never interact with it directly.

```typescript
export const expertAgent = new Agent({
  name: 'expert-agent',
  instructions: `You are an expert analyst...`,
  model: { provider: 'OPEN_AI', name: 'gpt-5-mini' },
  // No tools - this agent just thinks and responds
});
```

### Research Bot (User-Facing)

The agent users chat with. It uses a tool that calls the expert.

```typescript
export const researchBot = new Agent({
  name: 'research-bot',
  instructions: `You are a research assistant...`,
  model: { provider: 'OPEN_AI', name: 'gpt-5-mini' },
  tools: {
    deepResearch: deepResearchTool, // This tool calls expertAgent
  },
});
```

## Usage

### Register BOTH Agents

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { researchBot, expertAgent } from './plugins/research-bot/agents';

export const mastra = new Mastra({
  agents: {
    'research-bot': researchBot,
    'expert-agent': expertAgent, // REQUIRED for getAgent() to work!
  },
});
```

### Use in Your App

```tsx
import { ResearchBotDemo } from './plugins/research-bot/ui';

export default function ResearchPage() {
  return <ResearchBotDemo />;
}
```

## Example Interaction

**User:** "Research quantum computing"

**UI shows:**
1. 🚀 Phase indicator: "Researching: quantum computing"
2. 🧠 Expert agent thinking panel (streams in real-time):
   ```
   Let me analyze quantum computing...

   **Overview**
   Quantum computing leverages quantum mechanical phenomena...

   **Key Findings**
   - HIGH: Quantum supremacy demonstrated by Google in 2019...
   - MEDIUM: Current quantum computers have limited qubits...
   ```
3. ✅ Phase indicator: "Research complete"
4. 🔬 Research card with structured findings

## Why Nested Agent Streaming?

- **Specialization**: Different agents can have different expertise
- **Transparency**: Users see the reasoning process, building trust
- **Composability**: Tools can orchestrate multiple agents
- **Rich UX**: Real-time streaming creates engaging experiences
