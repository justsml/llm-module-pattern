# Mastra Plugin Examples

This folder contains example implementations demonstrating key Mastra patterns.

## Examples

### 1. [Generative UI](./generative-ui/)

Demonstrates dynamic UI rendering based on tool execution states in a chat interface.

**Key Patterns:**
- Tool state handling (`input-streaming`, `input-available`, `output-available`, `output-error`)
- Custom card components for tool outputs
- Real-time streaming updates
- Weather API integration

**Files:**
- `config.ts` - Schemas and types
- `agent.ts` - Weather agent
- `tools.ts` - Weather tool with wttr.in API
- `ui.tsx` - Chat interface with generative UI

---

### 2. [Nested Agent Streams](./nested-agent-streams/)

Shows how to call agents from within tools and stream their output to the UI.

**Key Patterns:**
- `context.mastra.getAgent()` - Retrieve agents in tools
- `stream.fullStream.pipeTo(context.writer)` - Pipe nested agent output
- `context.writer.custom()` - Emit progress events
- `data-tool-agent` part handling in UI

**Files:**
- `config.ts` - Schemas and types
- `agents.ts` - Research agent + Analysis agent
- `tools.ts` - Deep research tool with nested agent
- `ui.tsx` - UI with agent thinking display

---

### 3. [Branching Workflow](./branching-workflow/)

Implements a workflow with conditional branching and human-in-the-loop approval.

**Key Patterns:**
- `.branch()` for conditional routing
- `suspend()` / `resume()` for human approval
- Type-safe resume with exported steps
- Workflow progress events

**Files:**
- `config.ts` - Order schemas
- `workflow.ts` - Branching workflow with suspend/resume
- `ui.tsx` - Order form, progress display, approval dialog

---

## Common Patterns

### File Structure

Each example follows the plugin organizational pattern:

```
example-name/
├── config.ts    # Plugin config, Zod schemas, types
├── agent.ts     # Agent definitions (if applicable)
├── agents.ts    # Multiple agents (if applicable)
├── tools.ts     # Tool definitions
├── workflow.ts  # Workflow definitions (if applicable)
├── ui.tsx       # React UI components
└── README.md    # Example documentation
```

### Registering with Mastra

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { weatherAgent } from './plugins/weather/agent';
import { researchAgent, analysisAgent } from './plugins/research/agents';
import { orderProcessingWorkflow } from './plugins/order/workflow';

export const mastra = new Mastra({
  agents: {
    weatherAgent,
    researchAgent,
    analysisAgent,
  },
  workflows: {
    orderProcessingWorkflow,
  },
});
```

### Environment Variables

```bash
# Mastra server URL (for frontend)
NEXT_PUBLIC_MASTRA_URL=http://localhost:4111

# Required API keys
OPENAI_API_KEY=sk-...

# Database (optional, defaults to file-based)
DATABASE_URL=file:.mastra/data/app.db
```

## Running Examples

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start Mastra server:**
   ```bash
   pnpm mastra dev
   ```

3. **Start your frontend:**
   ```bash
   pnpm dev
   ```

4. **Navigate to example routes** and interact with the demos.

## Additional Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [AI SDK UI Guide](https://mastra.ai/guides/build-your-ui/ai-sdk-ui)
- [Workflow Suspend/Resume](https://mastra.ai/docs/workflows/suspend-and-resume)
