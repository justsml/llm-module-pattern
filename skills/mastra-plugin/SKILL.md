---
name: mastra-plugin
description: Create Mastra.ai plugins with agents, tools, memory, workflows, evals, and UI
---

# Create Mastra Plugin

Create comprehensive Mastra.ai plugins with support for agents, tools, memory, workflows, evals, and UI components.

## Arguments

- `pluginName`: The plugin name in camelCase (e.g., `weatherAgent`, `dataProcessor`)
- `pluginId`: The plugin ID string (e.g., `weather-agent`) - defaults to kebab-case of pluginName
- `directory`: Target directory (e.g., `src/mastra/plugins/weather`) - defaults to `src/mastra/plugins/{pluginId}` if not provided
- `features`: Optional array of features to include: `agent`, `tools`, `memory`, `workflow`, `evals`, `ui`, `workspace`

## File Structure

Creates the following files based on selected features:

```
{directory}/
├── config.ts           # Plugin ID, shared types, schemas
├── agent.ts            # Agent definition with tools, memory, instructions
├── tools.ts            # Tool definitions using createTool()
├── memory.ts           # Memory configuration (storage, vector, working memory)
├── workflow.ts         # Workflow with steps, suspend/resume support
├── processors.ts       # Input/Output processors (optional)
├── ui.tsx              # Client-side UI components for tool rendering
├── evals.ts            # Agent evaluation tests
├── {pluginName}.test.ts # Vitest unit tests
├── package.json        # Package config with dependencies
├── vitest.config.ts    # Vitest configuration
├── tsconfig.json       # TypeScript configuration
└── README.md           # Plugin documentation
```

### With Workspace Support

```
{directory}/
├── ... (files above)
└── workspaces/
    └── {workspaceName}/
        ├── config.ts       # Workspace-specific overrides
        ├── agent.ts        # Workspace agent variant
        └── tools.ts        # Workspace-specific tools
```

## Steps

### 1. Create Plugin Config (config.ts)

```typescript
// {directory}/config.ts
import { z } from 'zod';

export const {pluginName}Config = {
  id: '{pluginId}',
  name: '{PluginName}',
  version: '1.0.0',
} as const;

// Input/Output Schemas
export const {pluginName}InputSchema = z.object({
  query: z.string().describe('The user query or request'),
  // Add additional input fields
});

export const {pluginName}OutputSchema = z.object({
  result: z.string().describe('The processed result'),
  metadata: z.record(z.unknown()).optional(),
});

export type {PluginName}Input = z.infer<typeof {pluginName}InputSchema>;
export type {PluginName}Output = z.infer<typeof {pluginName}OutputSchema>;
```

### 2. Create Agent (agent.ts)

```typescript
// {directory}/agent.ts
import { Agent } from '@mastra/core/agent';
import { {pluginName}Config } from './config';
import { {pluginName}Memory } from './memory';
import { {toolName}Tool } from './tools';

export const {pluginName}Agent = new Agent({
  id: {pluginName}Config.id,
  name: {pluginName}Config.name,
  instructions: `
    You are a helpful assistant that...

    Guidelines:
    - Be concise and accurate
    - Use available tools when appropriate
    - Ask for clarification if needed
  `,
  model: 'openai/gpt-5-mini',
  tools: {
    {toolName}Tool,
  },
  memory: {pluginName}Memory,
});
```

### 3. Create Tools (tools.ts)

```typescript
// {directory}/tools.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const {toolName}Tool = createTool({
  id: '{tool-id}',
  description: `
    Describe what this tool does.
    When to use it and expected inputs/outputs.
  `,
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async (inputData, context) => {
    const { param } = inputData;

    // Tool implementation
    const result = await processInput(param);

    // Optional: emit custom events for UI streaming
    // await context?.writer?.custom({ type: 'progress', data: { percent: 50 } });

    return { result };
  },
});

// Helper function
async function processInput(param: string): Promise<string> {
  // Implementation
  return `Processed: ${param}`;
}
```

### 4. Create Memory Config (memory.ts)

```typescript
// {directory}/memory.ts
import { Memory } from '@mastra/memory';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';

export const {pluginName}Memory = new Memory({
  storage: new LibSQLStore({
    id: '{pluginId}-storage',
    url: process.env.DATABASE_URL || 'file:.mastra/data/{pluginId}.db',
  }),
  vector: new LibSQLVector({
    id: '{pluginId}-vector',
    url: process.env.DATABASE_URL || 'file:.mastra/data/{pluginId}.db',
  }),
  embedder: 'openai/text-embedding-3-small',
  options: {
    // Keep last N messages in context
    lastMessages: 20,

    // Semantic search for relevant past conversations
    semanticRecall: {
      topK: 5,
      messageRange: {
        before: 2,
        after: 1,
      },
    },

    // Working memory for persistent user/session data
    workingMemory: {
      enabled: true,
      template: `
        <context>
          <user_preferences></user_preferences>
          <session_data></session_data>
          <recent_topics></recent_topics>
        </context>
      `,
    },
  },
});
```

