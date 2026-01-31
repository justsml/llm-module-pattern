// examples/trip-planner/config.ts
import { z } from 'zod';

export const weatherPluginConfig = {
  id: 'weather-plugin',
  name: 'Weather Plugin',
  version: '1.0.0',
} as const;

// Weather Tool Schemas
export const weatherInputSchema = z.object({
  location: z.string().describe('City name or location to get weather for'),
});

export const weatherOutputSchema = z.object({
  location: z.string(),
  temperature: z.number(),
  description: z.string(),
  humidity: z.number(),
  windSpeed: z.number(),
  icon: z.string().optional(),
});

export type WeatherInput = z.infer<typeof weatherInputSchema>;
export type WeatherOutput = z.infer<typeof weatherOutputSchema>;
