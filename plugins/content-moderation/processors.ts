// examples/content-moderation/processors.ts
import type { Processor, MastraDBMessage, CoreMessage, RequestContext } from '@mastra/core';
import {
  ModerationProcessor,
  PromptInjectionDetector,
  PIIDetector,
  UnicodeNormalizer,
} from '@mastra/core/processors';

/**
 * Example 1: Basic Moderation
 *
 * Detects and blocks harmful content across specified categories.
 */
export const basicModeration = new ModerationProcessor({
  model: 'openai/gpt-4.1-nano',
  categories: ['hate', 'harassment', 'violence'],
  threshold: 0.7,
  strategy: 'block', // 'block' | 'rewrite'
});

/**
 * Example 2: Layered Security
 *
 * Chain multiple processors for defense-in-depth:
 * 1. UnicodeNormalizer - Prevents unicode smuggling attacks
 * 2. PromptInjectionDetector - Blocks jailbreak attempts
 * 3. PIIDetector - Redacts sensitive personal information
 * 4. ModerationProcessor - Filters harmful content
 */
export const layeredSecurity = [
  new UnicodeNormalizer(),
  new PromptInjectionDetector(),
  new PIIDetector(),
  new ModerationProcessor({
    categories: ['hate', 'harassment', 'violence', 'self-harm'],
    threshold: 0.5,
    strategy: 'block',
  }),
];

/**
 * Example 3: Input + Output Moderation
 *
 * Separate processors for input and output.
 * Input blocks, output rewrites for better UX.
 */
export const inputModeration = new ModerationProcessor({
  categories: ['hate', 'harassment', 'violence'],
  threshold: 0.7,
  strategy: 'block',
});

export const outputModeration = new ModerationProcessor({
  categories: ['hate', 'harassment', 'violence'],
  threshold: 0.7,
  strategy: 'rewrite', // Rewrite instead of block for better UX
});

/**
 * Example 4: Custom Input Processor
 *
 * Implement your own validation logic.
 */
export class ProfanityFilter implements Processor {
  id = 'profanity-filter';

  private blockedWords = ['badword1', 'badword2']; // Replace with actual list

  async processInput({
    messages,
    abort,
  }: {
    messages: MastraDBMessage[];
    systemMessages: CoreMessage[];
    context: RequestContext;
    abort: (reason: string) => void;
  }): Promise<MastraDBMessage[]> {
    const lastUserMessage = messages.findLast(m => m.role === 'user');

    if (lastUserMessage) {
      const content =
        typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : JSON.stringify(lastUserMessage.content);

      const containsProfanity = this.blockedWords.some(word =>
        content.toLowerCase().includes(word.toLowerCase())
      );

      if (containsProfanity) {
        abort('Message contains prohibited content');
      }
    }

    return messages;
  }
}

/**
 * Example 5: Custom Output Guardrail
 *
 * Modify or block agent responses based on custom logic.
 */
export class ResponseLengthGuard implements Processor {
  id = 'response-length-guard';

  constructor(private maxLength: number = 1000) {}

  async processOutputResult({
    messages,
    abort,
  }: {
    messages: MastraDBMessage[];
    abort: (reason: string) => void;
  }): Promise<MastraDBMessage[]> {
    return messages.map(msg => {
      if (msg.role === 'assistant') {
        const content =
          typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

        if (content.length > this.maxLength) {
          // Option 1: Truncate
          return {
            ...msg,
            content: content.slice(0, this.maxLength) + '...',
          };

          // Option 2: Block entirely (uncomment to use)
          // abort('Response exceeded maximum length');
        }
      }
      return msg;
    });
  }
}