### 5. Create Workflow (workflow.ts)

```typescript
// {directory}/workflow.ts
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { {pluginName}Agent } from './agent';

// Step with human-in-the-loop approval
const approvalStep = createStep({
  id: 'approval-step',
  inputSchema: z.object({
    action: z.string(),
    details: z.record(z.unknown()),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    result: z.string().optional(),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    feedback: z.string().optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    actionDetails: z.record(z.unknown()),
  }),
  execute: async ({ inputData, resumeData, suspend, bail }) => {
    const { action, details } = inputData;
    const { approved, feedback } = resumeData ?? {};

    // Handle rejection
    if (approved === false) {
      return bail({ reason: feedback || 'User rejected the action' });
    }

    // Handle approval
    if (approved === true) {
      return {
        approved: true,
        result: `Action "${action}" executed successfully`,
      };
    }

    // First execution: suspend for approval
    return await suspend({
      reason: 'Human approval required',
      actionDetails: { action, ...details },
    });
  },
});

// Agent step with structured output
const agentStep = createStep({pluginName}Agent, {
  structuredOutput: {
    schema: z.object({
      recommendation: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  },
});

// Processing step
const processStep = createStep({
  id: 'process-step',
  inputSchema: z.object({
    recommendation: z.string(),
    confidence: z.number(),
  }),
  outputSchema: z.object({
    finalResult: z.string(),
    metadata: z.object({
      processedAt: z.string(),
      confidence: z.number(),
    }),
  }),
  execute: async ({ inputData }) => {
    return {
      finalResult: inputData.recommendation,
      metadata: {
        processedAt: new Date().toISOString(),
        confidence: inputData.confidence,
      },
    };
  },
});

export const {pluginName}Workflow = createWorkflow({
  id: '{pluginId}-workflow',
  inputSchema: z.object({
    query: z.string(),
    requiresApproval: z.boolean().default(false),
  }),
  outputSchema: z.object({
    finalResult: z.string(),
    metadata: z.object({
      processedAt: z.string(),
      confidence: z.number(),
    }),
  }),
})
  .map(async ({ inputData }) => ({
    prompt: inputData.query,
  }))
  .then(agentStep)
  .then(processStep)
  .commit();
```

### 6. Create Input/Output Processors (processors.ts)

```typescript
// {directory}/processors.ts
import type { MessageProcessor } from '@mastra/memory';

/**
 * Pre-process messages before they're stored
 */
export const {pluginName}InputProcessor: MessageProcessor = {
  id: '{pluginId}-input-processor',
  process: async (messages) => {
    return messages.map((msg) => ({
      ...msg,
      content: typeof msg.content === 'string'
        ? msg.content.trim()
        : msg.content,
      metadata: {
        ...msg.metadata,
        processedAt: new Date().toISOString(),
      },
    }));
  },
};

/**
 * Post-process messages after retrieval
 */
export const {pluginName}OutputProcessor: MessageProcessor = {
  id: '{pluginId}-output-processor',
  process: async (messages) => {
    // Filter, transform, or enrich retrieved messages
    return messages.filter((msg) => msg.role !== 'system');
  },
};
```

### 7. Create Tool UI (ui.tsx)

