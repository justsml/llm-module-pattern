# Production Plugin Architecture: Mixed 3rd-Party & Internal Geo/Travel System

**Date**: 2026-02-09
**Status**: Complete
**Related Research**: [Plugin Architecture Patterns](plugin-architecture-patterns.md)

## Executive Summary

This document designs a production plugin architecture for a geo/travel system that mixes internal and 3rd-party packages, where consumers may only need a subset of features. The system comprises four packages:

1. **MapUI** — Client-side mapping (MapLibre, theming, GeoJSON rendering)
2. **GeoSearch** — Multi-provider geocoding, place search, navigation, with LLM fallback
3. **LiveTraffic** — 3rd-party live traffic data (tool or MCP)
4. **Google Calendar** — MCP-based calendar access for travel time viability

The core architectural insight is a **shared contract types package** (`@yourorg/geo-types`) that all packages peer-depend on, enabling mix-and-match composition without direct inter-package imports. 3rd-party packages are normalized through thin adapter layers.

## The Problem: Cross-Package Feature Dependencies

These packages have natural affinities that create coupling pressure:

```
GeoSearch results  → MapUI wants to render them
LiveTraffic data   → MapUI could visualize it
GeoSearch results  → LiveTraffic needs them for route segments
Calendar events    → GeoSearch needs addresses, LiveTraffic needs time windows
```

But consumers have wildly different needs:

| Consumer | MapUI | GeoSearch | LiveTraffic | Calendar |
|----------|-------|-----------|-------------|----------|
| Backend geocoding API | | x | | |
| Location search UI | x | x | | |
| Full trip planner agent | x | x | x | x |
| "Can I make this meeting?" check | | | x | x |
| Route visualization dashboard | x | | x | |

If packages import each other directly, every consumer pulls the full dependency graph. The architecture must allow cherry-picking without broken imports.

## Architecture Overview

### Package Landscape

```
@yourorg/geo-types             ← Internal, types + schemas only (zero runtime)
@yourorg/map-ui                ← Internal, client-side (React/MapLibre)
@yourorg/geo-search            ← Internal, server-side (multi-provider)
@yourorg/traffic-adapter       ← Internal adapter for 3rd-party traffic
@yourorg/calendar-adapter      ← Internal adapter for MCP calendar
@third-party/live-traffic      ← 3rd party, tool + MCP
google-calendar MCP server     ← 3rd party MCP server
```

### Dependency Graph

```
                  @yourorg/geo-types (types + schemas only)
                 /        |           \              \
                /         |            \              \
  @yourorg/map-ui  @yourorg/geo-search  @yourorg/     @yourorg/
    (peer dep)       (peer dep)       traffic-adapter  calendar-adapter
        |                |               |                  |
        |                |         wraps 3rd party    wraps MCP server
        |                |               |                  |
   maplibre-gl      providers/      @third-party/     google-calendar
                    ├── google      live-traffic         MCP server
                    ├── mapbox
                    ├── nominatim
                    └── llm-fallback
```

Key constraint: **arrows only point down**. No package imports a sibling. All cross-package communication goes through `geo-types` schemas.

---

## Layer 1: Shared Contract Types

The critical glue layer. Zero runtime code — only Zod schemas and inferred types.

### Package: `@yourorg/geo-types`

```
@yourorg/geo-types/
├── package.json
├── index.ts
└── schemas/
    ├── point.ts
    ├── route.ts
    ├── place.ts
    ├── traffic.ts
    └── time.ts
```

```json
{
  "name": "@yourorg/geo-types",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "publishConfig": {
    "exports": {
      ".": {
        "import": "./dist/index.js",
        "types": "./dist/index.d.ts"
      }
    }
  },
  "peerDependencies": {
    "zod": "^3.25.0"
  }
}
```

### Schema Definitions

```typescript
// @yourorg/geo-types/index.ts
import { z } from 'zod';

// =============================================================================
// Core Geo Primitives
// =============================================================================

export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().optional(),
});

export const BoundingBoxSchema = z.object({
  north: z.number(),
  south: z.number(),
  east: z.number(),
  west: z.number(),
});

// =============================================================================
// Route & Navigation
// =============================================================================

export const GeoRouteSegmentSchema = z.object({
  from: GeoPointSchema,
  to: GeoPointSchema,
  distanceKm: z.number().optional(),
  durationMin: z.number().optional(),
});

// =============================================================================
// Place Search Results
// =============================================================================

export const PlaceResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  point: GeoPointSchema,
  category: z.string().optional(),
  address: z.string().optional(),
  provider: z.string(),           // "google", "mapbox", "nominatim", "llm-fallback"
  confidence: z.number().min(0).max(1).optional(),
});

// =============================================================================
// Traffic
// =============================================================================

export const TrafficConditionSchema = z.object({
  segment: GeoRouteSegmentSchema,
  congestionLevel: z.enum(['free', 'light', 'moderate', 'heavy', 'standstill']),
  estimatedDurationMin: z.number(),
  updatedAt: z.string().datetime(),
});

// =============================================================================
// Time Windows (for calendar integration)
// =============================================================================

export const TimeWindowSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  label: z.string().optional(),
});

// =============================================================================
// Inferred Types
// =============================================================================

export type GeoPoint = z.infer<typeof GeoPointSchema>;
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;
export type GeoRouteSegment = z.infer<typeof GeoRouteSegmentSchema>;
export type PlaceResult = z.infer<typeof PlaceResultSchema>;
export type TrafficCondition = z.infer<typeof TrafficConditionSchema>;
export type TimeWindow = z.infer<typeof TimeWindowSchema>;
```

