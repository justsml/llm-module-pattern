# Generative UI Example

This example demonstrates how to render dynamic UI components based on tool execution states in a chat interface.

## Features

- **Dynamic Tool Rendering**: Different UI states for tool execution (streaming, loading, complete, error)
- **Weather Card Component**: Rich visual display of weather data
- **Real-time Updates**: Streaming responses with progressive UI updates

## File Structure

```
generative-ui/
├── config.ts    # Plugin config and Zod schemas
├── agent.ts     # Weather agent definition
├── tools.ts     # Weather tool with wttr.in API
├── ui.tsx       # React components for chat interface
└── README.md    # This file
```

## Tool States

The UI handles all tool execution states:

| State | UI Rendered |
|-------|-------------|
| `input-streaming` | Skeleton placeholder |
| `input-available` | Loading spinner |
| `output-streaming` | Faded weather card |
| `output-available` | Full weather card |
| `output-error` | Error message |

## Usage

### 1. Register the Agent with Mastra

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { weatherAgent } from './plugins/weather/agent';

export const mastra = new Mastra({
  agents: { weatherAgent },
});
```

### 2. Use the UI Component

```tsx
import { GenerativeUIDemo } from './plugins/weather/ui';

export default function WeatherPage() {
  return <GenerativeUIDemo />;
}
```

### 3. Configure the API URL

Set the `NEXT_PUBLIC_MASTRA_URL` environment variable:

```bash
NEXT_PUBLIC_MASTRA_URL=http://localhost:4111
```

## Key Patterns

### Tool Part Rendering

```tsx
if (part.type === 'tool-weatherTool') {
  switch (part.state) {
    case 'input-available':
      return <Loader />;
    case 'output-available':
      return <WeatherCard data={part.output} />;
    // ...
  }
}
```

### Typed Tool Output

```typescript
// The output is typed via the tool's outputSchema
const data = part.output as WeatherOutput;
```

## Customization

To adapt this pattern for other tools:

1. Define your tool's input/output schemas in `config.ts`
2. Create the tool in `tools.ts` with your API logic
3. Build custom UI components for each state in `ui.tsx`
4. Handle the `tool-{toolId}` part type in your message renderer
