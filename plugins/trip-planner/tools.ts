// examples/trip-planner/tools.ts
import { createTool } from '@mastra/core/tools';
import {
  weatherInputSchema,
  weatherOutputSchema,
  placesInputSchema,
  placesOutputSchema,
  geojsonInputSchema,
  geojsonOutputSchema,
} from './config';

/**
 * Weather Tool
 *
 * Fetches current weather and forecast from wttr.in API.
 * Demonstrates: Basic tool execution with external API call.
 */
export const weatherTool = createTool({
  id: 'getWeather',
  description: `Get current weather and 3-day forecast for a location.
    Use when planning trips or suggesting what to pack.
    Returns temperature, humidity, UV index, and daily forecasts.`,
  inputSchema: weatherInputSchema,
  outputSchema: weatherOutputSchema,
  execute: async ({ input }) => {
    const { location } = input;

    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(location)}?format=j1`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch weather for ${location}`);
    }

    const data = await response.json();
    const current = data.current_condition[0];
    const forecasts = data.weather.slice(0, 3);

    return {
      location: data.nearest_area[0].areaName[0].value,
      temperature: parseInt(current.temp_C, 10),
      feelsLike: parseInt(current.FeelsLikeC, 10),
      description: current.weatherDesc[0].value,
      humidity: parseInt(current.humidity, 10),
      windSpeed: parseInt(current.windspeedKmph, 10),
      uvIndex: parseInt(current.uvIndex, 10),
      forecast: forecasts.map((day: Record<string, unknown>) => ({
        date: day.date as string,
        high: parseInt((day.maxtempC as string) || '0', 10),
        low: parseInt((day.mintempC as string) || '0', 10),
        description: ((day.hourly as Array<{ weatherDesc: Array<{ value: string }> }>)?.[4]?.weatherDesc?.[0]?.value) || 'Unknown',
      })),
    };
  },
});

/**
 * Places Tool
 *
 * Returns curated places for a destination.
 * Demonstrates: Tool with enum input and structured array output.
 *
 * Note: In production, this would call a real places API (Google Places, Yelp, etc.)
 */
export const placesTool = createTool({
  id: 'findPlaces',
  description: `Find attractions, restaurants, hotels, or activities in a location.
    Use to help users discover things to do and places to visit.
    Returns names, descriptions, ratings, and tags.`,
  inputSchema: placesInputSchema,
  outputSchema: placesOutputSchema,
  execute: async ({ input }) => {
    const { location, category, limit } = input;

    // Simulated places data - in production, call a real API
    const placesData: Record<string, Array<{
      name: string;
      description: string;
      rating: number;
      priceLevel: string;
      tags: string[];
    }>> = {
      attractions: [
        { name: 'Historic City Center', description: 'UNESCO World Heritage walking district', rating: 4.8, priceLevel: 'Free', tags: ['history', 'walking', 'photography'] },
        { name: 'National Museum', description: 'Art and cultural artifacts from the region', rating: 4.6, priceLevel: '$$', tags: ['museum', 'culture', 'indoor'] },
        { name: 'Botanical Gardens', description: 'Beautiful gardens with rare plant species', rating: 4.7, priceLevel: '$', tags: ['nature', 'gardens', 'relaxing'] },
        { name: 'Observatory Tower', description: 'Panoramic city views from 200m height', rating: 4.5, priceLevel: '$$', tags: ['views', 'photography', 'landmark'] },
        { name: 'Old Market Square', description: 'Traditional market with local crafts and food', rating: 4.4, priceLevel: '$', tags: ['shopping', 'food', 'local'] },
      ],
      restaurants: [
        { name: 'Local Flavors', description: 'Traditional cuisine with modern twist', rating: 4.7, priceLevel: '$$', tags: ['local', 'dinner', 'romantic'] },
        { name: 'Street Food Market', description: 'Dozens of food stalls in one location', rating: 4.5, priceLevel: '$', tags: ['casual', 'variety', 'lunch'] },
        { name: 'Rooftop Dining', description: 'Fine dining with city views', rating: 4.8, priceLevel: '$$$', tags: ['upscale', 'views', 'special occasion'] },
        { name: 'Family Kitchen', description: 'Homestyle cooking, generous portions', rating: 4.6, priceLevel: '$', tags: ['family', 'comfort food', 'value'] },
        { name: 'Fusion Bistro', description: 'Creative international menu', rating: 4.4, priceLevel: '$$', tags: ['creative', 'international', 'trendy'] },
      ],
      hotels: [
        { name: 'Grand Central Hotel', description: 'Luxury hotel in city center', rating: 4.8, priceLevel: '$$$', tags: ['luxury', 'central', 'spa'] },
        { name: 'Boutique Inn', description: 'Charming rooms with local character', rating: 4.6, priceLevel: '$$', tags: ['boutique', 'unique', 'breakfast'] },
        { name: 'Budget Hostel', description: 'Clean, social, great location', rating: 4.3, priceLevel: '$', tags: ['budget', 'social', 'backpacker'] },
        { name: 'Beach Resort', description: 'Oceanfront with pool and activities', rating: 4.7, priceLevel: '$$$', tags: ['beach', 'pool', 'resort'] },
        { name: 'Business Suites', description: 'Modern apartments for longer stays', rating: 4.5, priceLevel: '$$', tags: ['apartments', 'kitchen', 'workspace'] },
      ],
      activities: [
        { name: 'Walking Food Tour', description: '3-hour guided tour of local cuisine', rating: 4.9, priceLevel: '$$', tags: ['food', 'guided', 'walking'] },
        { name: 'Bike City Tour', description: 'See the highlights on two wheels', rating: 4.7, priceLevel: '$', tags: ['biking', 'active', 'sightseeing'] },
        { name: 'Cooking Class', description: 'Learn to make local dishes', rating: 4.8, priceLevel: '$$', tags: ['cooking', 'hands-on', 'food'] },
        { name: 'Day Trip to Mountains', description: 'Scenic hike with stunning views', rating: 4.6, priceLevel: '$$', tags: ['hiking', 'nature', 'day trip'] },
        { name: 'River Cruise', description: 'Relaxing boat tour with commentary', rating: 4.5, priceLevel: '$$', tags: ['boat', 'relaxing', 'scenic'] },
      ],
    };

    const places = placesData[category] || [];

    return {
      location,
      category,
      places: places.slice(0, limit || 5),
    };
  },
});

