// examples/research-bot/agents.ts
import { Agent } from '@mastra/core/agent';
import { researchPluginConfig } from './config';
import { deepResearchTool } from './tools';

/**
 * Analysis Agent
 *
 * A specialized agent for analyzing content.
 * This agent is called from within the deepResearchTool
 * to provide analysis of research findings.
 */
export const analysisAgent = new Agent({
  id: 'analysis-agent',
  name: 'Analysis Agent',
  instructions: `
    You are an expert analyst. Your role is to:
    - Analyze content for key insights
    - Determine overall sentiment (positive, neutral, negative)
    - Provide confidence scores for your analysis
    - Be objective and thorough

    Always structure your response with clear analysis points.
  `,
  model: 'openai/gpt-4o',
});

/**
 * Research Agent
 *
 * The main agent that coordinates research tasks.
 * Uses the deepResearchTool which internally calls the analysisAgent.
 */
export const researchAgent = new Agent({
  id: researchPluginConfig.id,
  name: researchPluginConfig.name,
  instructions: `
    You are a research assistant that helps users explore topics in depth.

    When asked to research a topic:
    - Use the deepResearchTool to gather and analyze information
    - The tool will stream analysis from a nested agent
    - Synthesize the results into a clear, actionable response

    Be thorough but concise in your explanations.
  `,
  model: 'openai/gpt-4o',
  tools: {
    deepResearchTool,
  },
});
