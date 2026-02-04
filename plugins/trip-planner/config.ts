// examples/trip-planner/config.ts
import { z } from 'zod';

/**
 * Plugin Metadata
 *
 * Required for all plugins. Declares basic identity.
 */
export const tripPlannerConfig = {
  id: 'trip-planner',
  name: 'Trip Planner Plugin',
  version: '1.0.0',
} as const;

// =============================================================================
// Weather Tool Schemas
// =============================================================================

export const weatherInputSchema = z.object({
  location: z.string().describe('City name or location to get weather for'),
});

export const weatherOutputSchema = z.object({
  location: z.string(),
  temperature: z.number(),
  feelsLike: z.number(),
  description: z.string(),
  humidity: z.number(),
  windSpeed: z.number(),
  uvIndex: z.number(),
  forecast: z.array(
    z.object({
      date: z.string(),
      high: z.number(),
      low: z.number(),
      description: z.string(),
    })
  ),
});

export type WeatherInput = z.infer<typeof weatherInputSchema>;
export type WeatherOutput = z.infer<typeof weatherOutputSchema>;

// =============================================================================
// Places Tool Schemas
// =============================================================================

export const placesInputSchema = z.object({
  location: z.string().describe('City or area to search'),
  category: z.enum(['attractions', 'restaurants', 'hotels', 'activities'])
    .describe('Type of places to find'),
  limit: z.number().default(5).describe('Number of results'),
});

export const placesOutputSchema = z.object({
  location: z.string(),
  category: z.string(),
  places: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      rating: z.number().optional(),
      priceLevel: z.string().optional(),
      tags: z.array(z.string()),
    })
  ),
});

export type PlacesInput = z.infer<typeof placesInputSchema>;
export type PlacesOutput = z.infer<typeof placesOutputSchema>;

// =============================================================================
// GeoJSON Map Tool Schemas
// =============================================================================

export const geojsonInputSchema = z.object({
  location: z.string().describe('Central location for the map'),
  points: z.array(
    z.object({
      name: z.string().describe('Name of the point of interest'),
      description: z.string().optional().describe('Description of the location'),
      lat: z.number().describe('Latitude coordinate'),
      lng: z.number().describe('Longitude coordinate'),
      type: z.enum(['attraction', 'restaurant', 'hotel', 'activity', 'other']).default('other'),
    })
  ).describe('Points of interest to display on the map'),
});

export const geojsonOutputSchema = z.object({
  location: z.string(),
  geojson: z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.object({
      type: z.literal('Feature'),
      properties: z.object({
        name: z.string(),
        description: z.string().optional(),
        markerType: z.string(),
      }),
      geometry: z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()]),
      }),
    })),
  }),
  viewerUrl: z.string().describe('URL to view the GeoJSON on geojson.io'),
  pointCount: z.number(),
});

export type GeoJsonInput = z.infer<typeof geojsonInputSchema>;
export type GeoJsonOutput = z.infer<typeof geojsonOutputSchema>;

// =============================================================================
// Plugin Manifest
// =============================================================================

/**
 * Plugin Manifest
 *
 * Declares what features this plugin provides. The config/index is required
 * and should declare the parts of the plugin that are available.
 *
 * This plugin provides:
 * - tools: Weather, places discovery, and map generation
 * - agents: A trip planning assistant
 * - ui: Visual components for each tool output
 * - schemas: Typed input/output for all tools
 */
export const tripPlannerPlugin = {
  ...tripPlannerConfig,

  /**
   * Declares available features.
   * Used by consuming applications to understand what this plugin provides.
   */
  features: {
    tools: true,
    agents: true,
    ui: true,
    processors: false,
    storage: false,
  },

  /**
   * Tool IDs provided by this plugin.
   * Actual implementations are in tools.ts
   */
  toolIds: ['getWeather', 'findPlaces', 'generateMap'] as const,

  /**
   * Agent IDs provided by this plugin.
   * Actual implementations are in agent.ts
   */
  agentIds: ['trip-planner'] as const,

  /**
   * UI component mappings.
   * Maps tool IDs to component identifiers for rendering.
   */
  uiComponents: {
    'tool-getWeather': 'WeatherCard',
    'tool-findPlaces': 'PlacesCard',
    'tool-generateMap': 'GeoJsonCard',
  } as const,

  /**
   * All schemas exported by this plugin.
   * Enables type-safe consumption across package boundaries.
   */
  schemas: {
    weatherInput: weatherInputSchema,
    weatherOutput: weatherOutputSchema,
    placesInput: placesInputSchema,
    placesOutput: placesOutputSchema,
    geojsonInput: geojsonInputSchema,
    geojsonOutput: geojsonOutputSchema,
  },
} as const;

export type TripPlannerPlugin = typeof tripPlannerPlugin;
