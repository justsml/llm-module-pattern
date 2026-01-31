// examples/ask-user-for-stuff/ui.tsx
'use client';

import { useState } from 'react';
import type { OrderInput, OrderOutput } from './config';

/**
 * Order Form Component
 */
function OrderForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (order: OrderInput) => void;
  disabled: boolean;
}) {
  const [orderType, setOrderType] = useState<'standard' | 'express' | 'priority'>('standard');
  const [amount, setAmount] = useState('99.99');
  const [email, setEmail] = useState('customer@example.com');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const order: OrderInput = {
      orderId: `ORD-${Date.now()}`,
      orderType,
      amount: parseFloat(amount),
      items: [
        { sku: 'ITEM-001', quantity: 1, name: 'Sample Product' },
      ],
      customerEmail: email,
    };

    onSubmit(order);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6">
      <h3 className="text-lg font-semibold">Create Test Order</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700">Order Type</label>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as typeof orderType)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        >
          <option value="standard">Standard (5-7 days)</option>
          <option value="express">Express (1-2 days)</option>
          <option value="priority">Priority (Same/Next day)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          step="0.01"
          min="0"
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
        {orderType === 'priority' && parseFloat(amount) > 1000 && (
          <p className="mt-1 text-xs text-amber-600">
            High-value priority orders require manual approval
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Customer Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Process Order
      </button>
    </form>
  );
}

/**
 * Workflow Progress Display
 */
function WorkflowProgress({
  events,
}: {
  events: Array<{ step: string; status: string; message: string }>;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-blue-500 animate-pulse';
      case 'suspended':
        return 'bg-amber-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <h4 className="text-sm font-medium text-gray-700">Workflow Progress</h4>
      <div className="mt-3 space-y-2">
        {events.map((event, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${getStatusColor(event.status)}`} />
            <span className="text-sm font-medium text-gray-900">{event.step}</span>
            <span className="text-sm text-gray-500">{event.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Approval Dialog for Suspended Workflows
 */
function ApprovalDialog({
  suspendPayload,
  onApprove,
  onReject,
}: {
  suspendPayload: {
    reason: string;
    orderDetails: { orderId: string; amount: number; customerEmail: string };
  };
  onApprove: (notes?: string) => void;
  onReject: (notes?: string) => void;
}) {
  const [notes, setNotes] = useState('');

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <h4 className="text-lg font-semibold text-amber-800">Approval Required</h4>
      <p className="mt-1 text-sm text-amber-700">{suspendPayload.reason}</p>

      <div className="mt-4 rounded-lg bg-white p-4">
        <h5 className="text-sm font-medium text-gray-700">Order Details</h5>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Order ID:</dt>
            <dd className="font-mono text-gray-900">{suspendPayload.orderDetails.orderId}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Amount:</dt>
            <dd className="font-semibold text-gray-900">
              ${suspendPayload.orderDetails.amount.toFixed(2)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Customer:</dt>
            <dd className="text-gray-900">{suspendPayload.orderDetails.customerEmail}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          rows={2}
          placeholder="Add approval notes..."
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onApprove(notes)}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          Approve
        </button>
        <button
          onClick={() => onReject(notes || 'Rejected by reviewer')}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

/**
 * Order Result Display
 */
function OrderResult({ result }: { result: OrderOutput }) {
  const statusColors = {
    processed: 'border-green-200 bg-green-50',
    failed: 'border-red-200 bg-red-50',
    pending_review: 'border-amber-200 bg-amber-50',
  };

  return (
    <div className={`rounded-lg border p-6 ${statusColors[result.status]}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">
          Order {result.orderId}
        </h4>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            result.status === 'processed'
              ? 'bg-green-100 text-green-800'
              : result.status === 'failed'
              ? 'bg-red-100 text-red-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {result.status}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Shipping Estimate:</dt>
          <dd className="text-gray-900">{result.shippingEstimate}</dd>
        </div>
        {result.trackingNumber && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Tracking:</dt>
            <dd className="font-mono text-gray-900">{result.trackingNumber}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-gray-500">Processing Time:</dt>
          <dd className="text-gray-900">{result.processingTime}ms</dd>
        </div>
      </dl>

      {result.notes.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h5 className="text-sm font-medium text-gray-700">Notes</h5>
          <ul className="mt-1 space-y-1">
            {result.notes.map((note, i) => (
              <li key={i} className="text-sm text-gray-600">
                • {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Ask User for Stuff Demo
 *
 * An order processing workflow that pauses to ask humans for approval.
 * Priority orders over $1000 require a thumbs up before processing!
 */
export function AskUserForStuffDemo() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressEvents, setProgressEvents] = useState<
    Array<{ step: string; status: string; message: string }>
  >([]);
  const [suspendedPayload, setSuspendedPayload] = useState<{
    reason: string;
    orderDetails: { orderId: string; amount: number; customerEmail: string };
  } | null>(null);
  const [result, setResult] = useState<OrderOutput | null>(null);
  const [workflowRun, setWorkflowRun] = useState<{ resume: (data: unknown) => Promise<unknown> } | null>(null);

  const handleSubmit = async (order: OrderInput) => {
    setIsProcessing(true);
    setProgressEvents([]);
    setSuspendedPayload(null);
    setResult(null);

    try {
      // In a real app, this would call your Mastra API
      // const workflow = mastra.getWorkflow('order-processing-workflow');
      // const run = await workflow.createRun();

      // Simulated workflow execution
      const response = await fetch('/api/workflows/order-processing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputData: order }),
      });

      const data = await response.json();

      // Handle workflow result
      if (data.status === 'suspended') {
        setSuspendedPayload(data.suspendPayload);
        setWorkflowRun({ resume: async (resumeData) => {
          const resumeResponse = await fetch('/api/workflows/order-processing/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ runId: data.runId, resumeData }),
          });
          return resumeResponse.json();
        }});
      } else if (data.status === 'completed') {
        setResult(data.output);
      }
    } catch (error) {
      console.error('Workflow error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (notes?: string) => {
    if (!workflowRun) return;

    setIsProcessing(true);
    setSuspendedPayload(null);

    try {
      const data = await workflowRun.resume({
        approved: true,
        approverNotes: notes,
      });

      if ((data as { output: OrderOutput }).output) {
        setResult((data as { output: OrderOutput }).output);
      }
    } catch (error) {
      console.error('Resume error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (notes?: string) => {
    if (!workflowRun) return;

    setIsProcessing(true);
    setSuspendedPayload(null);

    try {
      const data = await workflowRun.resume({
        approved: false,
        approverNotes: notes,
      });

      if ((data as { output: OrderOutput }).output) {
        setResult((data as { output: OrderOutput }).output);
      }
    } catch (error) {
      console.error('Resume error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Ask User for Stuff</h1>
        <p className="text-gray-500">
          Big orders need a thumbs up before we ship!
        </p>
      </div>

      <OrderForm onSubmit={handleSubmit} disabled={isProcessing} />

      {progressEvents.length > 0 && <WorkflowProgress events={progressEvents} />}

      {suspendedPayload && (
        <ApprovalDialog
          suspendPayload={suspendedPayload}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {result && <OrderResult result={result} />}
    </div>
  );
}

export default AskUserForStuffDemo;
