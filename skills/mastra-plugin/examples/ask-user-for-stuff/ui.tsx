// examples/ask-user-for-stuff/ui.tsx
'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type {
  ConfirmationInput,
  MultipleChoiceInput,
  TextInput,
} from './config';

const MASTRA_BASE_URL = process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:4111';

// =============================================================================
// Confirmation Panel Component
// =============================================================================

function ConfirmationPanel({
  input,
  onRespond,
}: {
  input: ConfirmationInput;
  onRespond: (confirmed: boolean) => void;
}) {
  const variantStyles = {
    default: 'border-blue-200 bg-blue-50',
    warning: 'border-amber-200 bg-amber-50',
    danger: 'border-red-200 bg-red-50',
  };

  const confirmStyles = {
    default: 'bg-blue-600 hover:bg-blue-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    danger: 'bg-red-600 hover:bg-red-700',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${variantStyles[input.variant || 'default']}`}>
      <h3 className="text-lg font-semibold text-gray-900">{input.title}</h3>
      <p className="mt-2 text-gray-700">{input.message}</p>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => onRespond(true)}
          className={`flex-1 rounded-lg px-4 py-2.5 font-medium text-white transition-colors ${confirmStyles[input.variant || 'default']}`}
        >
          {input.confirmLabel || 'Confirm'}
        </button>
        <button
          onClick={() => onRespond(false)}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {input.cancelLabel || 'Cancel'}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Multiple Choice Component
// =============================================================================

function MultipleChoicePanel({
  input,
  onRespond,
}: {
  input: MultipleChoiceInput;
  onRespond: (selected: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleOption = (id: string) => {
    const newSelected = new Set(selected);
    if (input.allowMultiple) {
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
    } else {
      // Single select - just pick this one
      newSelected.clear();
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleSubmit = () => {
    onRespond(Array.from(selected));
  };

  return (
    <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-6">
      <h3 className="text-lg font-semibold text-gray-900">{input.question}</h3>
      {input.allowMultiple && (
        <p className="mt-1 text-sm text-gray-500">Select all that apply</p>
      )}

      <div className="mt-4 space-y-2">
        {input.options.map((option) => {
          const isSelected = selected.has(option.id);
          return (
            <button
              key={option.id}
              onClick={() => toggleOption(option.id)}
              className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-500 ring-offset-2'
                  : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    isSelected
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-300'
                  }`}
                >
                  {isSelected && (
                    <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{option.label}</div>
                  {option.description && (
                    <div className="text-sm text-gray-500">{option.description}</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={selected.size === 0}
        className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {input.allowMultiple ? `Select ${selected.size} option${selected.size !== 1 ? 's' : ''}` : 'Continue'}
      </button>
    </div>
  );
}

// =============================================================================
// Text Input Component
// =============================================================================

function TextInputPanel({
  input,
  onRespond,
}: {
  input: TextInput;
  onRespond: (value: string) => void;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.required && !value.trim()) return;
    onRespond(value);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border-2 border-green-200 bg-green-50 p-6">
      <label className="block text-lg font-semibold text-gray-900">
        {input.prompt}
      </label>

      {input.multiline ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={input.placeholder}
          rows={4}
          className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={input.placeholder}
          className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      )}

      <button
        type="submit"
        disabled={input.required && !value.trim()}
        className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit
      </button>
    </form>
  );
}

// =============================================================================
// Completed Response Display
// =============================================================================

function CompletedConfirmation({ confirmed }: { confirmed: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${confirmed ? 'bg-green-100' : 'bg-gray-100'}`}>
      <div className="flex items-center gap-2">
        {confirmed ? (
          <>
            <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-green-800">Confirmed</span>
          </>
        ) : (
          <>
            <svg className="h-5 w-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-gray-800">Cancelled</span>
          </>
        )}
      </div>
    </div>
  );
}

function CompletedChoice({ selected, options }: { selected: string[]; options: Array<{ id: string; label: string }> }) {
  const selectedLabels = options
    .filter((opt) => selected.includes(opt.id))
    .map((opt) => opt.label);

  return (
    <div className="rounded-lg bg-purple-100 p-4">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="font-medium text-purple-800">
          Selected: {selectedLabels.join(', ')}
        </span>
      </div>
    </div>
  );
}

function CompletedText({ value }: { value: string }) {
  return (
    <div className="rounded-lg bg-green-100 p-4">
      <div className="flex items-start gap-2">
        <svg className="mt-0.5 h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="font-medium text-green-800">"{value}"</span>
      </div>
    </div>
  );
}

// =============================================================================
// Main Demo Component
// =============================================================================

/**
 * Ask User for Stuff Demo
 *
 * Demonstrates client-side tools that render interactive UI components
 * for collecting user input: confirmations, multiple choice, and text input.
 */
export function AskUserForStuffDemo() {
  const [input, setInput] = useState('');

  const { messages, sendMessage, addToolResult, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${MASTRA_BASE_URL}/api/agents/ask-user-for-stuff/chat`,
    }),
    maxSteps: 5, // Allow multiple tool calls
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Ask User for Stuff</h1>
        <p className="text-gray-500">
          Interactive tools that collect user input through rich UI
        </p>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="rounded-lg bg-gray-50 p-6 text-center text-gray-500">
            <p>Try asking things like:</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>"Help me pick a color theme"</li>
              <li>"I want to delete my account"</li>
              <li>"What's your name?"</li>
            </ul>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="space-y-3">
            {message.parts.map((part, index) => {
              // User messages
              if (part.type === 'text' && message.role === 'user') {
                return (
                  <div key={index} className="flex justify-end">
                    <div className="rounded-lg bg-blue-600 px-4 py-2 text-white">
                      {part.text}
                    </div>
                  </div>
                );
              }

              // Assistant text
              if (part.type === 'text' && message.role === 'assistant') {
                return (
                  <div key={index} className="rounded-lg bg-gray-100 px-4 py-2 text-gray-900">
                    {part.text}
                  </div>
                );
              }

              // =================================================================
              // Confirmation Tool
              // =================================================================
              if (part.type === 'tool-askForConfirmation') {
                const toolInput = part.input as ConfirmationInput;

                switch (part.state) {
                  case 'input-streaming':
                  case 'input-available':
                    return (
                      <ConfirmationPanel
                        key={index}
                        input={toolInput}
                        onRespond={(confirmed) => {
                          addToolResult({
                            toolCallId: part.toolCallId,
                            result: {
                              confirmed,
                              timestamp: new Date().toISOString(),
                            },
                          });
                        }}
                      />
                    );

                  case 'output-available':
                    return (
                      <CompletedConfirmation
                        key={index}
                        confirmed={(part.output as { confirmed: boolean }).confirmed}
                      />
                    );

                  default:
                    return null;
                }
              }

              // =================================================================
              // Multiple Choice Tool
              // =================================================================
              if (part.type === 'tool-askMultipleChoice') {
                const toolInput = part.input as MultipleChoiceInput;

                switch (part.state) {
                  case 'input-streaming':
                  case 'input-available':
                    return (
                      <MultipleChoicePanel
                        key={index}
                        input={toolInput}
                        onRespond={(selected) => {
                          addToolResult({
                            toolCallId: part.toolCallId,
                            result: {
                              selected,
                              timestamp: new Date().toISOString(),
                            },
                          });
                        }}
                      />
                    );

                  case 'output-available':
                    return (
                      <CompletedChoice
                        key={index}
                        selected={(part.output as { selected: string[] }).selected}
                        options={toolInput.options}
                      />
                    );

                  default:
                    return null;
                }
              }

              // =================================================================
              // Text Input Tool
              // =================================================================
              if (part.type === 'tool-askForText') {
                const toolInput = part.input as TextInput;

                switch (part.state) {
                  case 'input-streaming':
                  case 'input-available':
                    return (
                      <TextInputPanel
                        key={index}
                        input={toolInput}
                        onRespond={(value) => {
                          addToolResult({
                            toolCallId: part.toolCallId,
                            result: {
                              value,
                              timestamp: new Date().toISOString(),
                            },
                          });
                        }}
                      />
                    );

                  case 'output-available':
                    return (
                      <CompletedText
                        key={index}
                        value={(part.output as { value: string }).value}
                      />
                    );

                  default:
                    return null;
                }
              }

              return null;
            })}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me something..."
          className="flex-1 rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={status !== 'ready' || !input.trim()}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default AskUserForStuffDemo;
