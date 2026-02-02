// examples/research-bot/config.ts
import { z } from 'zod';

export const researchBotConfig = {
  id: 'research-bot',
  name: 'Research Bot',
  version: '1.0.0',
} as const;

// =============================================================================
// Deep Research Tool Schemas
// =============================================================================

export const researchInputSchema = z.object({
  topic: z.string().describe('The topic to research'),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard')
    .describe('How thorough the research should be'),
});

export const researchOutputSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  keyFindings: z.array(z.object({
    point: z.string(),
    importance: z.enum(['high', 'medium', 'low']),
  })),
  relatedTopics: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type ResearchInput = z.infer<typeof researchInputSchema>;
export type ResearchOutput = z.infer<typeof researchOutputSchema>;

// =============================================================================
// Expert Agent (nested) Schemas
// =============================================================================

export const expertAnalysisSchema = z.object({
  analysis: z.string(),
  keyInsights: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type ExpertAnalysis = z.infer<typeof expertAnalysisSchema>;
