// examples/branching-workflow/workflow.ts
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import {
  orderInputSchema,
  orderOutputSchema,
  processingResultSchema,
  type OrderInput,
} from './config';

/**
 * Step 1: Validate Order
 *
 * Validates the order data before processing.
 * This step runs for all order types.
 */
const validateOrderStep = createStep({
  id: 'validate-order',
  inputSchema: orderInputSchema,
  outputSchema: z.object({
    isValid: z.boolean(),
    validatedOrder: orderInputSchema,
    validationErrors: z.array(z.string()),
  }),
  execute: async ({ inputData, context }) => {
    const errors: string[] = [];

    // Validate order amount
    if (inputData.amount <= 0) {
      errors.push('Order amount must be positive');
    }

    // Validate items
    if (inputData.items.length === 0) {
      errors.push('Order must contain at least one item');
    }

    // Emit progress
    await context?.writer?.custom({
      type: 'workflow-progress',
      data: {
        step: 'validate-order',
        status: errors.length === 0 ? 'passed' : 'failed',
        message: `Validation ${errors.length === 0 ? 'successful' : 'failed'}`,
      },
    });

    return {
      isValid: errors.length === 0,
      validatedOrder: inputData,
      validationErrors: errors,
    };
  },
});

/**
 * Standard Processing Workflow
 *
 * Handles standard orders with 5-7 business day shipping.
 */
const standardProcessingStep = createStep({
  id: 'standard-processing',
  inputSchema: z.object({
    isValid: z.boolean(),
    validatedOrder: orderInputSchema,
    validationErrors: z.array(z.string()),
  }),
  outputSchema: processingResultSchema,
  execute: async ({ inputData, context }) => {
    const { validatedOrder } = inputData;

    // Emit progress
    await context?.writer?.custom({
      type: 'workflow-progress',
      data: {
        step: 'standard-processing',
        status: 'processing',
        message: 'Processing standard order...',
      },
    });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Generate tracking number
    const trackingNumber = `STD-${validatedOrder.orderId}-${Date.now()}`;

    await context?.writer?.custom({
      type: 'workflow-progress',
      data: {
        step: 'standard-processing',
        status: 'completed',
        message: `Standard processing complete. Tracking: ${trackingNumber}`,
      },
    });

    return {
      success: true,
      message: 'Standard order processed successfully',
      data: {
        trackingNumber,
        shippingEstimate: '5-7 business days',
        processingTime: 500,
      },
    };
  },
});

/**
 * Express Processing Workflow
 *
 * Handles express orders with 1-2 business day shipping.
 */
const expressProcessingStep = createStep({
  id: 'express-processing',
  inputSchema: z.object({
    isValid: z.boolean(),
    validatedOrder: orderInputSchema,
    validationErrors: z.array(z.string()),
  }),
  outputSchema: processingResultSchema,
  execute: async ({ inputData, context }) => {
    const { validatedOrder } = inputData;

    await context?.writer?.custom({
      type: 'workflow-progress',
      data: {
        step: 'express-processing',
        status: 'processing',
        message: 'Processing express order with priority...',
      },
    });

    // Express processing is faster
    await new Promise((resolve) => setTimeout(resolve, 200));

    const trackingNumber = `EXP-${validatedOrder.orderId}-${Date.now()}`;

    await context?.writer?.custom({
      type: 'workflow-progress',
      data: {
        step: 'express-processing',
        status: 'completed',
        message: `Express processing complete. Tracking: ${trackingNumber}`,
      },
    });

    return {
      success: true,
      message: 'Express order processed successfully',
      data: {
        trackingNumber,
        shippingEstimate: '1-2 business days',
        processingTime: 200,
      },
    };
  },
});

/**
 * Priority Processing Workflow
 *
 * Handles priority orders with same-day or next-day shipping.
 * Requires additional verification.
 */
