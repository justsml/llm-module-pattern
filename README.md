# MagicSchool Memory Storage Adapter for Mastra

This adapter allows Mastra's memory system to work with MagicSchool's existing `assistant_threads` and `assistant_thread_messages` tables.

## Features

- **Bidirectional support**: Read existing data and write new data
- **Native bigint IDs**: Uses bigint IDs as strings directly (no UUID conversion needed)
- **Bigint precision**: Keeps IDs as strings to preserve precision for large bigints (> 2^53)
- **Content transformation**: Converts between MagicSchool's content format and Mastra's `MastraMessageContentV2`
- **Soft deletes**: Respects your existing `status` and `deleted` columns

## Usage

### Recommended: MastraCompositeStore

Use `MastraCompositeStore` to route the memory domain to your existing tables, while letting Mastra's default PostgresStore handle everything else (workflows, traces, evals, resources, agents).

```typescript
import { Mastra } from '@mastra/core';
import { MastraCompositeStore } from '@mastra/core/storage';
import { PostgresStore } from '@mastra/pg';
import { createServiceRoleSupabaseClient } from '@magicschool/supabase/clients/server';
import { MagicSchoolMemoryStorage } from '@/features/mastra/storage';

// Default storage for all other domains (workflows, traces, evals, resources, agents)
// Note: Vercel+Supabase integration uses POSTGRES_URL, local dev typically uses DATABASE_URL
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const defaultStorage = new PostgresStore({
  id: 'mastra-default',
  connectionString: connectionString!,
});

// Custom memory storage that uses your existing tables
// Note: Threads must be created via createToolThread before using Mastra memory
const memoryStorage = new MagicSchoolMemoryStorage({
  supabase: createServiceRoleSupabaseClient(),
});

export const mastra = new Mastra({
  storage: new MastraCompositeStore({
    id: 'magicschool-composite',
    default: defaultStorage,  // Handles: workflows, traces, evals, resources, agents
    domains: {
      memory: memoryStorage,  // Handles: threads, messages (your existing tables)
    },
  }),
});
```

This approach:
- **Memory domain** → Your existing `assistant_threads` and `assistant_thread_messages` tables
- **All other domains** → Mastra's standard tables (`mastra_resources`, `mastra_workflow_snapshot`, `mastra_ai_spans`, etc.)

### Basic Setup (Memory Only)

If you only need memory functionality without other Mastra features:

```typescript
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { createServiceRoleSupabaseClient } from '@magicschool/supabase/clients/server';
import { MagicSchoolMemoryStorage } from '@/features/mastra/storage';

const storage = new MagicSchoolMemoryStorage({
  supabase: createServiceRoleSupabaseClient(),
});

const memory = new Memory({
  storage,
  options: {
    lastMessages: 20,
  },
});

const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-4o',
  memory,
});
```

### Generating/Streaming with Memory

```typescript
// Using existing thread by its bigint ID
// ResourceId formats:
//   - "user:{uuid}" for user-scoped working memory
//   - "tool-slug:{uuid}" for tool-scoped working memory (e.g., "raina-chat:uuid")
const response = await agent.generate('Hello!', {
  memory: {
    thread: '12345', // Your existing bigint ID as a string
    resource: 'user:ffbb9d9f-cc94-406a-a746-7455a3c82c85',
  },
});

// Or with tool-scoped resourceId
const response2 = await agent.generate('Hello!', {
  memory: {
    thread: '12345',
    resource: 'raina-chat:ffbb9d9f-cc94-406a-a746-7455a3c82c85',
  },
});

// Creating a new thread
const newThread = await memory.createThread({
  resourceId: 'user:ffbb9d9f-cc94-406a-a746-7455a3c82c85',
  title: 'New Conversation',
  metadata: {
    _toolUuid: 'specific-tool-uuid', // Optional: override default
  },
});

const stream = await agent.stream('Hello!', {
  memory: {
    thread: newThread.id,
    resource: newThread.resourceId,
  },
});
```

## ID Handling

This adapter uses **bigint IDs as strings** directly:

- No UUID conversion needed - Mastra accepts string IDs
- Bigint precision preserved (JavaScript numbers lose precision > 2^53)
- Supabase handles string-to-bigint conversion in queries
- Pass your existing bigint IDs directly as strings

```typescript
// Use existing thread by its bigint ID
const response = await agent.generate('Hello!', {
  memory: {
    thread: '12345678901234567890', // Large bigint as string
    resource: 'user:ffbb9d9f-cc94-406a-a746-7455a3c82c85', // User-scoped format
  },
});
```

## Content Format Transformation

Your messages use this format:
```json
[
  { "type": "text", "text": "Hello" },
  { "type": "tool_inputs", "toolId": "my-tool", "inputs": { "arg": "value" } },
  { "type": "tool_output", "toolId": "my-tool", "output": "Result" }
]
```

Mastra expects:
```json
{
  "format": 2,
  "parts": [
    { "type": "text", "text": "Hello" },
    { "type": "tool-invocation", "toolName": "my-tool", "state": "call", "args": {...} }
  ]
}
```

The adapter handles this transformation automatically in both directions.

## Storage Domains

When using `MastraCompositeStore`, Mastra's storage is split into domains:

| Domain | Tables | Handler |
|--------|--------|---------|
| `memory` | threads, messages, resources | `MagicSchoolMemoryStorage` (threads/messages in your existing tables, resources in `mastra.mastra_resources`) |
| `workflows` | `mastra_workflow_snapshot` | Default `PostgresStore` |
| `observability` | `mastra_ai_spans` | Default `PostgresStore` |
| `scores` | `mastra_scorers` | Default `PostgresStore` |
| `agents` | `mastra_agents` | Default `PostgresStore` |

The `mastra_resources` table (for working memory) is in the `mastra` schema and is accessed directly by `MagicSchoolMemoryStorage`.

## Limitations

1. **No `updatedAt` column**: Your threads table doesn't have `updatedAt`, so `createdAt` is used as fallback.

## Schema Requirements

Your existing tables should have:

```sql
-- assistant_threads
CREATE TABLE assistant_threads (
  id BIGINT PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assistant_data JSONB,
  deleted BOOLEAN DEFAULT FALSE,
  saved BOOLEAN DEFAULT FALSE,
  status row_status DEFAULT 'active',
  tool_uuid UUID NOT NULL,
  tool_customization_id UUID,
  preview_mode TEXT
);

-- assistant_thread_messages
CREATE TABLE assistant_thread_messages (
  id BIGINT PRIMARY KEY,
  assistant_thread_id BIGINT REFERENCES assistant_threads(id),
  user_id UUID NOT NULL,
  role VARCHAR NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status row_status DEFAULT 'active',
  message_payload JSONB
);
```
