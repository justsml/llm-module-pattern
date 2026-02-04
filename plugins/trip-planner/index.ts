// trip-planner/index.ts
// Main entry point for the trip-planner plugin package

/**
 * Trip Planner Plugin
 *
 * A publishable plugin package that provides:
 * - Tools: Weather lookup, place discovery, map generation
 * - Agent: Trip planning assistant
 * - UI: Visual components for tool outputs
 * - Schemas: Typed input/output definitions
 *
 * @example
 * ```typescript
 * // Import the full plugin
 * import tripPlannerPlugin from '@myorg/trip-planner'
 *
 * // Or import specific parts
 * import { weatherTool, placesTool } from '@myorg/trip-planner/tools'
 * import { WeatherCard, PlacesCard } from '@myorg/trip-planner/ui'
 * import type { WeatherOutput, PlacesOutput } from '@myorg/trip-planner'
 * ```
 */

// Plugin manifest and configuration (required)
export {
  tripPlannerConfig,
  tripPlannerPlugin,
  type TripPlannerPlugin,
} from './config';

// Schemas and types
export {
  // Weather
  weatherInputSchema,
  weatherOutputSchema,
  type WeatherInput,
  type WeatherOutput,
  // Places
  placesInputSchema,
  placesOutputSchema,
  type PlacesInput,
  type PlacesOutput,
  // GeoJSON
  geojsonInputSchema,
  geojsonOutputSchema,
  type GeoJsonInput,
  type GeoJsonOutput,
} from './config';

// Tools
export {
  weatherTool,
  placesTool,
  geojsonTool,
  tripPlannerTools,
} from './tools';

// Agent
export { tripPlannerAgent } from './agent';

// UI components are exported from ui.tsx
// Note: UI is typically imported separately to avoid server-side React issues
// import { WeatherCard, PlacesCard, GeoJsonCard, TripPlannerDemo } from '@myorg/trip-planner/ui'

// Default export: the plugin manifest
export { tripPlannerPlugin as default } from './config';
