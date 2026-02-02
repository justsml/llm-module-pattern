// examples/research-bot/tools.ts
import { createTool } from '@mastra/core/tools';
import { researchInputSchema, researchOutputSchema } from './config';

/**
 * Deep Research Tool
 *
 * Demonstrates NESTED AGENT STREAMING - calling an agent from within a tool
 * and piping its output stream directly to the UI.
 *
 * Key patterns:
 * 1. context.mastra.getAgent() - Retrieve a registered agent
 * 2. agent.stream() - Get a streaming response
 * 3. stream.fullStream.pipeTo(context.writer) - Pipe to UI
 * 4. context.writer.custom() - Emit progress events
 */
export const deepResearchTool = createTool({
  id: 'deepResearch',
  description: `Perform deep research on a topic by consulting an expert analysis agent.
    The expert's thinking is streamed to the UI in real-time, creating a "thinking out loud" experience.
    Returns structured findings with importance rankings.`,
  inputSchema: researchInputSchema,
  outputSchema: researchOutputSchema,
  execute: async ({ input, context }) => {
    const { topic, depth } = input;

    // ==========================================================================
    // Step 1: Emit a custom event to show research started
    // ==========================================================================
    await context?.writer?.custom({
      type: 'research-phase',
      data: {
        phase: 'starting',
        topic,
        depth,
        timestamp: new Date().toISOString(),
      },
    });

    // ==========================================================================
    // Step 2: Get the expert agent from the Mastra registry
    // ==========================================================================
    const expertAgent = context?.mastra?.getAgent('expert-agent');

    if (!expertAgent) {
      throw new Error('Expert agent not available. Make sure it is registered with Mastra.');
    }

    // ==========================================================================
    // Step 3: Build a prompt based on research depth
    // ==========================================================================
    const depthPrompts = {
      quick: 'Provide a brief 2-3 sentence overview of the key points.',
      standard: 'Analyze the topic thoroughly, covering main aspects and implications.',
      deep: 'Conduct an exhaustive analysis covering all angles, historical context, current state, future implications, and potential controversies.',
    };

    const expertPrompt = `
You are analyzing the topic: "${topic}"

Research depth: ${depth}
${depthPrompts[depth]}

Structure your analysis as:
1. **Overview**: What is this topic about?
2. **Key Findings**: The most important points (mark each as HIGH/MEDIUM/LOW importance)
3. **Connections**: Related topics worth exploring
4. **Confidence**: How confident are you in this analysis? (0-100%)

Think step by step and be thorough.
    `.trim();

    // ==========================================================================
    // Step 4: Stream the expert agent's response
    // This creates `data-tool-agent` parts in the message that the UI can render
    // ==========================================================================
    await context?.writer?.custom({
      type: 'research-phase',
      data: {
        phase: 'analyzing',
        message: 'Expert agent is thinking...',
        timestamp: new Date().toISOString(),
      },
    });

    const stream = await expertAgent.stream({
      messages: [{ role: 'user', content: expertPrompt }],
    });

    // ==========================================================================
    // Step 5: Pipe the stream to the UI
    // This is the KEY PATTERN - the agent's thinking appears in real-time
    // ==========================================================================
    if (context?.writer) {
      await stream.fullStream.pipeTo(context.writer);
    }

    // Get the final text after streaming completes
    const analysisText = await stream.text;

    // ==========================================================================
    // Step 6: Parse the analysis into structured output
    // ==========================================================================
    await context?.writer?.custom({
      type: 'research-phase',
      data: {
        phase: 'complete',
        timestamp: new Date().toISOString(),
      },
    });

    const { findings, relatedTopics, confidence } = parseAnalysis(analysisText);

    return {
      topic,
      summary: analysisText,
      keyFindings: findings,
      relatedTopics,
      confidence,
    };
  },
});

/**
 * Parse the expert's analysis text into structured data
 */
function parseAnalysis(text: string): {
  findings: Array<{ point: string; importance: 'high' | 'medium' | 'low' }>;
  relatedTopics: string[];
  confidence: number;
} {
  const findings: Array<{ point: string; importance: 'high' | 'medium' | 'low' }> = [];
  const relatedTopics: string[] = [];
  let confidence = 0.7; // Default confidence

  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Extract findings with importance markers
    if (trimmed.includes('HIGH')) {
      const point = trimmed.replace(/\*?\*?HIGH\*?\*?:?/gi, '').replace(/^[-*•\d.)]+\s*/, '').trim();
      if (point.length > 10) findings.push({ point, importance: 'high' });
    } else if (trimmed.includes('MEDIUM')) {
      const point = trimmed.replace(/\*?\*?MEDIUM\*?\*?:?/gi, '').replace(/^[-*•\d.)]+\s*/, '').trim();
      if (point.length > 10) findings.push({ point, importance: 'medium' });
    } else if (trimmed.includes('LOW')) {
      const point = trimmed.replace(/\*?\*?LOW\*?\*?:?/gi, '').replace(/^[-*•\d.)]+\s*/, '').trim();
      if (point.length > 10) findings.push({ point, importance: 'low' });
    }

    // Extract confidence percentage
    const confidenceMatch = trimmed.match(/(\d+)\s*%/);
    if (confidenceMatch && trimmed.toLowerCase().includes('confiden')) {
      confidence = parseInt(confidenceMatch[1], 10) / 100;
    }

    // Extract related topics (look for "Related:" or similar sections)
    if (trimmed.toLowerCase().includes('related') || trimmed.toLowerCase().includes('connection')) {
      const topicMatch = trimmed.match(/:\s*(.+)/);
      if (topicMatch) {
        const topics = topicMatch[1].split(/[,;]/).map(t => t.trim()).filter(t => t.length > 2);
        relatedTopics.push(...topics);
      }
    }
  }

  // If no structured findings found, create generic ones from bullet points
  if (findings.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[-*•]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
        const point = trimmed.replace(/^[-*•\d.)]+\s+/, '');
        if (point.length > 15) {
          findings.push({ point, importance: 'medium' });
        }
      }
    }
  }

  return {
    findings: findings.slice(0, 6),
    relatedTopics: [...new Set(relatedTopics)].slice(0, 4),
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}
