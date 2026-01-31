// examples/nested-agent-streams/tools.ts
import { createTool } from '@mastra/core/tools';
import { researchInputSchema, researchOutputSchema } from './config';

/**
 * Deep Research Tool with Nested Agent Streaming
 *
 * This tool demonstrates how to:
 * 1. Retrieve an agent from within a tool
 * 2. Stream the agent's response back to the UI
 * 3. Process the agent's output and return structured data
 *
 * The nested agent stream creates `data-tool-agent` parts
 * that can be rendered in the UI.
 */
export const deepResearchTool = createTool({
  id: 'deepResearchTool',
  description: `
    Performs deep research on a topic using a nested analysis agent.
    The analysis agent's thinking is streamed to the UI in real-time.
    Returns a structured research summary with key points.
  `,
  inputSchema: researchInputSchema,
  outputSchema: researchOutputSchema,
  execute: async (inputData, context) => {
    const { topic, depth } = inputData;

    // Emit custom progress event
    await context?.writer?.custom({
      type: 'research-started',
      data: { topic, depth, startedAt: new Date().toISOString() },
    });

    // Get the analysis agent from the Mastra context
    const analysisAgent = context?.mastra?.getAgent('analysis-agent');

    if (!analysisAgent) {
      throw new Error('Analysis agent not found in context');
    }

    // Build the analysis prompt based on depth
    const depthInstructions = {
      brief: 'Provide a brief 2-3 sentence analysis.',
      detailed: 'Provide a detailed analysis with multiple perspectives.',
      comprehensive:
        'Provide a comprehensive analysis covering all aspects, implications, and potential future developments.',
    };

    const prompt = `
      Analyze the following topic: "${topic}"

      ${depthInstructions[depth]}

      Structure your response as:
      1. Main analysis
      2. Key insights (bullet points)
      3. Overall sentiment assessment
    `;

    // Stream the nested agent's response
    // This creates `data-tool-agent` parts in the message
    const stream = await analysisAgent.stream({
      messages: [{ role: 'user', content: prompt }],
    });

    // Pipe the agent's full stream to the context writer
    // This enables real-time streaming of the agent's thinking to the UI
    if (context?.writer) {
      await stream.fullStream.pipeTo(context.writer);
    }

    // Extract the final text from the stream
    const analysisText = await stream.text;

    // Emit completion event
    await context?.writer?.custom({
      type: 'research-completed',
      data: { topic, completedAt: new Date().toISOString() },
    });

    // Parse and structure the response
    const keyPoints = extractKeyPoints(analysisText);

    return {
      topic,
      summary: analysisText,
      keyPoints,
      sources: [], // Would be populated from actual research
    };
  },
});

/**
 * Helper to extract key points from analysis text
 */
function extractKeyPoints(text: string): string[] {
  // Simple extraction - looks for bullet points or numbered items
  const lines = text.split('\n');
  const points: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match bullet points or numbered lists
    if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const point = trimmed.replace(/^[-*•\d.)]+\s+/, '');
      if (point.length > 10) {
        points.push(point);
      }
    }
  }

  return points.slice(0, 5); // Return top 5 points
}
