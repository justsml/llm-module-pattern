// examples/trip-planner/ui.tsx
'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { WeatherOutput, PlacesOutput, GeoJsonOutput } from './config';

const MASTRA_BASE_URL = process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:4111';

// =============================================================================
// Weather Card Component
// =============================================================================

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
          <p className="text-xs text-gray-500">Feels like {data.feelsLike}°C</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <p className="text-gray-500">Humidity</p>
          <p className="font-semibold text-gray-900">{data.humidity}%</p>
        </div>
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <p className="text-gray-500">Wind</p>
          <p className="font-semibold text-gray-900">{data.windSpeed} km/h</p>
        </div>
        <div className="rounded-lg bg-white/60 p-2 text-center">
          <p className="text-gray-500">UV Index</p>
          <p className="font-semibold text-gray-900">{data.uvIndex}</p>
        </div>
      </div>

      {data.forecast.length > 0 && (
        <div className="mt-4 border-t border-blue-200 pt-4">
          <p className="mb-2 text-xs font-medium text-gray-500">3-Day Forecast</p>
          <div className="grid grid-cols-3 gap-2">
            {data.forecast.map((day, i) => (
              <div key={i} className="rounded-lg bg-white/60 p-2 text-center">
                <p className="text-xs text-gray-500">{day.date}</p>
                <p className="text-sm font-medium">{day.high}° / {day.low}°</p>
                <p className="truncate text-xs text-gray-600">{day.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Places Card Component
// =============================================================================

function PlacesCard({ data }: { data: PlacesOutput }) {
  const categoryColors: Record<string, string> = {
    attractions: 'from-purple-50 to-violet-100 border-purple-200',
    restaurants: 'from-orange-50 to-amber-100 border-orange-200',
    hotels: 'from-green-50 to-emerald-100 border-green-200',
    activities: 'from-pink-50 to-rose-100 border-pink-200',
  };

  const categoryIcons: Record<string, string> = {
    attractions: '🏛️',
    restaurants: '🍽️',
    hotels: '🏨',
    activities: '🎯',
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-6 shadow-sm ${categoryColors[data.category] || 'from-gray-50 to-slate-100'}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{categoryIcons[data.category] || '📍'}</span>
        <div>
          <h3 className="text-lg font-semibold capitalize text-gray-900">{data.category}</h3>
          <p className="text-sm text-gray-600">in {data.location}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {data.places.map((place, i) => (
          <div key={i} className="rounded-lg bg-white/70 p-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{place.name}</h4>
                <p className="text-sm text-gray-600">{place.description}</p>
              </div>
              <div className="text-right">
                {place.rating && (
                  <span className="inline-flex items-center gap-1 text-sm">
                    <span className="text-yellow-500">★</span>
                    <span className="font-medium">{place.rating}</span>
                  </span>
                )}
                {place.priceLevel && (
                  <p className="text-xs text-gray-500">{place.priceLevel}</p>
                )}
              </div>
            </div>
            {place.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {place.tags.map((tag, j) => (
                  <span key={j} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// GeoJSON Map Component
// =============================================================================

function GeoJsonCard({ data }: { data: GeoJsonOutput }) {
  const markerTypeColors: Record<string, string> = {
    attraction: 'bg-purple-500',
    restaurant: 'bg-orange-500',
    hotel: 'bg-green-500',
    activity: 'bg-pink-500',
    other: 'bg-gray-500',
  };

  const markerTypeIcons: Record<string, string> = {
    attraction: '🏛️',
    restaurant: '🍽️',
    hotel: '🏨',
    activity: '🎯',
    other: '📍',
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span>🗺️</span> Map: {data.location}
          </h3>
          <p className="text-sm text-gray-600">{data.pointCount} points of interest</p>
        </div>
        <a
          href={data.viewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open in geojson.io
        </a>
      </div>

      {/* Point list */}
      <div className="mt-4 space-y-2">
        {data.geojson.features.map((feature, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-white/70 p-3">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${markerTypeColors[feature.properties.markerType] || markerTypeColors.other}`}>
              {markerTypeIcons[feature.properties.markerType] || '📍'}
            </span>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{feature.properties.name}</p>
              {feature.properties.description && (
                <p className="text-sm text-gray-600">{feature.properties.description}</p>
              )}
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>{feature.geometry.coordinates[1].toFixed(4)},</p>
              <p>{feature.geometry.coordinates[0].toFixed(4)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-emerald-200 pt-4">
        {Object.entries(markerTypeIcons).map(([type, icon]) => (
          <span key={type} className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-1 text-xs text-gray-600">
            <span className={`h-2 w-2 rounded-full ${markerTypeColors[type]}`} />
            {icon} {type}
          </span>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Loading Skeleton
// =============================================================================

function ToolSkeleton({ type }: { type: string }) {
  const colors: Record<string, string> = {
    getWeather: 'from-blue-100 to-sky-100',
    findPlaces: 'from-purple-100 to-violet-100',
    generateMap: 'from-emerald-100 to-teal-100',
  };

  return (
    <div className={`animate-pulse rounded-xl bg-gradient-to-br p-6 ${colors[type] || 'from-gray-100 to-slate-100'}`}>
      <div className="h-6 w-32 rounded bg-white/50" />
      <div className="mt-4 space-y-3">
        <div className="h-4 w-full rounded bg-white/50" />
        <div className="h-4 w-3/4 rounded bg-white/50" />
        <div className="h-4 w-1/2 rounded bg-white/50" />
      </div>
    </div>
  );
}

// =============================================================================
// Main Demo Component
// =============================================================================

/**
 * Trip Planner Demo
 *
 * Demonstrates multiple tools with different visual outputs:
 * - Weather: Temperature, forecast, conditions
 * - Places: Categorized recommendations with ratings
 * - GeoJSON Map: Interactive map with points of interest (opens in geojson.io)
 *
 * Each tool renders a distinct, purpose-built UI component.
 */
export function TripPlannerDemo() {
  const [input, setInput] = useState('');

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${MASTRA_BASE_URL}/api/agents/trip-planner/chat`,
    }),
    maxSteps: 5,
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
        <h1 className="text-2xl font-bold">Trip Planner</h1>
        <p className="text-gray-500">Plan your trip with weather, places, and interactive maps</p>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="rounded-lg bg-gray-50 p-6 text-center text-gray-500">
            <p>Try asking things like:</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>"What's the weather in Tokyo?"</li>
              <li>"Find restaurants in Paris"</li>
              <li>"Show me attractions in Rome on a map"</li>
              <li>"Plan a weekend in Barcelona with a map"</li>
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

              // Weather tool
              if (part.type === 'tool-getWeather') {
                switch (part.state) {
                  case 'input-streaming':
                  case 'input-available':
                    return <ToolSkeleton key={index} type="getWeather" />;
                  case 'output-available':
                    return <WeatherCard key={index} data={part.output as WeatherOutput} />;
                  case 'output-error':
                    return (
                      <div key={index} className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-800">Failed to fetch weather: {part.errorText}</p>
                      </div>
                    );
                  default:
                    return null;
                }
              }

              // Places tool
              if (part.type === 'tool-findPlaces') {
                switch (part.state) {
                  case 'input-streaming':
                  case 'input-available':
                    return <ToolSkeleton key={index} type="findPlaces" />;
                  case 'output-available':
                    return <PlacesCard key={index} data={part.output as PlacesOutput} />;
                  case 'output-error':
                    return (
                      <div key={index} className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-800">Failed to find places: {part.errorText}</p>
                      </div>
                    );
                  default:
                    return null;
                }
              }

              // GeoJSON map tool
              if (part.type === 'tool-generateMap') {
                switch (part.state) {
                  case 'input-streaming':
                  case 'input-available':
                    return <ToolSkeleton key={index} type="generateMap" />;
                  case 'output-available':
                    return <GeoJsonCard key={index} data={part.output as GeoJsonOutput} />;
                  case 'output-error':
                    return (
                      <div key={index} className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-800">Failed to generate map: {part.errorText}</p>
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
          placeholder="Ask about destinations, weather, or map locations..."
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

export default TripPlannerDemo;