### Why a Separate Types Package

| Alternative | Problem |
|-------------|---------|
| Types in `geo-search` | MapUI would need to depend on `geo-search` just for types |
| Types in `map-ui` | Backend consumers would pull React/MapLibre for types |
| Duplicated types per package | Drift, runtime validation disagreements |
| No shared types | Every package invents its own `{ lat, lng }` shape |

The types package is essentially free — it compiles to tiny JS, and Zod schemas give runtime validation at package boundaries where data crosses between systems.

---

## Layer 2: Internal Packages

### Package: `@yourorg/map-ui`

Client-side only. Renders geo data, doesn't fetch it.

#### Structure

```
@yourorg/map-ui/
├── package.json
├── config.ts
├── index.ts
├── ui.tsx                     ← <MapView /> main component
└── lib/
    ├── maplibre-wrapper.ts    ← MapLibre GL JS setup
    ├── geojson-adapter.ts     ← PlaceResult[] → GeoJSON FeatureCollection
    ├── traffic-layer.ts       ← TrafficCondition[] → map layer (optional)
    └── themes/
        ├── index.ts
        ├── light.ts
        └── dark.ts
```

#### Plugin Config

```typescript
// @yourorg/map-ui/config.ts
export const mapUIPlugin = {
  id: 'map-ui',
  name: 'MapUI',
  version: '1.0.0',
  features: {
    tools: false,
    agents: false,
    ui: true,
    processors: false,
    storage: false,
  },
} as const;
```

#### Package Exports

```json
{
  "name": "@yourorg/map-ui",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".":          { "import": "./src/index.ts",  "types": "./src/index.ts" },
    "./ui":       { "import": "./src/ui.tsx",    "types": "./src/ui.tsx" },
    "./themes":   { "import": "./src/lib/themes/index.ts", "types": "./src/lib/themes/index.ts" },
    "./adapters": { "import": "./src/lib/geojson-adapter.ts", "types": "./src/lib/geojson-adapter.ts" }
  },
  "publishConfig": {
    "exports": {
      ".":          { "import": "./dist/index.js",  "types": "./dist/index.d.ts" },
      "./ui":       { "import": "./dist/ui.js",     "types": "./dist/ui.d.ts" },
      "./themes":   { "import": "./dist/lib/themes/index.js", "types": "./dist/lib/themes/index.d.ts" },
      "./adapters": { "import": "./dist/lib/geojson-adapter.js", "types": "./dist/lib/geojson-adapter.d.ts" }
    }
  },
  "peerDependencies": {
    "@yourorg/geo-types": "^1.0.0",
    "react": "^19.0.0",
    "maplibre-gl": "^4.0.0"
  }
}
```

#### GeoJSON Adapter

The adapter is the key integration point — it translates shared contract types into MapLibre-renderable GeoJSON:

```typescript
// @yourorg/map-ui/lib/geojson-adapter.ts
import type { PlaceResult, TrafficCondition } from '@yourorg/geo-types';

const MARKER_COLORS: Record<string, string> = {
  attraction: '#9333ea',
  restaurant: '#f97316',
  hotel: '#22c55e',
  activity: '#ec4899',
  default: '#3b82f6',
};

/**
 * Convert PlaceResult[] to a GeoJSON FeatureCollection for MapLibre.
 * Pure function — no side effects, no MapLibre dependency.
 */
export function placesToGeoJSON(places: PlaceResult[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: places.map((place) => ({
      type: 'Feature',
      properties: {
        id: place.id,
        name: place.name,
        category: place.category ?? 'default',
        provider: place.provider,
        confidence: place.confidence,
        address: place.address,
        'marker-color': MARKER_COLORS[place.category ?? 'default'] ?? MARKER_COLORS.default,
      },
      geometry: {
        type: 'Point',
        coordinates: [place.point.lng, place.point.lat],
      },
    })),
  };
}

/**
 * Convert TrafficCondition[] to a GeoJSON LineString collection.
 * Optional — only useful if traffic-adapter is also installed.
 */
export function trafficToGeoJSON(conditions: TrafficCondition[]): GeoJSON.FeatureCollection {
  const CONGESTION_COLORS: Record<string, string> = {
    free: '#22c55e',
    light: '#84cc16',
    moderate: '#eab308',
    heavy: '#f97316',
    standstill: '#ef4444',
  };

  return {
    type: 'FeatureCollection',
    features: conditions.map((condition) => ({
      type: 'Feature',
      properties: {
        congestionLevel: condition.congestionLevel,
        estimatedDurationMin: condition.estimatedDurationMin,
        'stroke': CONGESTION_COLORS[condition.congestionLevel],
        'stroke-width': 4,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [condition.segment.from.lng, condition.segment.from.lat],
          [condition.segment.to.lng, condition.segment.to.lat],
        ],
      },
    })),
  };
}
```