const priorityProcessingStep = createStep({
  id: 'priority-processing',
  inputSchema: z.object({
    isValid: z.boolean(),
    validatedOrder: orderInputSchema,
    validationErrors: z.array(z.string()),
  }),
  outputSchema: processingResultSchema,
  resumeSchema: z.object({
    approved: z.boolean(),
    approverNotes: z.string().optional(),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    orderDetails: z.object({
      orderId: z.string(),
      amount: z.number(),
      customerEmail: z.string(),
    }),
  }),
  execute: async ({ inputData, resumeData, suspend, context }) => {
    const { validatedOrder } = inputData;
    const { approved, approverNotes } = resumeData ?? {};

    // Priority orders over $1000 require manual approval
    if (validatedOrder.amount > 1000 && approved === undefined) {
      await context?.writer?.custom({
        type: 'workflow-progress',
        data: {
          step: 'priority-processing',
          status: 'suspended',
          message: 'High-value priority order requires approval',
        },
      });

      return await suspend({
        reason: 'High-value priority order requires manual approval',
        orderDetails: {
          orderId: validatedOrder.orderId,
          amount: validatedOrder.amount,
          customerEmail: validatedOrder.customerEmail,
        },
      });
    }

    // Handle rejection
    if (approved === false) {
      return {
        success: false,
        message: `Order rejected: ${approverNotes || 'No reason provided'}`,
        data: { processingTime: 0 },
      };
    }

    await context?.writer?.custom({
      type: 'workflow-progress',
      data: {
        step: 'priority-processing',
        status: 'processing',
        message: 'Processing priority order...',
      },
    });

    // Priority processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    const trackingNumber = `PRI-${validatedOrder.orderId}-${Date.now()}`;

    await context?.writer?.custom({
      type: 'workflow-progress',
      data: {
        step: 'priority-processing',
        status: 'completed',
        message: `Priority processing complete. Tracking: ${trackingNumber}`,
      },
    });

    return {
      success: true,
      message: 'Priority order processed successfully',
      data: {
        trackingNumber,
        shippingEstimate: 'Same day or next business day',
        processingTime: 100,
        approverNotes,
      },
    };
  },
});

/**
 * Finalize Order Step
 *
 * Formats the final output from any processing branch.
 */
const finalizeOrderStep = createStep({
  id: 'finalize-order',
  inputSchema: processingResultSchema,
  outputSchema: orderOutputSchema,
  execute: async ({ inputData, context }) => {
    const { success, message, data } = inputData;

    await context?.writer?.custom({
      type: 'workflow-progress',
      data: {
        step: 'finalize-order',
        status: 'completed',
        message: 'Order finalized',
      },
    });

    // Extract orderId from tracking number
    const trackingNumber = data?.trackingNumber as string | undefined;
    const orderId = trackingNumber?.split('-')[1] || 'unknown';

    return {
      orderId,
      status: success ? 'processed' : 'failed',
      shippingEstimate: (data?.shippingEstimate as string) || 'Unknown',
      trackingNumber,
      processingTime: (data?.processingTime as number) || 0,
      notes: [message, data?.approverNotes].filter(Boolean) as string[],
    };
  },
});

/**
 * Order Processing Workflow
 *
 * Main workflow with branching based on order type:
 * - Standard: 5-7 day shipping
 * - Express: 1-2 day shipping
 * - Priority: Same/next day, requires approval for high-value orders
 */
export const orderProcessingWorkflow = createWorkflow({
  id: 'order-processing-workflow',
  inputSchema: orderInputSchema,
  outputSchema: orderOutputSchema,
})
  // Step 1: Validate all orders
  .then(validateOrderStep)

  // Step 2: Branch based on order type
  .branch([
    // Standard orders
    [
      async ({ inputData }) => {
        const order = inputData as unknown as { validatedOrder: OrderInput };
        return order.validatedOrder.orderType === 'standard';
      },
      standardProcessingStep,
    ],
    // Express orders
    [
      async ({ inputData }) => {
        const order = inputData as unknown as { validatedOrder: OrderInput };
        return order.validatedOrder.orderType === 'express';
      },
      expressProcessingStep,
    ],
    // Priority orders (default)
    [
      async () => true,
      priorityProcessingStep,
    ],
  ])

  // Step 3: Finalize all orders
  .then(finalizeOrderStep)

  .commit();

// Export steps for type-safe resume
export { validateOrderStep, standardProcessingStep, expressProcessingStep, priorityProcessingStep, finalizeOrderStep };
