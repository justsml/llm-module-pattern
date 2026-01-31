// examples/ask-user-for-stuff/config.ts
import { z } from 'zod';

export const orderPluginConfig = {
  id: 'order-processing',
  name: 'Order Processing Plugin',
  version: '1.0.0',
} as const;

// Order Schemas
export const orderInputSchema = z.object({
  orderId: z.string().describe('Unique order identifier'),
  orderType: z.enum(['standard', 'express', 'priority']).describe('Shipping tier'),
  amount: z.number().positive().describe('Order amount in dollars'),
  items: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().positive(),
      name: z.string(),
    })
  ),
  customerEmail: z.string().email(),
});

export const orderOutputSchema = z.object({
  orderId: z.string(),
  status: z.enum(['processed', 'failed', 'pending_review']),
  shippingEstimate: z.string(),
  trackingNumber: z.string().optional(),
  processingTime: z.number().describe('Processing time in milliseconds'),
  notes: z.array(z.string()),
});

export type OrderInput = z.infer<typeof orderInputSchema>;
export type OrderOutput = z.infer<typeof orderOutputSchema>;

// Processing Result Schema (internal)
export const processingResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.record(z.unknown()).optional(),
});

export type ProcessingResult = z.infer<typeof processingResultSchema>;