#### Design Decisions

- **`geo-types` is a peer dep** — MapUI renders `PlaceResult[]` and `TrafficCondition[]` but never fetches them
- Consumers who don't need traffic visualization never pass `TrafficCondition[]`; the `trafficToGeoJSON` function tree-shakes away
- The `./adapters` export lets advanced consumers build custom GeoJSON without the React layer
- Themes are a separate export so consumers can customize without importing UI components

---

### Package: `@yourorg/geo-search`

Server-side multi-provider geo spatial queries with LLM fallback.

#### Structure

```
@yourorg/geo-search/
├── package.json
├── config.ts
├── index.ts
├── tools.ts                    ← geocode, reverseGeocode, placeSearch, navigate
├── processors.ts               ← LLM fallback hallucination guard
└── providers/
    ├── index.ts                ← provider registry + fallback chain
    ├── google-places.ts
    ├── mapbox-geocoding.ts
    ├── nominatim.ts            ← OpenStreetMap free tier
    └── llm-fallback.ts         ← LLM knowledge with confidence scoring
```

#### Plugin Config

```typescript
// @yourorg/geo-search/config.ts
import { z } from 'zod';

export const geoSearchPlugin = {
  id: 'geo-search',
  name: 'GeoSearch',
  version: '1.0.0',
  features: {
    tools: true,
    agents: false,
    ui: false,
    processors: true,    // LLM fallback hallucination guard
    storage: false,
  },
} as const;

export const GeoSearchConfigSchema = z.object({
  providers: z.object({
    google: z.object({ apiKey: z.string(), enabled: z.boolean().default(true) }).optional(),
    mapbox: z.object({ accessToken: z.string(), enabled: z.boolean().default(true) }).optional(),
    nominatim: z.object({ enabled: z.boolean().default(true) }).optional(),
    llmFallback: z.object({
      enabled: z.boolean().default(false),
      minConfidence: z.number().min(0).max(1).default(0.7),
    }).optional(),
  }),
  fallbackOrder: z.array(z.enum(['google', 'mapbox', 'nominatim', 'llm'])).default([
    'google', 'mapbox', 'nominatim', 'llm',
  ]),
});

export type GeoSearchConfig = z.infer<typeof GeoSearchConfigSchema>;
```

#### Package Exports

```json
{
  "name": "@yourorg/geo-search",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".":           { "import": "./src/index.ts",  "types": "./src/index.ts" },
    "./tools":     { "import": "./src/tools.ts",  "types": "./src/tools.ts" },
    "./providers": { "import": "./src/providers/index.ts", "types": "./src/providers/index.ts" }
  },
  "publishConfig": {
    "exports": {
      ".":           { "import": "./dist/index.js",  "types": "./dist/index.d.ts" },
      "./tools":     { "import": "./dist/tools.js",  "types": "./dist/tools.d.ts" },
      "./providers": { "import": "./dist/providers/index.js", "types": "./dist/providers/index.d.ts" }
    }
  },
  "peerDependencies": {
    "@yourorg/geo-types": "^1.0.0",
    "@mastra/core": "^1.0.0"
  }
}
```

#### Provider Fallback Chain

The provider registry implements a cascading fallback strategy:

```typescript
// @yourorg/geo-search/providers/index.ts
import type { PlaceResult, GeoPoint } from '@yourorg/geo-types';
import type { GeoSearchConfig } from '../config';

export interface GeoProvider {
  name: string;
  geocode(query: string): Promise<PlaceResult | null>;
  reverseGeocode(point: GeoPoint): Promise<PlaceResult | null>;
  placeSearch?(query: string, near: GeoPoint, category?: string): Promise<PlaceResult[]>;
}

/**
 * Creates a provider chain that tries each provider in order.
 * First successful result wins. If all fail, returns null.
 */
export function createProviderChain(config: GeoSearchConfig): GeoProvider {
  const providers: GeoProvider[] = [];

  for (const name of config.fallbackOrder) {
    switch (name) {
      case 'google':
        if (config.providers.google?.enabled && config.providers.google.apiKey) {
          providers.push(createGoogleProvider(config.providers.google.apiKey));
        }
        break;
      case 'mapbox':
        if (config.providers.mapbox?.enabled && config.providers.mapbox.accessToken) {
          providers.push(createMapboxProvider(config.providers.mapbox.accessToken));
        }
        break;
      case 'nominatim':
        if (config.providers.nominatim?.enabled !== false) {
          providers.push(createNominatimProvider());
        }
        break;
      case 'llm':
        if (config.providers.llmFallback?.enabled) {
          providers.push(createLLMFallbackProvider(config.providers.llmFallback.minConfidence));
        }
        break;
    }
  }

  return {
    name: 'chain',
    async geocode(query: string): Promise<PlaceResult | null> {
      for (const provider of providers) {
        const result = await provider.geocode(query).catch(() => null);
        if (result) return result;
      }
      return null;
    },
    async reverseGeocode(point: GeoPoint): Promise<PlaceResult | null> {
      for (const provider of providers) {
        const result = await provider.reverseGeocode(point).catch(() => null);
        if (result) return result;
      }
      return null;
    },
    async placeSearch(query: string, near: GeoPoint, category?: string): Promise<PlaceResult[]> {
      for (const provider of providers) {
        if (!provider.placeSearch) continue;
        const results = await provider.placeSearch(query, near, category).catch(() => []);
        if (results.length > 0) return results;
      }
      return [];
    },
  };
}
```

