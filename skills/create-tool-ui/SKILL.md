---
name: create-tool-ui
description: Create AI SDK Tool UI components for chat tool rendering
---

# Create Tool UI

Create UI components for rendering AI SDK tool calls in chat interfaces using the `createToolUI` factory.

## Arguments

- `toolName`: The tool name in camelCase (e.g., `rubricFeedback`, `webSearch`)
- `toolId`: The tool ID string (e.g., `generateRubricFeedback`) - defaults to toolName if not provided
- `directory`: Target directory (e.g., `src/features/tools/rubric`) - will prompt if not provided

## File Structure

Creates the following files:

```
{directory}/
├── config.ts   # Tool ID, Input/Output types (if needed)
├── tool.ts    # `createTool()`, definition (server-side)
└── ui.tsx     # `createToolUI()`, Client-side UI components
```

## Steps

### 1. Create Tool Config (config.ts)

```typescript
// {directory}/config.ts
export const {toolName}ToolConfig = {
  id: '{toolId}',
} as const;
```

### 2. Create Tool UI (ui.tsx)

```tsx
// {directory}/ui.tsx
'use client';

import { createToolUI } from '@magicschool/business-logic/tools/ui';
import { {toolName}ToolConfig } from './config';
// import type { {ToolName}Input, {ToolName}Output } from './schema';

export const {toolName}UI = createToolUI(
  {toolName}ToolConfig.id,
  {
    // Optional: Show skeleton while LLM generates input
    // onInputStreaming: () => (
    //   <div className="animate-pulse rounded-lg bg-muted p-4">
    //     <div className="h-4 w-48 rounded bg-muted-foreground/20" />
    //   </div>
    // ),

    // Optional: Show loading state while tool executes
    // onInputAvailable: ({ input }) => (
    //   <div className="flex items-center gap-2">
    //     <Spinner size="sm" />
    //     <span>Processing...</span>
    //   </div>
    // ),

    // Optional: Show partial results during streaming output
    // onOutputStreaming: ({ input, output }) => (
    //   <{ToolName}Card data={output} isLoading />
    // ),

    // Required: Show final result
    onOutputAvailable: ({ output }) => (
      <div>
        <pre>{JSON.stringify(output, null, 2)}</pre>
      </div>
    ),

    // Optional: Show error state
    // onOutputError: ({ errorText }) => (
    //   <Alert variant="destructive">
    //     <AlertCircle className="h-4 w-4" />
    //     <AlertTitle>Tool failed</AlertTitle>
    //     <AlertDescription>{errorText}</AlertDescription>
    //   </Alert>
    // ),
  }
);
```

### 3. Register the UI

Add to the app's tool UI registry (typically in a client-side provider):

```tsx
// app/providers/ToolUIRegistry.tsx (or similar)
'use client';

import { registerToolUI } from '@magicschool/business-logic/tools/ui';
import { {toolName}UI } from '@/features/tools/{directory}/ui';

registerToolUI({toolName}UI);
```

Or batch register multiple:

```tsx
import { registerToolUIs } from '@magicschool/business-logic/tools/ui';

registerToolUIs([
  {toolName}UI,
  // ... other tool UIs
]);
```

## Tool States Reference

| State | When | Props Available |
|-------|------|-----------------|
| `input-streaming` | LLM generating args | `input` (partial) |
| `input-available` | Args complete, executing | `input` |
| `output-streaming` | Tool streaming output | `input`, `output` (partial) |
| `output-available` | Tool complete | `input`, `output` |
| `output-error` | Tool failed | `input`, `errorText` |

## Base Props (Available in All States)

```typescript
interface ToolUIBaseProps {
  toolCallId: string;    // Unique call ID
  toolName: string;      // Tool identifier
  isStreaming: boolean;  // Parent message streaming
  isLastMessage: boolean; // Most recent message
}
```

## Type Safety

For full type safety, define input/output schemas:

```typescript
// {directory}/config.ts
import { z } from 'zod';

export const {toolName}InputSchema = z.object({
  // Define input fields
});

export const {toolName}OutputSchema = z.object({
  // Define output fields
});

export type {ToolName}Input = z.infer<typeof {toolName}InputSchema>;
export type {ToolName}Output = z.infer<typeof {toolName}OutputSchema>;
```

Then use in createToolUI:

```tsx
export const {toolName}UI = createToolUI<{ToolName}Input, {ToolName}Output>(
  {toolName}ToolConfig.id,
  { /* ... */ }
);
```

## Server-Side Tool Definition

The config.ts file enables the server-side tool to use the same ID:

```typescript
// {directory}/tool.ts (server)
import { {toolName}ToolConfig } from './config';

export const {toolName}Tool = createTool({
  id: {toolName}ToolConfig.id,
  // ... tool definition
});
```
