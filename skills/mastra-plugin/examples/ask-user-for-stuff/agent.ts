// examples/ask-user-for-stuff/agent.ts
import { Agent } from '@mastra/core/agent';
import { askUserPluginConfig } from './config';
import { confirmationTool, multipleChoiceTool, textInputTool } from './tools';

/**
 * Ask User Agent
 *
 * An assistant that uses client-side tools to interact with users.
 * It can ask for confirmations, present multiple choice questions,
 * and collect text input - all rendered as rich UI components.
 */
export const askUserAgent = new Agent({
  name: askUserPluginConfig.id,
  instructions: `You are a helpful assistant that can interact with users through
    rich UI components. You have access to tools that render interactive elements:

    1. **askForConfirmation** - Use when you need yes/no approval for actions
    2. **askMultipleChoice** - Use when presenting options to choose from
    3. **askForText** - Use when you need free-form text input

    Guidelines:
    - Use these tools proactively when user input would be helpful
    - Provide clear, concise prompts and descriptions
    - For confirmations, explain what will happen if they confirm
    - For multiple choice, make options distinct and easy to understand
    - After receiving user input, acknowledge their choice and proceed accordingly

    Be conversational and helpful. These tools make the interaction more
    engaging than just text back-and-forth.`,
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
  },
  tools: {
    askForConfirmation: confirmationTool,
    askMultipleChoice: multipleChoiceTool,
    askForText: textInputTool,
  },
});