#### LLM Fallback with Anti-Hallucination

The LLM fallback is a last-resort geocoding provider. The anti-hallucination strategy uses cross-validation against real providers:

```typescript
// @yourorg/geo-search/providers/llm-fallback.ts
import { PlaceResultSchema, type PlaceResult, type GeoPoint } from '@yourorg/geo-types';
import type { GeoProvider } from './index';

/**
 * Uses LLM general knowledge as a last-resort geocoding provider.
 *
 * Anti-hallucination strategy:
 * 1. Ask LLM for structured output (lat/lng/name) with confidence
 * 2. Cross-validate: reverse-geocode the returned point with a real provider
 * 3. Check that reverse-geocoded address is semantically close to the query
 * 4. Score confidence based on provider agreement
 *
 * This is intentionally conservative. A low-confidence result is worse than
 * no result — the caller can prompt the user for clarification instead.
 */
export function createLLMFallbackProvider(minConfidence: number = 0.7): GeoProvider {
  return {
    name: 'llm-fallback',

    async geocode(query: string): Promise<PlaceResult | null> {
      // Step 1: Ask the LLM for structured geocoding
      const llmResult = await generateStructuredGeocode(query);
      if (!llmResult) return null;

      // Step 2: Reverse-geocode with a real provider to validate
      // Uses Nominatim (free) specifically to avoid recursion through the chain
      const reverseResult = await reverseGeocodeWithNominatim(llmResult.lat, llmResult.lng);

      // Step 3: Compute confidence by comparing LLM output vs real reverse-geocode
      const confidence = computeConfidence(query, reverseResult, llmResult);

      if (confidence < minConfidence) return null;

      return {
        id: `llm-${hashQuery(query)}`,
        name: llmResult.name,
        point: { lat: llmResult.lat, lng: llmResult.lng },
        provider: 'llm-fallback',
        confidence,
      };
    },

    async reverseGeocode(_point: GeoPoint): Promise<PlaceResult | null> {
      // LLM fallback doesn't support reverse geocoding — that's what real
      // providers are for. Return null to let the chain continue.
      return null;
    },
  };
}

/**
 * Confidence scoring based on agreement between LLM and real provider.
 *
 * Factors:
 * - Geographic distance between LLM point and reverse-geocoded point
 * - String similarity between query and reverse-geocoded address
 * - Whether the reverse-geocode returned anything at all
 */
function computeConfidence(
  originalQuery: string,
  reverseResult: { address: string; point: GeoPoint } | null,
  llmResult: { lat: number; lng: number; name: string }
): number {
  if (!reverseResult) return 0.2; // No validation possible — very low confidence

  // Distance check: LLM point vs reverse-geocoded point
  const distanceKm = haversineDistance(
    { lat: llmResult.lat, lng: llmResult.lng },
    reverseResult.point
  );

  // Within 1km = high agreement, 1-10km = moderate, >10km = disagreement
  const distanceScore = distanceKm < 1 ? 1.0 : distanceKm < 10 ? 0.6 : 0.2;

  // String similarity between query and reverse-geocoded address
  const similarityScore = stringSimilarity(
    originalQuery.toLowerCase(),
    reverseResult.address.toLowerCase()
  );

  // Weighted combination
  return distanceScore * 0.6 + similarityScore * 0.4;
}
```

#### Hallucination Guard Processor

Exposed as a plugin processor so consumers can opt-in to output validation:

```typescript
// @yourorg/geo-search/processors.ts
import type { PlaceResult } from '@yourorg/geo-types';

/**
 * Output processor that rejects low-confidence LLM fallback results.
 *
 * This is separate from the provider's internal confidence check because:
 * 1. Consumers may want different thresholds per deployment
 * 2. It provides an audit trail (processor rejections are logged)
 * 3. It can be disabled entirely for internal/trusted use cases
 */
export const geoHallucinationGuard = {
  id: 'geo-hallucination-guard',
  type: 'output' as const,

  async process(result: PlaceResult): Promise<PlaceResult> {
    if (result.provider === 'llm-fallback' && (result.confidence ?? 0) < 0.7) {
      throw new Error(
        `Low-confidence geocoding result for "${result.name}" ` +
        `(confidence: ${result.confidence}). ` +
        `Flagged by hallucination guard. Consider prompting the user for clarification.`
      );
    }
    return result;
  },
};
```

#### Tools