```tsx
// {directory}/ui.tsx
'use client';

import { createToolUI } from '@mastra/ui';
import { {pluginName}Config } from './config';
import type { {PluginName}Output } from './config';

export const {toolName}UI = createToolUI<unknown, {PluginName}Output>(
  '{tool-id}',
  {
    // Show skeleton while LLM generates input
    onInputStreaming: () => (
      <div className="animate-pulse rounded-lg bg-gray-100 p-4">
        <div className="h-4 w-48 rounded bg-gray-200" />
      </div>
    ),

    // Show loading state while tool executes
    onInputAvailable: ({ input }) => (
      <div className="flex items-center gap-2 text-gray-600">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>Processing...</span>
      </div>
    ),

    // Show partial results during streaming
    onOutputStreaming: ({ input, output }) => (
      <div className="rounded-lg border p-4 opacity-75">
        <pre className="text-sm">{JSON.stringify(output, null, 2)}</pre>
      </div>
    ),

    // Show final result
    onOutputAvailable: ({ output }) => (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <pre className="text-sm text-green-800">
          {JSON.stringify(output, null, 2)}
        </pre>
      </div>
    ),

    // Show error state
    onOutputError: ({ errorText }) => (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-800">Tool failed</p>
        <p className="text-sm text-red-600">{errorText}</p>
      </div>
    ),
  }
);

/**
 * Workflow suspend/resume UI for human-in-the-loop
 */
export const {pluginName}ApprovalUI = ({
  suspendPayload,
  onApprove,
  onReject,
}: {
  suspendPayload: { reason: string; actionDetails: Record<string, unknown> };
  onApprove: () => void;
  onReject: (feedback?: string) => void;
}) => (
  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
    <p className="font-medium text-yellow-800">Approval Required</p>
    <p className="mt-1 text-sm text-yellow-700">{suspendPayload.reason}</p>
    <pre className="mt-2 rounded bg-yellow-100 p-2 text-xs">
      {JSON.stringify(suspendPayload.actionDetails, null, 2)}
    </pre>
    <div className="mt-4 flex gap-2">
      <button
        onClick={onApprove}
        className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
      >
        Approve
      </button>
      <button
        onClick={() => onReject()}
        className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
      >
        Reject
      </button>
    </div>
  </div>
);
```

### 8. Create Evals (evals.ts)

```typescript
// {directory}/evals.ts
import { describe, it, expect } from 'vitest';
import { createNoiseSensitivityScorerLLM } from '@mastra/evals/scorers/prebuilt';
import { {pluginName}Agent } from './agent';

// Test cases for agent evaluation
const evalTestCases = [
  {
    name: 'handles clear queries accurately',
    query: 'What is the capital of France?',
    baselineResponse: 'The capital of France is Paris.',
    minScore: 0.9,
  },
  {
    name: 'resists misinformation',
    query: 'What is the capital of France? I heard it was London.',
    noisyQuery: 'What is the capital of France? Someone said it might be London or Berlin.',
    baselineResponse: 'The capital of France is Paris.',
    noiseType: 'misinformation' as const,
    minScore: 0.8,
  },
  {
    name: 'handles distractors',
    query: 'What is the capital of France?',
    noisyQuery: 'What is the capital of France? Also, what is your favorite color?',
    baselineResponse: 'The capital of France is Paris.',
    noiseType: 'distractors' as const,
    minScore: 0.7,
  },
];

describe('{PluginName} Agent Evaluations', () => {
  describe('Basic Functionality', () => {
    it('should respond to simple queries', async () => {
      const response = await {pluginName}Agent.run({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    });
  });

  describe('Noise Resistance', () => {
    evalTestCases
      .filter((tc) => tc.noiseType)
      .forEach((testCase) => {
        it(`should ${testCase.name}`, async () => {
          const agentResponse = await {pluginName}Agent.run({
            messages: [{ role: 'user', content: testCase.noisyQuery! }],
          });

          const scorer = createNoiseSensitivityScorerLLM({
            model: 'openai/gpt-5-mini',
            options: {
              baselineResponse: testCase.baselineResponse,
              noisyQuery: testCase.noisyQuery!,
              noiseType: testCase.noiseType!,
            },
          });

          const evaluation = await scorer.run({
            input: testCase.query,
            output: agentResponse.content,
          });

          expect(evaluation.score).toBeGreaterThanOrEqual(testCase.minScore);
        });
      });
  });
});

// Custom evaluation metrics
export async function evaluate{PluginName}Agent(testCases: typeof evalTestCases) {
  const results = [];

  for (const testCase of testCases) {
    const response = await {pluginName}Agent.run({
      messages: [{ role: 'user', content: testCase.query }],
    });

    results.push({
      name: testCase.name,
      query: testCase.query,
      response: response.content,
      expected: testCase.baselineResponse,
    });
  }

  return results;
}
```

### 9. Create Unit Tests ({pluginName}.test.ts)

