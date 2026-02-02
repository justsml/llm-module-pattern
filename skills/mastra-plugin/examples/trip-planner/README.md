# Trip Planner

A travel assistant with multiple tools that render rich, purpose-built UI components. Demonstrates how different tools can have distinct visual representations.

## Features

- **Multi-Tool Agent**: Three tools working together (weather, places, map)
- **Generative UI**: Each tool renders a unique, themed card component
- **Tool States**: Loading skeletons, streaming, complete, and error states
- **External API**: Weather tool calls real wttr.in API
- **External Viewer**: Map tool generates links to geojson.io

## File Structure

```
trip-planner/
├── config.ts    # Schemas for weather, places, and geojson tools
├── agent.ts     # Trip planner agent with all three tools
├── tools.ts     # Tool implementations
├── ui.tsx       # React components for each tool output
└── README.md    # This file
```

## Tools

### 1. getWeather

Fetches current conditions and 3-day forecast from wttr.in.

**Input:** `{ location: string }`

**UI:** Blue gradient card with temperature, humidity, wind, UV index, and forecast row.

### 2. findPlaces

Returns curated places by category (attractions, restaurants, hotels, activities).

**Input:** `{ location: string, category: enum, limit?: number }`

**UI:** Category-colored card with place cards showing ratings, price levels, and tags.

### 3. generateMap

Creates a GeoJSON FeatureCollection with points of interest and returns a link to view it on geojson.io.

**Input:** `{ location: string, points: Array<{ name, description?, lat, lng, type }> }`

**UI:** Emerald gradient card with point list, coordinates, and "Open in geojson.io" button.

## Key Patterns

### Multi-Tool Agent

```typescript
export const tripPlannerAgent = new Agent({
  name: 'trip-planner',
  instructions: `You are an enthusiastic travel assistant...`,
  model: { provider: 'OPEN_AI', name: 'gpt-4o' },
  tools: {
    getWeather: weatherTool,
    findPlaces: placesTool,
    generateMap: geojsonTool,
  },
});
```

### Tool-Specific UI Components

```tsx
// Each tool gets its own visual treatment
if (part.type === 'tool-getWeather') {
  switch (part.state) {
    case 'input-available':
      return <ToolSkeleton type="getWeather" />;
    case 'output-available':
      return <WeatherCard data={part.output} />;
    case 'output-error':
      return <ErrorCard message={part.errorText} />;
  }
}

if (part.type === 'tool-findPlaces') {
  // Different component, different colors
  return <PlacesCard data={part.output} />;
}

if (part.type === 'tool-generateMap') {
  // GeoJSON with external viewer link
  return <GeoJsonCard data={part.output} />;
}
```

### Typed Tool Outputs

```typescript
// Each tool has strongly-typed output
export const weatherOutputSchema = z.object({
  location: z.string(),
  temperature: z.number(),
  feelsLike: z.number(),
  description: z.string(),
  humidity: z.number(),
  windSpeed: z.number(),
  uvIndex: z.number(),
  forecast: z.array(z.object({
    date: z.string(),
    high: z.number(),
    low: z.number(),
    description: z.string(),
  })),
});

// UI component receives typed data
function WeatherCard({ data }: { data: WeatherOutput }) {
  return (
    <div>
      <span>{data.temperature}°C</span>
      {data.forecast.map(day => (
        <div>{day.high}° / {day.low}°</div>
      ))}
    </div>
  );
}
```

## Usage

### Register the Agent

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { tripPlannerAgent } from './plugins/trip-planner/agent';

export const mastra = new Mastra({
  agents: {
    tripPlannerAgent,
  },
});
```

### Use in Your App

```tsx
import { TripPlannerDemo } from './plugins/trip-planner/ui';

export default function TravelPage() {
  return <TripPlannerDemo />;
}
```

## Example Interactions

**User:** "What's the weather in Tokyo?"

**Agent:** Calls `getWeather` → Blue weather card with current conditions + 3-day forecast.

---

**User:** "Find restaurants in Paris"

**Agent:** Calls `findPlaces` → Orange restaurant card with 5 place recommendations.

---

**User:** "Show me attractions in Rome on a map"

**Agent:** May call `findPlaces` first, then `generateMap` → Emerald map card with points list and "Open in geojson.io" button.

---

**User:** "Plan a weekend in Barcelona with a map"

**Agent:** May use all three tools in sequence:
1. Weather check → Blue card
2. Attractions → Purple card
3. Map of locations → Emerald card with external viewer link

## Design Notes

- **Color Coding**: Each tool has a distinct color palette (blue=weather, purple/orange/green/pink=places by category, emerald=map)
- **Loading States**: Matching gradient skeletons maintain visual consistency during loading
- **Error Handling**: Red-bordered error cards with tool-specific messages
- **External Viewer**: Map tool generates URL-encoded GeoJSON for geojson.io
- **Responsive**: Cards adapt to container width with grid layouts
