# Branching Workflow Example

This example demonstrates a workflow with conditional branching based on order type, including human-in-the-loop approval for high-value orders.

## Features

- **Conditional Branching**: Routes orders to different processing steps based on type
- **Suspend/Resume**: High-value priority orders pause for manual approval
- **Progress Events**: Real-time workflow progress via custom events
- **Type-Safe Resume**: Exported steps enable typed `resumeData`

## File Structure

```
branching-workflow/
├── config.ts    # Plugin config and Zod schemas
├── workflow.ts  # Workflow with branching and suspend/resume
├── ui.tsx       # React components for workflow UI
└── README.md    # This file
```

## Workflow Architecture

```
                    ┌─────────────────┐
                    │ validateOrder   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌───────────┐  ┌───────────┐  ┌───────────┐
      │ standard  │  │  express  │  │ priority  │
      │ (5-7 day) │  │ (1-2 day) │  │(same/next)│
      └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
            │              │              │
            │              │        ┌─────┴─────┐
            │              │        │  >$1000?  │
            │              │        └─────┬─────┘
            │              │              │ yes
            │              │        ┌─────┴─────┐
            │              │        │  SUSPEND  │
            │              │        │ (approval)│
            │              │        └─────┬─────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
                    ┌──────┴──────┐
                    │ finalizeOrder│
                    └─────────────┘
```

## Key Patterns

### Branching Logic

```typescript
.branch([
  [
    async ({ inputData }) => inputData.orderType === 'standard',
    standardProcessingStep,
  ],
  [
    async ({ inputData }) => inputData.orderType === 'express',
    expressProcessingStep,
  ],
  [
    async () => true, // Default branch
    priorityProcessingStep,
  ],
])
```

### Suspend/Resume in Steps

```typescript
const priorityProcessingStep = createStep({
  // ...
  resumeSchema: z.object({
    approved: z.boolean(),
    approverNotes: z.string().optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    orderDetails: z.object({ ... }),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    // Check if approval needed
    if (amount > 1000 && !resumeData?.approved) {
      return await suspend({ reason: '...', orderDetails: {...} });
    }

    // Handle approval/rejection
    if (resumeData?.approved === false) {
      return { success: false, ... };
    }

    // Process approved order
    return { success: true, ... };
  },
});
```

### Resuming Workflows

```typescript
// Type-safe resume with exported step
import { priorityProcessingStep } from './workflow';

const result = await run.resume({
  step: priorityProcessingStep,  // Full type safety
  resumeData: {
    approved: true,
    approverNotes: 'Verified by finance',
  },
});
```

## Order Types

| Type | Shipping | Approval Required |
|------|----------|-------------------|
| Standard | 5-7 business days | No |
| Express | 1-2 business days | No |
| Priority | Same/next day | Yes, if amount > $1000 |

## Usage

### Register the Workflow

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { orderProcessingWorkflow } from './plugins/order/workflow';

export const mastra = new Mastra({
  workflows: {
    orderProcessingWorkflow,
  },
});
```

### Execute the Workflow

```typescript
const workflow = mastra.getWorkflow('order-processing-workflow');
const run = await workflow.createRun();

const result = await run.start({
  inputData: {
    orderId: 'ORD-123',
    orderType: 'priority',
    amount: 1500,
    items: [{ sku: 'SKU-1', quantity: 1, name: 'Product' }],
    customerEmail: 'customer@example.com',
  },
});

// Handle suspended workflow
if (result.status === 'suspended') {
  // Show approval UI
  const finalResult = await run.resume({
    step: result.suspended[0],
    resumeData: { approved: true },
  });
}
```

### API Route Example

```typescript
// app/api/workflows/order-processing/route.ts
import { mastra } from '@/mastra';

export async function POST(req: Request) {
  const { inputData } = await req.json();

  const workflow = mastra.getWorkflow('order-processing-workflow');
  const run = await workflow.createRun();
  const result = await run.start({ inputData });

  return Response.json({
    status: result.status,
    output: result.output,
    suspended: result.suspended,
    runId: run.id,
  });
}
```

## Progress Events

The workflow emits custom progress events:

```typescript
await context?.writer?.custom({
  type: 'workflow-progress',
  data: {
    step: 'validate-order',
    status: 'completed',
    message: 'Validation successful',
  },
});
```

These can be consumed in the UI via `data-custom` parts.
