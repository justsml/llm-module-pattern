// examples/nested-agent-streams/ui.tsx
'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { ResearchOutput } from './config';

const MASTRA_BASE_URL = process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:4111';

/**
 * Research Card Component
 */
function ResearchCard({ data }: { data: ResearchOutput }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">
        Research: {data.topic}
      </h3>

      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700">Summary</h4>
        <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
          {data.summary}
        </p>
      </div>

      {data.keyPoints.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700">Key Points</h4>
          <ul className="mt-2 space-y-1">
            {data.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-blue-500">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Nested Agent Stream Display
 *
 * Shows the analysis agent's thinking in real-time
 */
function AgentThinkingStream({ content }: { content: string }) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
      <div className="flex items-center gap-2 text-purple-700">
        <svg className="h-4 w-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11a1 1 0 11-2 0 1 1 0 012 0zm0-3a1 1 0 01-1 1 1 1 0 110-2 1 1 0 011 1z" />
        </svg>
        <span className="text-sm font-medium">Analysis Agent Thinking...</span>
      </div>
      <div className="mt-2 text-sm text-purple-800 whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

/**
 * Custom Event Display
 */
function CustomEventBadge({ event }: { event: { type: string; data: Record<string, unknown> } }) {
  if (event.type === 'research-started') {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
        <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        Research started: {event.data.topic as string}
      </div>
    );
  }

  if (event.type === 'research-completed') {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs text-green-700">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Research completed
      </div>
    );
  }

  return null;
}

/**
 * Nested Agent Streams Demo
 *
 * Demonstrates streaming output from an agent called within a tool.
 */
export function NestedAgentStreamsDemo() {
  const [input, setInput] = useState('');

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${MASTRA_BASE_URL}/api/agents/research-plugin/chat`,
    }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Research Assistant</h1>
        <p className="text-gray-500">
          Watch the nested analysis agent think in real-time
        </p>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
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
                  <div key={index} className="rounded-lg bg-gray-100 px-4 py-2">
                    {part.text}
                  </div>
                );
              }

              // Custom events from the tool
              if (part.type === 'data-custom') {
                return (
                  <CustomEventBadge
                    key={index}
                    event={part.data as { type: string; data: Record<string, unknown> }}
                  />
                );
              }

              // Nested agent stream - shows the analysis agent's thinking
              if (part.type === 'data-tool-agent') {
                return (
                  <AgentThinkingStream
                    key={index}
                    content={part.content || 'Analyzing...'}
                  />
                );
              }

              // Research tool output
              if (part.type === 'tool-deepResearchTool') {
                switch (part.state) {
                  case 'input-streaming':
                  case 'input-available':
                    return (
                      <div key={index} className="animate-pulse rounded-lg bg-gray-100 p-4">
                        <div className="h-4 w-48 rounded bg-gray-200" />
                        <div className="mt-2 h-3 w-64 rounded bg-gray-200" />
                      </div>
                    );

                  case 'output-available':
                    return (
                      <ResearchCard key={index} data={part.output as ResearchOutput} />
                    );

                  case 'output-error':
                    return (
                      <div key={index} className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-800">{part.errorText}</p>
                      </div>
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
          placeholder="Ask me to research something..."
          className="flex-1 rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status !== 'ready' || !input.trim()}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Research
        </button>
      </form>

      <div className="text-center text-xs text-gray-400">
        Try: "Research the impact of AI on software development"
      </div>
    </div>
  );
}

export default NestedAgentStreamsDemo;
