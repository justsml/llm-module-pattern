// examples/generative-ui/tools.ts
import { createTool } from '@mastra/core/tools';
import { weatherInputSchema, weatherOutputSchema } from './config';

export const weatherTool = createTool({
  id: 'weatherTool',
  description: `
    Retrieves current weather information for a given location.
    Use this tool when the user asks about weather conditions.
    Returns temperature, description, humidity, and wind speed.
  `,
  inputSchema: weatherInputSchema,
  outputSchema: weatherOutputSchema,
  execute: async (inputData) => {
    const { location } = inputData;

    // Fetch weather from wttr.in API
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(location)}?format=j1`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch weather for ${location}`);
    }

    const data = await response.json();
    const current = data.current_condition[0];

    return {
      location: data.nearest_area[0].areaName[0].value,
      temperature: parseInt(current.temp_C, 10),
      description: current.weatherDesc[0].value,
      humidity: parseInt(current.humidity, 10),
      windSpeed: parseInt(current.windspeedKmph, 10),
      icon: current.weatherCode,
    };
  },
});