/**
 * GeoJSON Map Tool
 *
 * Generates a GeoJSON FeatureCollection from points of interest
 * and returns a URL to view it on geojson.io.
 * Demonstrates: Tool that generates map data with external viewer integration.
 */
export const geojsonTool = createTool({
  id: 'generateMap',
  description: `Create an interactive map with points of interest.
    Takes a location and list of points with coordinates.
    Returns a GeoJSON object and a link to view it on geojson.io.
    Use this to visualize trip destinations, routes, or locations on a map.`,
  inputSchema: geojsonInputSchema,
  outputSchema: geojsonOutputSchema,
  execute: async ({ input }) => {
    const { location, points } = input;

    // Map point types to marker colors for geojson.io
    const markerColors: Record<string, string> = {
      attraction: '#9333ea', // purple
      restaurant: '#f97316', // orange
      hotel: '#22c55e',      // green
      activity: '#ec4899',   // pink
      other: '#6b7280',      // gray
    };

    // Build GeoJSON FeatureCollection
    const geojson = {
      type: 'FeatureCollection' as const,
      features: points.map((point) => ({
        type: 'Feature' as const,
        properties: {
          name: point.name,
          description: point.description || '',
          markerType: point.type,
          'marker-color': markerColors[point.type] || markerColors.other,
          'marker-size': 'medium',
          'marker-symbol': getMarkerSymbol(point.type),
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [point.lng, point.lat] as [number, number], // GeoJSON uses [lng, lat]
        },
      })),
    };

    // Encode GeoJSON for geojson.io URL
    // geojson.io accepts data via hash: #data=data:application/json,<encoded>
    const geojsonString = JSON.stringify(geojson);
    const encodedData = encodeURIComponent(geojsonString);
    const viewerUrl = `https://geojson.io/#data=data:application/json,${encodedData}`;

    return {
      location,
      geojson,
      viewerUrl,
      pointCount: points.length,
    };
  },
});

/**
 * Get a marker symbol for geojson.io based on point type
 */
function getMarkerSymbol(type: string): string {
  const symbols: Record<string, string> = {
    attraction: 'monument',
    restaurant: 'restaurant',
    hotel: 'lodging',
    activity: 'pitch',
    other: 'marker',
  };
  return symbols[type] || 'marker';
}

// Export all tools
export const tripPlannerTools = {
  weatherTool,
  placesTool,
  geojsonTool,
};