```typescript
// @yourorg/geo-search/tools.ts
import { createTool } from '@mastra/core/tools';
import {
  GeoPointSchema,
  PlaceResultSchema,
  GeoRouteSegmentSchema,
} from '@yourorg/geo-types';
import { z } from 'zod';

export const geocodeTool = createTool({
  id: 'geocode',
  description: `Convert an address or place name to geographic coordinates.
    Uses multiple providers with automatic fallback.
    Returns the best match with a confidence score.`,
  inputSchema: z.object({
    query: z.string().describe('Address, place name, or landmark to geocode'),
  }),
  outputSchema: PlaceResultSchema.nullable(),
  execute: async ({ input, context }) => {
    const chain = context.getProviderChain();
    return chain.geocode(input.query);
  },
});

export const placeSearchTool = createTool({
  id: 'placeSearch',
  description: `Search for places near a location. Returns rated results with categories.
    Supports attractions, restaurants, hotels, and activities.`,
  inputSchema: z.object({
    query: z.string().describe('What to search for'),
    near: GeoPointSchema.describe('Center point for the search'),
    category: z.string().optional().describe('Filter by category'),
    limit: z.number().default(10),
  }),
  outputSchema: z.object({
    results: z.array(PlaceResultSchema),
    query: z.string(),
  }),
  execute: async ({ input, context }) => {
    const chain = context.getProviderChain();
    const results = await chain.placeSearch(input.query, input.near, input.category);
    return {
      results: results.slice(0, input.limit),
      query: input.query,
    };
  },
});

export const navigateTool = createTool({
  id: 'navigate',
  description: `Get navigation directions between two points.
    Returns distance and estimated duration.`,
  inputSchema: z.object({
    from: GeoPointSchema,
    to: GeoPointSchema,
  }),
  outputSchema: GeoRouteSegmentSchema,
  execute: async ({ input, context }) => {
    // In production, calls a routing API (OSRM, Mapbox Directions, etc.)
    const route = await context.getRoutingProvider().getRoute(input.from, input.to);
    return {
      from: input.from,
      to: input.to,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
    };
  },
});

export const geoSearchTools = { geocodeTool, placeSearchTool, navigateTool };
```

---

## Layer 3: 3rd-Party Adapters

### Package: `@yourorg/traffic-adapter`

Thin wrapper normalizing 3rd-party traffic data to the `geo-types` contract.

#### Structure

```
@yourorg/traffic-adapter/
├── package.json
├── config.ts
├── index.ts
└── adapters/
    ├── tool-adapter.ts         ← wraps 3rd-party as a Mastra tool
    └── mcp-adapter.ts          ← wraps 3rd-party MCP server
```

#### Plugin Config

```typescript
// @yourorg/traffic-adapter/config.ts
import { z } from 'zod';

export const trafficAdapterPlugin = {
  id: 'traffic-adapter',
  name: 'Live Traffic Adapter',
  version: '1.0.0',
  features: {
    tools: true,
    agents: false,
    ui: false,
    processors: false,
    storage: false,
  },
} as const;

export const TrafficAdapterConfigSchema = z.object({
  mode: z.enum(['tool', 'mcp']).default('tool'),
  mcpServerUrl: z.string().url().optional(),
});
```

#### Tool Adapter

```typescript
// @yourorg/traffic-adapter/adapters/tool-adapter.ts
import { createTool } from '@mastra/core/tools';
import {
  GeoRouteSegmentSchema,
  TrafficConditionSchema,
  type TrafficCondition,
} from '@yourorg/geo-types';
import type { LiveTrafficPlugin } from '@third-party/live-traffic';

/**
 * Adapts @third-party/live-traffic to the geo-types contract.
 *
 * The 3rd-party package returns its own data shape. This adapter:
 * 1. Accepts geo-types input (GeoRouteSegment)
 * 2. Translates to the 3rd-party's expected format
 * 3. Normalizes the response back to geo-types (TrafficCondition)
 * 4. Validates with Zod to ensure contract compliance
 */
export function adaptTrafficTool(thirdPartyPlugin: LiveTrafficPlugin) {
  return createTool({
    id: 'getTrafficConditions',
    description: `Get live traffic conditions for a route segment.
      Returns congestion level and estimated travel duration.`,
    inputSchema: GeoRouteSegmentSchema,
    outputSchema: TrafficConditionSchema,
    execute: async ({ input }): Promise<TrafficCondition> => {
      // Call 3rd-party API with their expected format
      const raw = await thirdPartyPlugin.getTraffic(
        { latitude: input.from.lat, longitude: input.from.lng },
        { latitude: input.to.lat, longitude: input.to.lng }
      );

      // Normalize to our contract and validate
      return TrafficConditionSchema.parse({
        segment: input,
        congestionLevel: mapCongestionLevel(raw.level),
        estimatedDurationMin: raw.eta_minutes,
        updatedAt: new Date().toISOString(),
      });
    },
  });
}

/**
 * Maps 3rd-party congestion levels to our enum.
 * Isolates us from upstream naming changes.
 */
function mapCongestionLevel(
  thirdPartyLevel: string
): 'free' | 'light' | 'moderate' | 'heavy' | 'standstill' {
  const mapping: Record<string, TrafficCondition['congestionLevel']> = {
    'CLEAR': 'free',
    'SLOW': 'light',
    'CONGESTED': 'moderate',
    'VERY_CONGESTED': 'heavy',
    'BLOCKED': 'standstill',
    // Defensive defaults for unknown values
  };
  return mapping[thirdPartyLevel] ?? 'moderate';
}
```

