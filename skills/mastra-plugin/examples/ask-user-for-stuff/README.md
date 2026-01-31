# Ask User for Stuff

An agent with client-side tools that render rich interactive UI for collecting user input. Features confirmation dialogs, multiple choice selectors, and text input panels.

## Features

- **Confirmation Tool**: Yes/no approval dialogs with customizable variants (default, warning, danger)
- **Multiple Choice Tool**: Option selectors with single or multi-select support
- **Text Input Tool**: Free-form text collection with single-line or multiline modes
- **Client-Side Rendering**: Tools render as interactive UI components, not server-executed

## File Structure

```
ask-user-for-stuff/
├── config.ts    # Tool schemas (confirmation, multiple choice, text input)
├── agent.ts     # Agent with client-side tools
├── tools.ts     # Tool definitions
├── ui.tsx       # React components for each tool type
└── README.md    # This file
```

## How Client-Side Tools Work

Unlike server-executed tools, client-side tools render UI and wait for user interaction:

```
1. Agent calls tool with input (e.g., confirmation title/message)
2. Tool "executes" immediately, returning a placeholder
3. UI detects tool state 'input-available' and renders interactive component
4. User interacts with the component (clicks button, selects option)
5. UI calls addToolResult() with the user's response
6. Agent receives the result and continues
```

## Key Patterns

### Tool Definition

```typescript
export const confirmationTool = createTool({
  id: 'askForConfirmation',
  description: 'Ask the user to confirm or cancel an action',
  inputSchema: z.object({
    title: z.string(),
    message: z.string(),
    variant: z.enum(['default', 'warning', 'danger']).default('default'),
  }),
  outputSchema: z.object({
    confirmed: z.boolean(),
    timestamp: z.string(),
  }),
  // Client-side tools return immediately
  execute: async ({ input }) => {
    return { confirmed: false, timestamp: new Date().toISOString() };
  },
});
```

### UI Rendering

```tsx
if (part.type === 'tool-askForConfirmation') {
  const toolInput = part.input as ConfirmationInput;

  switch (part.state) {
    case 'input-available':
      // Render interactive component
      return (
        <ConfirmationPanel
          input={toolInput}
          onRespond={(confirmed) => {
            addToolResult({
              toolCallId: part.toolCallId,
              result: { confirmed, timestamp: new Date().toISOString() },
            });
          }}
        />
      );

    case 'output-available':
      // Render completed state
      return <CompletedConfirmation confirmed={part.output.confirmed} />;
  }
}
```

### Using addToolResult

The `addToolResult` function from `useChat` sends user input back to the agent:

```typescript
const { messages, sendMessage, addToolResult } = useChat({
  transport: new DefaultChatTransport({
    api: `${MASTRA_BASE_URL}/api/agents/ask-user-for-stuff/chat`,
  }),
  maxSteps: 5, // Allow multiple tool interactions
});

// When user clicks "Confirm"
addToolResult({
  toolCallId: part.toolCallId,
  result: {
    confirmed: true,
    timestamp: new Date().toISOString(),
  },
});
```

## Tool Types

### Confirmation Tool

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | Dialog title |
| `message` | string | Explanation of what needs confirming |
| `confirmLabel` | string | Confirm button text (default: "Confirm") |
| `cancelLabel` | string | Cancel button text (default: "Cancel") |
| `variant` | enum | Visual style: `default`, `warning`, `danger` |

### Multiple Choice Tool

| Property | Type | Description |
|----------|------|-------------|
| `question` | string | The question to ask |
| `options` | array | Available choices with `id`, `label`, `description` |
| `allowMultiple` | boolean | Enable multi-select (default: false) |

### Text Input Tool

| Property | Type | Description |
|----------|------|-------------|
| `prompt` | string | Label/prompt for the input |
| `placeholder` | string | Placeholder text |
| `multiline` | boolean | Use textarea instead of input |
| `required` | boolean | Whether input is required |

## Usage

### Register the Agent

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { askUserAgent } from './plugins/ask-user-for-stuff/agent';

export const mastra = new Mastra({
  agents: {
    askUserAgent,
  },
});
```

### Use in Your App

```tsx
import { AskUserForStuffDemo } from './plugins/ask-user-for-stuff/ui';

export default function InteractivePage() {
  return <AskUserForStuffDemo />;
}
```

## Example Interactions

**User:** "Help me pick a color theme"

**Agent:** Uses `askMultipleChoice` tool with options like:
- Light Mode
- Dark Mode
- System Default

**User:** Clicks "Dark Mode"

**Agent:** "Great choice! I've noted your preference for Dark Mode."

---

**User:** "I want to delete my account"

**Agent:** Uses `askForConfirmation` tool with `variant: 'danger'`:
- Title: "Delete Account?"
- Message: "This will permanently delete all your data..."

**User:** Clicks "Cancel"

**Agent:** "No problem, your account remains active."
