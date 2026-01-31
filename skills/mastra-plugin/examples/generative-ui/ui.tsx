// examples/generative-ui/ui.tsx
'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { WeatherOutput } from './config';

// Configuration - adjust based on your Mastra server setup
const MASTRA_BASE_URL = process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:4111';

/**
 * Weather Card Component
 * Renders weather data with visual styling
 */
function WeatherCard({ data }: { data: WeatherOutput }) {
  return (
    <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-sky-100 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{data.location}</h3>
          <p className="text-sm text-gray-600">{data.description}</p>
        </div>
        <div className="text-right">
          <span className="text-4xl font-bold text-blue-600">{data.temperature}°C</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
          <span className="text-gray-600">Humidity: {data.humidity}%</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span className="text-gray-600">Wind: {data.windSpeed} km/h</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading Spinner Component
 */
function Loader() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-4">
      <svg className="h-5 w-5 animate-spin text-blue-500" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-sm text-gray-600">Fetching weather data...</span>
    </div>
  );
}

/**
 * Message Bubble Component
 */
function MessageBubble({
  role,
  children,
}: {
  role: 'user' | 'assistant';
  children: React.ReactNode;
}) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Generative UI Chat Demo
 *
 * This example demonstrates how to render dynamic UI components
 * based on tool execution states in a chat interface.
 */
export function GenerativeUIDemo() {
  const [input, setInput] = useState('');

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${MASTRA_BASE_URL}/api/agents/weather-plugin/chat`,
    }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="mx-auto flex h-[600px] max-w-2xl flex-col rounded-xl border bg-white shadow-lg">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Weather Assistant</h2>
        <p className="text-sm text-gray-500">Ask about weather in any city</p>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length === 0 && (
          <div className="text-center text-gray-400">
            <p>Try asking: "What's the weather in Tokyo?"</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            {message.parts.map((part, index) => {
              // Render user text messages
              if (part.type === 'text' && message.role === 'user') {
                return (
                  <MessageBubble key={index} role="user">
                    {part.text}
                  </MessageBubble>
                );
              }

              // Render assistant text messages
              if (part.type === 'text' && message.role === 'assistant') {
                return (
                  <MessageBubble key={index} role="assistant">
                    {part.text}
                  </MessageBubble>
                );
              }

              // Render weather tool outputs with generative UI
              if (part.type === 'tool-weatherTool') {
                switch (part.state) {
                  case 'input-streaming':
                    return (
                      <div key={index} className="animate-pulse rounded-lg bg-gray-100 p-4">
                        <div className="h-4 w-32 rounded bg-gray-200" />
                      </div>
                    );

                  case 'input-available':
                    return <Loader key={index} />;

                  case 'output-streaming':
                    return (
                      <div key={index} className="opacity-70">
                        <WeatherCard data={part.output as WeatherOutput} />
                      </div>
                    );

                  case 'output-available':
                    return <WeatherCard key={index} data={part.output as WeatherOutput} />;

                  case 'output-error':
                    return (
                      <div key={index} className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm font-medium text-red-800">Failed to fetch weather</p>
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

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter a city name..."
            className="flex-1 rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={status !== 'ready' || !input.trim()}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

export default GenerativeUIDemo;