#### MCP Adapter

```typescript
// @yourorg/traffic-adapter/adapters/mcp-adapter.ts
import { TrafficConditionSchema, GeoRouteSegmentSchema } from '@yourorg/geo-types';
import { z } from 'zod';

/**
 * If the 3rd-party traffic provider exposes an MCP server,
 * prefer this over the direct tool adapter for:
 * - Automatic tool discovery
 * - Standard protocol compliance
 * - Provider-managed auth
 */
export function createTrafficMCPConfig(mcpServerUrl: string) {
  return {
    type: 'mcp' as const,
    serverUrl: mcpServerUrl,
    toolMapping: {
      // Map MCP tool names to our tool IDs
      'get_traffic': 'getTrafficConditions',
    },
    /**
     * Output adapter normalizes MCP responses to our contract.
     * MCP returns arbitrary JSON — we validate it into TrafficCondition.
     */
    outputAdapter: (mcpToolName: string, mcpResult: unknown) => {
      if (mcpToolName === 'get_traffic') {
        return TrafficConditionSchema.parse(mcpResult);
      }
      return mcpResult;
    },
  };
}
```

#### Package Exports

```json
{
  "name": "@yourorg/traffic-adapter",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".":     { "import": "./src/index.ts", "types": "./src/index.ts" },
    "./mcp": { "import": "./src/adapters/mcp-adapter.ts", "types": "./src/adapters/mcp-adapter.ts" }
  },
  "peerDependencies": {
    "@yourorg/geo-types": "^1.0.0",
    "@mastra/core": "^1.0.0",
    "@third-party/live-traffic": "^2.0.0"
  }
}
```

Note: `@third-party/live-traffic` is a **peer dep**. The adapter doesn't bundle it — the consumer installs both.

---

### Package: `@yourorg/calendar-adapter`

Wraps Google Calendar MCP, exposing **only travel-relevant features** — not a full calendar client.

#### Structure

```
@yourorg/calendar-adapter/
├── package.json
├── config.ts
├── index.ts
└── tools/
    ├── check-travel-viability.ts
    └── find-travel-windows.ts
```

#### Travel Viability Tool

This is the most interesting tool because it demonstrates **graceful cross-package degradation**:

```typescript
// @yourorg/calendar-adapter/tools/check-travel-viability.ts
import { createTool } from '@mastra/core/tools';
import { GeoPointSchema, TimeWindowSchema } from '@yourorg/geo-types';
import { z } from 'zod';

export const checkTravelViabilityTool = createTool({
  id: 'checkTravelViability',
  description: `Check if there's enough travel time between calendar events.
    Given a departure point and destination, checks Google Calendar for conflicts
    and returns whether the trip is viable within available time windows.
    Uses live traffic data if available for more accurate estimates.`,
  inputSchema: z.object({
    from: GeoPointSchema,
    to: GeoPointSchema,
    departureAfter: z.string().datetime(),
    arriveBy: z.string().datetime().optional(),
  }),
  outputSchema: z.object({
    viable: z.boolean(),
    availableWindow: TimeWindowSchema.nullable(),
    conflictingEvents: z.array(z.object({
      title: z.string(),
      start: z.string().datetime(),
      end: z.string().datetime(),
    })),
    estimatedTravelMin: z.number().nullable(),
    trafficSource: z.enum(['live', 'estimated', 'unavailable']),
    suggestion: z.string().optional(),
  }),
  execute: async ({ input, context }) => {
    // 1. Query Google Calendar MCP for events in the time range
    const timeMax = input.arriveBy ?? addHours(input.departureAfter, 8);
    const events = await context.mcp.call('google-calendar', 'listEvents', {
      timeMin: input.departureAfter,
      timeMax,
    });

    // 2. Get travel time estimate — gracefully degrade if traffic not available
    //    This is the key pattern: optional cross-package dependency at runtime
    let travelEstimate: { estimatedDurationMin: number } | null = null;
    let trafficSource: 'live' | 'estimated' | 'unavailable' = 'unavailable';

    try {
      // Try live traffic first (requires @yourorg/traffic-adapter to be registered)
      travelEstimate = await context.tools.call('getTrafficConditions', {
        from: input.from,
        to: input.to,
      });
      trafficSource = 'live';
    } catch {
      // No traffic adapter registered — fall back to distance-based estimate
      const distanceKm = haversineDistance(input.from, input.to);
      if (distanceKm > 0) {
        travelEstimate = { estimatedDurationMin: Math.ceil(distanceKm / 40 * 60) }; // ~40km/h avg
        trafficSource = 'estimated';
      }
    }

    // 3. Find available windows between events
    const requiredMinutes = travelEstimate?.estimatedDurationMin ?? 60; // 1hr default
    const windows = findGaps(events, requiredMinutes, input.departureAfter, timeMax);
    const conflicting = events.filter((e: CalendarEvent) =>
      overlapsWithTravelWindow(e, input.departureAfter, requiredMinutes)
    );

    // 4. Generate human-readable suggestion
    const suggestion = generateSuggestion(windows, travelEstimate, conflicting, trafficSource);

    return {
      viable: windows.length > 0,
      availableWindow: windows[0] ?? null,
      conflictingEvents: conflicting.map((e: CalendarEvent) => ({
        title: e.summary,
        start: e.start.dateTime,
        end: e.end.dateTime,
      })),
      estimatedTravelMin: travelEstimate?.estimatedDurationMin ?? null,
      trafficSource,
      suggestion,
    };
  },
});
```