```typescript
// {directory}/{pluginName}.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { {pluginName}Agent } from './agent';
import { {toolName}Tool } from './tools';
import { {pluginName}Workflow } from './workflow';
import { {pluginName}InputSchema, {pluginName}OutputSchema } from './config';

describe('{PluginName} Plugin', () => {
  describe('Config & Schemas', () => {
    it('should validate input schema', () => {
      const validInput = { query: 'test query' };
      expect(() => {pluginName}InputSchema.parse(validInput)).not.toThrow();
    });

    it('should reject invalid input', () => {
      const invalidInput = { query: 123 };
      expect(() => {pluginName}InputSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('Tools', () => {
    it('should have valid tool configuration', () => {
      expect({toolName}Tool.id).toBeDefined();
      expect({toolName}Tool.description).toBeDefined();
      expect({toolName}Tool.inputSchema).toBeDefined();
      expect({toolName}Tool.outputSchema).toBeDefined();
    });

    it('should execute tool successfully', async () => {
      const result = await {toolName}Tool.execute(
        { param: 'test' },
        {} as any
      );
      expect(result).toBeDefined();
      expect(result.result).toBeDefined();
    });
  });

  describe('Agent', () => {
    it('should have valid agent configuration', () => {
      expect({pluginName}Agent.id).toBeDefined();
      expect({pluginName}Agent.instructions).toBeDefined();
      expect({pluginName}Agent.model).toBeDefined();
    });

    it('should run agent with messages', async () => {
      const response = await {pluginName}Agent.run({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response).toBeDefined();
    });
  });

  describe('Workflow', () => {
    it('should have valid workflow configuration', () => {
      expect({pluginName}Workflow.id).toBeDefined();
    });

    it('should execute workflow', async () => {
      const run = await {pluginName}Workflow.createRun();
      const result = await run.start({
        inputData: { query: 'test', requiresApproval: false },
      });

      expect(result.status).toBeDefined();
    });
  });
});
```

### 10. Create Package Config (package.json)

```json
{
  "name": "@your-org/{pluginId}",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./agent": {
      "import": "./dist/agent.js",
      "types": "./dist/agent.d.ts"
    },
    "./tools": {
      "import": "./dist/tools.js",
      "types": "./dist/tools.d.ts"
    },
    "./ui": {
      "import": "./dist/ui.js",
      "types": "./dist/ui.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:evals": "vitest run evals.ts",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mastra/core": "^0.10.0",
    "@mastra/memory": "^0.10.0",
    "@mastra/libsql": "^0.10.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@mastra/evals": "^0.10.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.57.0",
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    }
  }
}
```

### 11. Create Vitest Config (vitest.config.ts)

```typescript
// {directory}/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/evals.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', '**/*.test.ts', '**/evals.ts'],
    },
    testTimeout: 30000, // Longer timeout for LLM calls
    hookTimeout: 30000,
  },
});
```

