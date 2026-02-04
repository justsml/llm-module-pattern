// content-moderation/config.ts
// Plugin manifest for the content moderation plugin

/**
 * Content Moderation Plugin
 *
 * A minimal plugin that provides ONLY processors (no tools, agents, or UI).
 * Demonstrates that plugins can have any subset of features.
 *
 * This plugin provides:
 * - processors: Input/output guardrails for safety
 *
 * @example
 * ```typescript
 * import { layeredSecurity, outputModeration } from '@myorg/content-moderation'
 *
 * const agent = new Agent({
 *   name: 'safe-agent',
 *   inputProcessors: layeredSecurity,
 *   outputProcessors: [outputModeration],
 * })
 * ```
 */
export const contentModerationPlugin = {
  id: 'content-moderation',
  name: 'Content Moderation Plugin',
  version: '1.0.0',

  /**
   * Declares available features.
   * This plugin only provides processors.
   */
  features: {
    tools: false,
    agents: false,
    ui: false,
    processors: true,
    storage: false,
  },

  /**
   * Processor IDs provided by this plugin.
   */
  processorIds: [
    'basicModeration',
    'layeredSecurity',
    'inputModeration',
    'outputModeration',
    'ProfanityFilter',
    'ResponseLengthGuard',
  ] as const,
} as const;

export type ContentModerationPlugin = typeof contentModerationPlugin;