---

## Layer 4: Consumer Composition Patterns

### Consumer A: Backend Geocoding Service

No UI, no traffic, no calendar. Just geocoding tools behind an API.

```typescript
import { Mastra } from '@mastra/core';
import { geocodeTool, placeSearchTool } from '@yourorg/geo-search/tools';

const mastra = new Mastra({
  tools: { geocodeTool, placeSearchTool },
});
```

**Installed packages:**
- `@yourorg/geo-types`
- `@yourorg/geo-search`

### Consumer B: Location Search UI

Map + search, no traffic or calendar.

```typescript
import { geocodeTool, placeSearchTool } from '@yourorg/geo-search/tools';
import { MapView } from '@yourorg/map-ui/ui';
import { placesToGeoJSON } from '@yourorg/map-ui/adapters';
import { darkTheme } from '@yourorg/map-ui/themes';
```

```tsx
function SearchPage() {
  const [results, setResults] = useState<PlaceResult[]>([]);

  return (
    <MapView
      geojson={placesToGeoJSON(results)}
      theme={darkTheme}
      // No traffic layer — trafficToGeoJSON never imported
    />
  );
}
```

**Installed packages:**
- `@yourorg/geo-types`
- `@yourorg/geo-search`
- `@yourorg/map-ui`
- `maplibre-gl`

### Consumer C: Full Trip Planner Agent

Everything wired together.

```typescript
import { Agent } from '@mastra/core';
import { geoSearchTools } from '@yourorg/geo-search/tools';
import { geoHallucinationGuard } from '@yourorg/geo-search/processors';
import { adaptTrafficTool } from '@yourorg/traffic-adapter';
import { checkTravelViabilityTool } from '@yourorg/calendar-adapter';
import liveTraffic from '@third-party/live-traffic';

const tripAgent = new Agent({
  name: 'trip-planner',
  instructions: `You are a trip planning assistant. Use geocoding to find locations,
    check traffic conditions for routes, and verify calendar availability
    before suggesting travel plans.`,
  tools: {
    ...geoSearchTools,
    getTraffic: adaptTrafficTool(liveTraffic),
    checkTravel: checkTravelViabilityTool,
  },
  processors: {
    output: [geoHallucinationGuard],
  },
});
```

**Installed packages:** all of them.

### Consumer D: "Can I Make This Meeting?" Check

Traffic + calendar only. No map, no geo search.

```typescript
import { adaptTrafficTool } from '@yourorg/traffic-adapter';
import { checkTravelViabilityTool } from '@yourorg/calendar-adapter';
import liveTraffic from '@third-party/live-traffic';

const meetingCheck = new Agent({
  name: 'meeting-viability',
  instructions: `Check if the user can travel between locations in time for their meetings.`,
  tools: {
    getTraffic: adaptTrafficTool(liveTraffic),
    checkTravel: checkTravelViabilityTool,
  },
});
```

**Installed packages:**
- `@yourorg/geo-types`
- `@yourorg/traffic-adapter`
- `@yourorg/calendar-adapter`
- `@third-party/live-traffic`

Note: `@yourorg/geo-search` is **not installed**. The calendar adapter's travel viability tool gracefully degrades — it uses haversine distance estimation instead of live traffic when `getTrafficConditions` isn't registered.

### Consumer E: Route Visualization Dashboard

Map + traffic, no search or calendar.

```typescript
import { MapView } from '@yourorg/map-ui/ui';
import { trafficToGeoJSON } from '@yourorg/map-ui/adapters';
import { adaptTrafficTool } from '@yourorg/traffic-adapter';
```

**Installed packages:**
- `@yourorg/geo-types`
- `@yourorg/map-ui`
- `@yourorg/traffic-adapter`
- `@third-party/live-traffic`
- `maplibre-gl`

---

## Key Design Patterns

### 1. Contract Types as Shared Language

Every package depends on `@yourorg/geo-types` as a peer dependency. This means:
- A single `PlaceResult` shape everywhere — no adapter code between internal packages
- Zod schemas provide runtime validation at system boundaries
- Type changes propagate through `peerDependencies` version bumps
- Zero runtime cost (schemas are tiny)

### 2. Adapter Pattern for 3rd-Party Packages

```
Your code  →  Adapter  →  3rd-party package
              (thin)
    speaks geo-types       speaks their own types
```

Adapters are intentionally thin. They should:
- Translate input from `geo-types` → 3rd-party format
- Call the 3rd-party API
- Translate output from 3rd-party format → `geo-types`
- Validate with Zod (`TrafficConditionSchema.parse(...)`)