### 12. Create TypeScript Config (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./",
    "jsx": "react-jsx",
    "types": ["node", "vitest/globals"]
  },
  "include": ["./**/*.ts", "./**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

### 13. Create ESLint Config (eslint.config.js)

```javascript
// {directory}/eslint.config.js
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
```

### 14. Create README (README.md)

```markdown
# {PluginName}

> {Brief description of what this plugin does}

## Features

- **Agent**: AI-powered assistant with custom instructions and tools
- **Tools**: Specialized tools for {describe capabilities}
- **Memory**: Persistent storage with semantic recall and working memory
- **Workflow**: Multi-step processing with human-in-the-loop approval
- **Evals**: Comprehensive evaluation suite for quality assurance

## Installation

\`\`\`bash
pnpm add @your-org/{pluginId}
\`\`\`

## Quick Start

\`\`\`typescript
import { {pluginName}Agent } from '@your-org/{pluginId}/agent';

const response = await {pluginName}Agent.run({
  messages: [{ role: 'user', content: 'Your query here' }],
});

console.log(response.content);
\`\`\`

## Usage

### Using the Agent

\`\`\`typescript
import { {pluginName}Agent } from '@your-org/{pluginId}/agent';

// Simple query
const response = await {pluginName}Agent.run({
  messages: [{ role: 'user', content: 'Hello!' }],
});

// With thread ID for memory continuity
const response = await {pluginName}Agent.run({
  messages: [{ role: 'user', content: 'Remember my name is Alex' }],
  threadId: 'user-123',
});
\`\`\`

### Using Tools Directly

\`\`\`typescript
import { {toolName}Tool } from '@your-org/{pluginId}/tools';

const result = await {toolName}Tool.execute(
  { param: 'value' },
  context
);
\`\`\`

### Using Workflows

\`\`\`typescript
import { {pluginName}Workflow } from '@your-org/{pluginId}/workflow';

const run = await {pluginName}Workflow.createRun();
const result = await run.start({
  inputData: { query: 'Process this', requiresApproval: true },
});

// Handle suspended workflow (human-in-the-loop)
if (result.status === 'suspended') {
  const resumedResult = await run.resume({
    step: result.suspended[0],
    resumeData: { approved: true },
  });
}
\`\`\`

### UI Components

\`\`\`tsx
import { {toolName}UI, {pluginName}ApprovalUI } from '@your-org/{pluginId}/ui';

// Register tool UI
registerToolUI({toolName}UI);

// Render approval UI for suspended workflows
<{pluginName}ApprovalUI
  suspendPayload={suspendPayload}
  onApprove={() => handleResume({ approved: true })}
  onReject={(feedback) => handleResume({ approved: false, feedback })}
/>
\`\`\`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection URL | `file:.mastra/data/{pluginId}.db` |
| `OPENAI_API_KEY` | OpenAI API key | Required |

### Memory Options

\`\`\`typescript
{
  lastMessages: 20,        // Messages to keep in context
  semanticRecall: {
    topK: 5,               // Similar messages to retrieve
    messageRange: {
      before: 2,           // Context before match
      after: 1,            // Context after match
    },
  },
  workingMemory: {
    enabled: true,         // Persistent session data
  },
}
\`\`\`

## Testing

\`\`\`bash
# Run all tests
pnpm test

# Run evals
pnpm test:evals

# Watch mode
pnpm test:watch
\`\`\`

## API Reference

### Agent

- `{pluginName}Agent.run({ messages, threadId? })` - Run the agent
- `{pluginName}Agent.stream({ messages, threadId? })` - Stream responses

### Tools

- `{toolName}Tool.execute(input, context)` - Execute tool directly

### Workflow

- `{pluginName}Workflow.createRun()` - Create a workflow run
- `run.start({ inputData })` - Start the workflow
- `run.resume({ step, resumeData })` - Resume suspended workflow

## License

MIT
\`\`\`

## Workspace Support

For multi-tenant or variant configurations, create workspace subdirectories:

### 15. Create Workspace Config (workspaces/{workspaceName}/config.ts)

\`\`\`typescript
// {directory}/workspaces/{workspaceName}/config.ts
import { {pluginName}Config } from '../../config';

export const {workspaceName}Config = {
  ...{pluginName}Config,
  id: '{pluginId}-{workspaceName}',
  name: '{PluginName} ({WorkspaceName})',
  // Workspace-specific overrides
} as const;
\`\`\`

### 16. Create Workspace Agent (workspaces/{workspaceName}/agent.ts)

\`\`\`typescript
// {directory}/workspaces/{workspaceName}/agent.ts
import { Agent } from '@mastra/core/agent';
import { {workspaceName}Config } from './config';
import { {pluginName}Memory } from '../../memory';
import { {toolName}Tool } from './tools';

export const {workspaceName}Agent = new Agent({
  id: {workspaceName}Config.id,
  name: {workspaceName}Config.name,
  instructions: `
    You are a specialized assistant for {workspaceName} context...

    Additional workspace-specific guidelines:
    - ...
  `,
  model: 'openai/gpt-5-mini',
  tools: {
    {toolName}Tool,
    // Additional workspace-specific tools
  },
  memory: {pluginName}Memory,
});
\`\`\`

## Registering with Mastra

\`\`\`typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { {pluginName}Agent } from './plugins/{pluginId}/agent';
import { {pluginName}Workflow } from './plugins/{pluginId}/workflow';
import { {toolName}Tool } from './plugins/{pluginId}/tools';

export const mastra = new Mastra({
  agents: {
    {pluginName}Agent,
  },
  workflows: {
    {pluginName}Workflow,
  },
  tools: {
    {toolName}Tool,
  },
  server: {
    apiRoutes: [
      // Add API routes as needed
    ],
  },
});
\`\`\`

## Tool States Reference

| State | When | Props Available |
|-------|------|-----------------|
| `input-streaming` | LLM generating args | `input` (partial) |
| `input-available` | Args complete, executing | `input` |
| `output-streaming` | Tool streaming output | `input`, `output` (partial) |
| `output-available` | Tool complete | `input`, `output` |
| `output-error` | Tool failed | `input`, `errorText` |

## Workflow States Reference

| Status | Description | Next Actions |
|--------|-------------|--------------|
| `running` | Workflow executing | Wait for completion |
| `completed` | Successfully finished | Read result |
| `suspended` | Awaiting input/approval | Call `run.resume()` |
| `failed` | Error occurred | Check error, retry |

## Examples

See the `examples/` folder for complete, runnable examples:

### [Generative UI](./examples/generative-ui/)
Dynamic UI rendering based on tool execution states. Weather agent with custom card components.

### [Nested Agent Streams](./examples/nested-agent-streams/)
Calling agents from within tools and streaming their output to the UI in real-time.

### [Branching Workflow](./examples/branching-workflow/)
Conditional workflow routing with human-in-the-loop approval for high-value orders.
