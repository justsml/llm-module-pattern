// examples/ask-user-for-stuff/tools.ts
import { createTool } from '@mastra/core/tools';
import {
  confirmationInputSchema,
  confirmationOutputSchema,
  multipleChoiceInputSchema,
  multipleChoiceOutputSchema,
  textInputSchema,
  textOutputSchema,
} from './config';

/**
 * Confirmation Tool
 *
 * A client-side tool that renders a confirmation dialog.
 * The UI handles rendering the panel and collecting the user's response.
 *
 * This tool is "client-side" - it doesn't execute server logic,
 * instead it signals to the UI that user input is needed.
 */
export const confirmationTool = createTool({
  id: 'askForConfirmation',
  description: `Ask the user to confirm or cancel an action. Use this when you need
    explicit user approval before proceeding with something important like:
    - Deleting data
    - Making purchases
    - Sending messages
    - Any irreversible action`,
  inputSchema: confirmationInputSchema,
  outputSchema: confirmationOutputSchema,
  // Client-side tools return immediately - the UI handles the interaction
  execute: async ({ input }) => {
    // The tool "executes" by returning its input as a signal to the UI
    // The actual user interaction happens client-side
    // When the user responds, the UI calls addToolResult() with the output
    return {
      // This return is a placeholder - real output comes from client
      confirmed: false,
      timestamp: new Date().toISOString(),
      // Mark as pending client interaction
      __clientSide: true,
      __input: input,
    } as never; // Type assertion since actual output comes from UI
  },
});

/**
 * Multiple Choice Tool
 *
 * A client-side tool that renders a set of options for the user to choose from.
 * Supports both single-select and multi-select modes.
 */
export const multipleChoiceTool = createTool({
  id: 'askMultipleChoice',
  description: `Present the user with multiple options to choose from. Use this when:
    - You need the user to pick from predefined options
    - Gathering preferences (e.g., theme, language, category)
    - Selecting items from a list
    - Any decision with discrete choices`,
  inputSchema: multipleChoiceInputSchema,
  outputSchema: multipleChoiceOutputSchema,
  execute: async ({ input }) => {
    return {
      selected: [],
      timestamp: new Date().toISOString(),
      __clientSide: true,
      __input: input,
    } as never;
  },
});

/**
 * Text Input Tool
 *
 * A client-side tool that collects free-form text from the user.
 */
export const textInputTool = createTool({
  id: 'askForText',
  description: `Ask the user to provide text input. Use this when:
    - You need a name, description, or other free-form text
    - Collecting feedback or comments
    - Getting specific values that can't be predetermined`,
  inputSchema: textInputSchema,
  outputSchema: textOutputSchema,
  execute: async ({ input }) => {
    return {
      value: '',
      timestamp: new Date().toISOString(),
      __clientSide: true,
      __input: input,
    } as never;
  },
});

// Export all tools for easy registration
export const askUserTools = {
  confirmationTool,
  multipleChoiceTool,
  textInputTool,
};
