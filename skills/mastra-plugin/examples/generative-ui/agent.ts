// examples/generative-ui/agent.ts
import { Agent } from '@mastra/core/agent';
import { weatherPluginConfig } from './config';
import { weatherTool } from './tools';

export const weatherAgent = new Agent({
  id: weatherPluginConfig.id,
  name: weatherPluginConfig.name,
  instructions: `
    You are a helpful weather assistant.

    When users ask about weather:
    - Use the weatherTool to fetch current conditions
    - Provide friendly, conversational responses
    - Include relevant details like temperature, humidity, and wind
    - Suggest appropriate clothing or activities based on conditions

    Keep responses concise but informative.
  `,
  model: 'openai/gpt-4o',
  tools: {
    weatherTool,
  },
});