If the 3rd-party package changes its API, **only the adapter changes**. No downstream consumer code is affected.

### 3. Graceful Cross-Package Degradation

The `checkTravelViabilityTool` demonstrates the most important production pattern:

```typescript
// Try to use traffic data if available, but don't break if it isn't
let travelEstimate = null;
let trafficSource = 'unavailable';

try {
  travelEstimate = await context.tools.call('getTrafficConditions', { from, to });
  trafficSource = 'live';
} catch {
  // Fall back to distance-based estimate
  const distanceKm = haversineDistance(from, to);
  travelEstimate = { estimatedDurationMin: Math.ceil(distanceKm / 40 * 60) };
  trafficSource = 'estimated';
}
```

This means:
- The tool works regardless of whether `@yourorg/traffic-adapter` is registered
- It gives **better results** when traffic is available
- The `trafficSource` field lets the UI communicate confidence to the user
- No compile-time dependency between calendar-adapter and traffic-adapter

### 4. MCP as a First-Class Integration Path

For 3rd-party services that expose MCP servers, prefer MCP over direct API calls:

```typescript
// Prefer MCP (standard protocol, provider-managed auth)
const events = await context.mcp.call('google-calendar', 'listEvents', { ... });

// vs. Direct API (you manage auth, handle API changes)
const events = await fetch('https://www.googleapis.com/calendar/v3/...', { ... });
```

MCP benefits:
- Standard tool discovery protocol
- Auth managed by the MCP server
- Provider can update their API without breaking your adapter
- Same integration pattern regardless of provider

### 5. Processors for Cross-Cutting Concerns

The hallucination guard is a processor (not baked into the provider) because:
- Different consumers want different confidence thresholds
- Some internal tools may trust LLM results that external-facing tools shouldn't
- Processors provide an audit trail (logged separately from tool execution)
- They can be composed: `[geoHallucinationGuard, rateLimitGuard, loggingProcessor]`

### 6. Selective Entry Point Exports

Every package exposes multiple entry points:

```json
{
  "exports": {
    ".":           "./src/index.ts",       // Full plugin
    "./tools":     "./src/tools.ts",       // Just the tools
    "./providers": "./src/providers/index.ts",  // Just the provider chain
    "./adapters":  "./src/lib/geojson-adapter.ts"  // Just data transforms
  }
}
```

This enables:
- Backend services import `./tools` without pulling UI code
- Custom UIs import `./adapters` without the default `<MapView />`
- Advanced consumers import `./providers` to build custom fallback chains

---

## Monorepo Layout

```
packages/
├── geo-types/                  ← Shared contract (types + schemas)
│   ├── package.json
│   └── src/index.ts
├── map-ui/                     ← Client-side mapping
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       ├── ui.tsx
│       └── lib/
├── geo-search/                 ← Multi-provider geo queries
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       ├── tools.ts
│       ├── processors.ts
│       └── providers/
├── traffic-adapter/            ← 3rd-party traffic normalization
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       └── adapters/
└── calendar-adapter/           ← MCP Google Calendar for travel
    ├── package.json
    └── src/
        ├── index.ts
        ├── config.ts
        └── tools/
```

Internal `package.json` references use workspace protocol:

```json
{
  "peerDependencies": {
    "@yourorg/geo-types": "workspace:^1.0.0"
  }
}
```

These resolve to proper version ranges on publish.

---

## Open Questions

1. **Provider credential management**: Should API keys (Google Places, Mapbox) live in `geo-search` config, in environment variables, or in a shared secrets provider? Production systems often need per-tenant credentials.

2. **Caching strategy**: Geocoding results are highly cacheable. Should caching be a concern of `geo-search` internally, or a separate `@yourorg/geo-cache` package that wraps any tool? The latter is more composable but adds another package.

3. **Offline/degraded mode**: If all providers are down, should `geo-search` queue requests and retry, or fail immediately? The fallback chain handles provider failures, but not network-level outages.

4. **Rate limiting across providers**: When multiple consumers share a Google Places API key, who enforces rate limits? This might warrant a shared rate limiter at the provider level.

5. **MCP server lifecycle**: Who starts/stops the Google Calendar MCP server? The adapter assumes it's running. In production, you may need a process manager or sidecar pattern.

6. **Map tile sources**: MapUI needs tile server URLs (MapLibre). These could come from `geo-search` config (it already has Mapbox credentials), but that creates a dependency. A separate `@yourorg/tile-config` package might be cleaner.

---

## References

- [Plugin Architecture Patterns](plugin-architecture-patterns.md) — Foundation research on Payload CMS, Medusa.js, Strapi, Vite patterns
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) — Open-source map rendering
- [GeoJSON Specification (RFC 7946)](https://datatracker.ietf.org/doc/html/rfc7946) — Standard geo data format
- [Model Context Protocol](https://modelcontextprotocol.io/) — MCP specification
- [Mastra.ai Tools](https://mastra.ai/docs/tools/overview) — Tool creation patterns
- [Nominatim API](https://nominatim.org/release-docs/develop/api/Overview/) — Free OpenStreetMap geocoding
