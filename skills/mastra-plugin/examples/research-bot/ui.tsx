// examples/research-bot/ui.tsx
'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { ResearchOutput } from './config';

const MASTRA_BASE_URL = process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:4111';

// =============================================================================
// Research Findings Card
// =============================================================================

function ResearchCard({ data }: { data: ResearchOutput }) {
  const importanceColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Research: {data.topic}</h3>
          <p className="text-sm text-gray-500">
            Confidence: {Math.round(data.confidence * 100)}%
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
          <span className="text-2xl">🔬</span>
        </div>
      </div>

      {/* Key Findings */}
      {data.keyFindings.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700">Key Findings</h4>
          <div className="mt-2 space-y-2">
            {data.keyFindings.map((finding, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 rounded border px-1.5 py-0.5 text-xs font-medium ${importanceColors[finding.importance]}`}>
                  {finding.importance.toUpperCase()}
                </span>
                <span className="text-sm text-gray-700">{finding.point}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Topics */}
      {data.relatedTopics.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700">Related Topics</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.relatedTopics.map((topic, i) => (
              <span
                key={i}
                className="rounded-full bg-indigo-100 px-3 py-1 text-xs text-indigo-700"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Expert Agent Thinking Stream
// =============================================================================

function ExpertThinking({ content }: { content: string }) {
  return (
    <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-4">
      <div className="flex items-center gap-2 text-purple-700">
        <div className="relative">
          <span className="text-xl">🧠</span>
          <span className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-purple-500" />
        </div>
        <span className="font-medium">Expert Agent Thinking...</span>
      </div>
      <div className="mt-3 whitespace-pre-wrap text-sm text-purple-900">
        {content}
      </div>
    </div>
  );
}

// =============================================================================
// Research Phase Indicator
// =============================================================================

function PhaseIndicator({ phase, data }: { phase: string; data: Record<string, unknown> }) {
  const phaseConfig: Record<string, { icon: string; bg: string; text: string }> = {
    starting: { icon: '🚀', bg: 'bg-blue-100', text: 'text-blue-700' },
    analyzing: { icon: '🔍', bg: 'bg-purple-100', text: 'text-purple-700' },
    complete: { icon: '✅', bg: 'bg-green-100', text: 'text-green-700' },
  };

  const config = phaseConfig[phase] || phaseConfig.starting;

  return (
    <div className={`inline-flex items-center gap-2 rounded-full ${config.bg} px-3 py-1 text-xs ${config.text}`}>
      <span>{config.icon}</span>
      <span className="font-medium">
        {phase === 'starting' && `Researching: ${data.topic}`}
        {phase === 'analyzing' && (data.message as string || 'Analyzing...')}
        {phase === 'complete' && 'Research complete'}
      </span>
      {phase !== 'complete' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
    </div>
  );
}

// =============================================================================
// Main Demo Component
// =============================================================================

/**
 * Research Bot Demo
 *
 * Demonstrates NESTED AGENT STREAMING - the key pattern where:
 * 1. User talks to Research Bot
 * 2. Research Bot calls a tool
 * 3. The tool calls an Expert Agent and STREAMS its output to the UI
 * 4. User sees the Expert Agent thinking in real-time
 * 5. Tool returns structured findings
 *
 * UI Part Types:
 * - `data-tool-agent`: Streamed content from nested agent (Expert thinking)
 * - `data-custom`: Progress events (phase indicators)
 * - `tool-deepResearch`: Final structured output (research card)
 */
export function ResearchBotDemo() {
  const [input, setInput] = useState('');

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${MASTRA_BASE_URL}/api/agents/research-bot/chat`,
    }),
    maxSteps: 3,
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
        <h1 className="text-2xl font-bold">Research Bot</h1>
        <p className="text-gray-500">
          Watch the expert agent think in real-time as it researches your topic
        </p>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="rounded-lg bg-gray-50 p-6 text-center text-gray-500">
            <p>Try asking things like:</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>"Research quantum computing"</li>
              <li>"Deep dive into sustainable energy"</li>
              <li>"Quick overview of machine learning"</li>
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
              // NESTED AGENT STREAM - The key pattern!
              // This shows the Expert Agent's thinking as it streams
              // =================================================================
              if (part.type === 'data-tool-agent') {
                return (
                  <ExpertThinking
                    key={index}
                    content={(part as { content?: string }).content || 'Thinking...'}
                  />
                );
              }

              // =================================================================
              // Custom progress events
              // =================================================================
              if (part.type === 'data-custom') {
                const eventData = part.data as { type: string; data: Record<string, unknown> };
                if (eventData.type === 'research-phase') {
                  return (
                    <PhaseIndicator
                      key={index}
                      phase={eventData.data.phase as string}
                      data={eventData.data}
                    />
                  );
                }
                return null;
              }

              // =================================================================
              // Research tool output
              // =================================================================
              if (part.type === 'tool-deepResearch') {
                switch (part.state) {
                  case 'input-streaming':
                  case 'input-available':
                    return (
                      <div key={index} className="animate-pulse rounded-xl bg-indigo-50 p-6">
                        <div className="h-6 w-48 rounded bg-indigo-100" />
                        <div className="mt-4 space-y-2">
                          <div className="h-4 w-full rounded bg-indigo-100" />
                          <div className="h-4 w-3/4 rounded bg-indigo-100" />
                        </div>
                      </div>
                    );

                  case 'output-available':
                    return <ResearchCard key={index} data={part.output as ResearchOutput} />;

                  case 'output-error':
                    return (
                      <div key={index} className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-medium text-red-800">Research failed</p>
                        <p className="text-sm text-red-600">{part.errorText}</p>
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
          placeholder="What would you like to research?"
          className="flex-1 rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={status !== 'ready' || !input.trim()}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Research
        </button>
      </form>
    </div>
  );
}

export default ResearchBotDemo;
