# Trip Planner

A weather-aware trip planning assistant that shows dynamic UI as it fetches weather data for your destination.

## Features

- **Dynamic Tool Rendering**: Watch the UI update as the agent thinks, fetches, and displays weather
- **Weather Card Component**: Beautiful weather display with temperature, conditions, and forecasts
- **Real-time Updates**: Streaming responses with progressive UI updates

## File Structure

```
trip-planner/
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
import { tripPlannerAgent } from './plugins/trip-planner/agent';

export const mastra = new Mastra({
  agents: { tripPlannerAgent },
});
```

### 2. Use the UI Component

```tsx
import { TripPlannerDemo } from './plugins/trip-planner/ui';

export default function TripPlannerPage() {
  return <TripPlannerDemo />;
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
