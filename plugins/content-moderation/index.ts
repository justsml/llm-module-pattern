// content-moderation/index.ts
// Main entry point for the content moderation plugin package

/**
 * Content Moderation Plugin
 *
 * A minimal plugin package that provides ONLY processors.
 * Demonstrates that plugins can have any subset of features.
 *
 * @example
 * ```typescript
 * // Import the plugin manifest
 * import contentModerationPlugin from '@myorg/content-moderation'
 *
 * // Import specific processors
 * import { layeredSecurity, outputModeration } from '@myorg/content-moderation'
 *
 * // Apply to agent
 * const agent = new Agent({
 *   inputProcessors: layeredSecurity,
 *   outputProcessors: [outputModeration],
 * })
 * ```
 */

// Plugin manifest (required)
export {
  contentModerationPlugin,
  type ContentModerationPlugin,
} from './config';

// Processors
export {
  // Pre-built processors
  basicModeration,
  layeredSecurity,
  inputModeration,
  outputModeration,
  // Custom processor classes
  ProfanityFilter,
  ResponseLengthGuard,
} from './processors';

// Default export: the plugin manifest
export { contentModerationPlugin as default } from './config';
