// examples/nested-agent-streams/config.ts
import { z } from 'zod';

export const researchPluginConfig = {
  id: 'research-plugin',
  name: 'Research Plugin',
  version: '1.0.0',
} as const;

// Research Tool Schemas
export const researchInputSchema = z.object({
  topic: z.string().describe('The topic to research'),
  depth: z.enum(['brief', 'detailed', 'comprehensive']).default('detailed'),
});

export const researchOutputSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  sources: z.array(z.string()).optional(),
});

export type ResearchInput = z.infer<typeof researchInputSchema>;
export type ResearchOutput = z.infer<typeof researchOutputSchema>;

// Analysis Agent Schemas
export const analysisInputSchema = z.object({
  content: z.string().describe('Content to analyze'),
});

export const analysisOutputSchema = z.object({
  analysis: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  confidence: z.number().min(0).max(1),
});

export type AnalysisInput = z.infer<typeof analysisInputSchema>;
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;
