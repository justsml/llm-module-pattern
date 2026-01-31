# Mastra Plugin Examples

This folder contains example implementations demonstrating key Mastra patterns.

## Examples

### 1. [Trip Planner](./trip-planner/)

A weather-aware trip planning assistant with dynamic UI that updates as the agent works.

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

### 2. [Research Bot](./research-bot/)

A research assistant that spawns specialized sub-agents for deep analysis.

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

### 3. [Ask User for Stuff](./ask-user-for-stuff/)

An order processing workflow that pauses to ask humans for approval on big purchases.

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
import { tripPlannerAgent } from './plugins/trip-planner/agent';
import { researchAgent, analysisAgent } from './plugins/research-bot/agents';
import { orderProcessingWorkflow } from './plugins/ask-user-for-stuff/workflow';

export const mastra = new Mastra({
  agents: {
    tripPlannerAgent,
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
