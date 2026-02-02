// examples/research-bot/agents.ts
import { Agent } from '@mastra/core/agent';
import { researchBotConfig } from './config';
import { deepResearchTool } from './tools';

/**
 * Expert Agent (Nested)
 *
 * A specialized agent that provides expert analysis.
 * This agent is NOT used directly by users - it's called from within the
 * deepResearchTool to provide detailed analysis.
 *
 * IMPORTANT: This agent must be registered with Mastra for the nested
 * streaming pattern to work. The tool uses context.mastra.getAgent('expert-agent')
 * to retrieve it.
 */
export const expertAgent = new Agent({
  name: 'expert-agent',
  instructions: `You are an expert analyst with deep knowledge across many domains.

Your role is to provide thorough, well-structured analysis when consulted.

Guidelines:
- Think step by step, explaining your reasoning
- Mark key findings with importance levels: HIGH, MEDIUM, or LOW
- Identify connections to related topics
- Be honest about your confidence level
- Use clear formatting with headers and bullet points

When analyzing, always consider:
- Current state and context
- Historical background
- Future implications
- Potential controversies or debates
- Practical applications`,
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-5-mini',
  },
});

/**
 * Research Bot (Main Agent)
 *
 * The primary agent that users interact with. When asked to research a topic,
 * it uses the deepResearchTool which internally streams from the expertAgent.
 *
 * This creates a "nested agent streaming" experience where:
 * 1. User asks Research Bot a question
 * 2. Research Bot calls deepResearchTool
 * 3. deepResearchTool calls expertAgent and streams its response
 * 4. User sees expertAgent's thinking in real-time
 * 5. Tool returns structured findings
 * 6. Research Bot summarizes the results
 */
export const researchBot = new Agent({
  name: researchBotConfig.id,
  instructions: `You are a research assistant that helps users explore topics in depth.

When users ask you to research something:
1. Use the deepResearch tool to analyze the topic
2. The tool will consult an expert agent (users will see its thinking in real-time)
3. Summarize the key findings in a clear, actionable way

You can adjust research depth:
- "quick" for brief overviews
- "standard" for thorough analysis
- "deep" for exhaustive investigation

Be conversational and helpful. Highlight the most important findings and
suggest follow-up questions the user might want to explore.`,
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-5-mini',
  },
  tools: {
    deepResearch: deepResearchTool,
  },
});

// Also export with original names for backwards compatibility
export const analysisAgent = expertAgent;
export const researchAgent = researchBot;
