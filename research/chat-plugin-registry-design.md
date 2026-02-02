# Chat Plugin Registry Design

**Date**: 2026-01-30
**Status**: Draft
**Author**: Claude (with Dan)

## Executive Summary

This document describes a modular plugin/adapter registry system for enriching LLM chat applications. The design is built on Mastra.ai and AI SDK patterns, providing extensibility points for:

- **Input/Output Processors** - Transform messages before/after LLM invocation
- **Memory Modules** - Semantic recall, working memory, custom memory types
- **Tools** - LLM-invokable functions
- **UI Components** - Admin configuration, user-facing elements
- **Data Persistence** - Plugin-specific storage

The architecture follows a **composition over inheritance** pattern, allowing plugins to be combined and configured declaratively.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Plugin Registry Architecture](#2-plugin-registry-architecture)
3. [Plugin Interface Design](#3-plugin-interface-design)
4. [Built-in Plugins](#4-built-in-plugins)
5. [Example: SafetyProcessor Module](#5-example-safetyprocessor-module)
6. [Example: ChatMemory Module](#6-example-chatmemory-module)
7. [Streaming Tool Integration](#7-streaming-tool-integration)
8. [UI Integration Patterns](#8-ui-integration-patterns)
9. [Data Persistence Patterns](#9-data-persistence-patterns)
10. [Configuration & Admin](#10-configuration--admin)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. Core Concepts

### 1.1 What is a Chat Plugin?

A **Chat Plugin** is a self-contained module that enriches chat functionality. Each plugin can provide:

| Capability | Description | Mastra Equivalent |
|------------|-------------|-------------------|
| **Input Processors** | Transform/validate messages before LLM | `inputProcessors` |
| **Output Processors** | Transform/filter messages after LLM | `outputProcessors` |
| **Memory** | Persistent context across conversations | `Memory` class |
| **Tools** | Functions the LLM can invoke | `createTool()` |
| **UI (Admin)** | Configuration interface for admins | Custom |
| **UI (User)** | User-facing chat elements | Custom |
| **Storage** | Plugin-specific data persistence | Custom |
| **Hooks** | Lifecycle callbacks | Custom |

### 1.2 Design Principles

1. **Composition**: Plugins compose together without inheritance hierarchies
2. **Declarative**: Configuration-driven, not code-driven
3. **Isolated**: Plugins don't directly depend on each other
4. **Observable**: All plugin actions are traceable/auditable
5. **Fail-safe**: Plugin failures don't crash the chat system
6. **Lazy-loaded**: Plugins load on-demand to minimize overhead

### 1.3 Relationship to Mastra

This design extends Mastra's patterns:

```
Mastra Patterns          →  Plugin Registry Extension
─────────────────────────────────────────────────────
inputProcessors          →  Plugin.processors.input[]
outputProcessors         →  Plugin.processors.output[]
Memory (lastMessages)    →  Plugin.memory.messageHistory
Memory (semanticRecall)  →  Plugin.memory.semanticRecall
Memory (workingMemory)   →  Plugin.memory.workingMemory
createTool()             →  Plugin.tools[]
(none)                   →  Plugin.ui.admin
(none)                   →  Plugin.ui.user
(none)                   →  Plugin.storage
(none)                   →  Plugin.hooks
```

---

## 2. Plugin Registry Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ChatPluginRegistry                          │
├─────────────────────────────────────────────────────────────────────┤
│  plugins: Map<string, ChatPlugin>                                   │
│  config: RegistryConfig                                             │
├─────────────────────────────────────────────────────────────────────┤
│  register(plugin: ChatPlugin): void                                 │
│  unregister(pluginId: string): void                                 │
│  getPlugin<T>(id: string): T | undefined                            │
│  listPlugins(): PluginManifest[]                                    │
│  configure(pluginId: string, config: unknown): void                 │
├─────────────────────────────────────────────────────────────────────┤
│  // Aggregation methods (gather from all plugins)                   │
│  getInputProcessors(): Processor[]                                  │
│  getOutputProcessors(): Processor[]                                 │
│  getTools(): Tool[]                                                 │
│  getMemoryConfig(): MemoryConfig                                    │
│  getAdminComponents(): AdminComponent[]                             │
│  getUserComponents(): UserComponent[]                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Safety   │   │   Chat    │   │  Custom   │
            │ Processor │   │  Memory   │   │   Tool    │
            │  Plugin   │   │  Plugin   │   │  Plugin   │
            └───────────┘   └───────────┘   └───────────┘
```

### 2.2 Plugin Lifecycle

```
┌─────────────────┐
│   Definition    │ ← Plugin module exports manifest + factories
└────────┬────────┘
         │ register()
         ▼
┌─────────────────┐
│   Registered    │ ← Plugin known to registry, not yet active
└────────┬────────┘
         │ initialize(config)
         ▼
┌─────────────────┐
│  Initializing   │ ← Plugin loading dependencies, storage, etc.
└────────┬────────┘
         │ onReady()
         ▼
┌─────────────────┐
│     Active      │ ← Plugin fully operational
└────────┬────────┘
         │ (per-request lifecycle)
         ├─► onRequestStart(context) → onRequestEnd(context)
         │
         │ disable() / unregister()
         ▼
┌─────────────────┐
│    Disabled     │ ← Plugin inactive but config preserved
└────────┬────────┘
         │ destroy()
         ▼
┌─────────────────┐
│   Destroyed     │ ← Cleanup complete, removed from registry
└─────────────────┘
```

### 2.3 Request Flow with Plugins

```
User Message
     │
     ▼
┌─────────────────────────────────────────────────────┐
│              ChatPluginRegistry                      │
│                                                      │
│  1. Gather all input processors (ordered by priority)│
│  2. Run processors in sequence                       │
│     [Plugin A.input] → [Plugin B.input] → ...       │
│                                                      │
│  3. Inject memory context                            │
│     - Working memory from plugins                    │
│     - Semantic recall from plugins                   │
│     - Message history                                │
│                                                      │
│  4. Collect tools from all plugins                   │
│     [Plugin A.tools] + [Plugin B.tools] + ...       │
│                                                      │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│              LLM Invocation                          │
│  - System prompt + memory context                    │
│  - User message (processed)                          │
│  - Available tools                                   │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│              ChatPluginRegistry                      │
│                                                      │
│  5. Gather all output processors (ordered)           │
│  6. Run processors in sequence                       │
│     [Plugin A.output] → [Plugin B.output] → ...     │
│                                                      │
│  7. Persist to plugin storage                        │
│     - Update working memory                          │
│     - Save embeddings                                │
│     - Log audit events                               │
│                                                      │
└─────────────────────────────────────────────────────┘
     │
     ▼
Final Response (to user)
```

---

## 3. Plugin Interface Design

### 3.1 Core Types

```typescript
// ============================================================
// FILE: types/plugin.ts
// Core plugin type definitions
// ============================================================

import type { CoreMessage } from '@mastra/core/llm';
import type { Processor } from '@mastra/core';
import type { Tool } from '@mastra/core/tools';
import type { ComponentType, ReactNode } from 'react';

/**
 * Unique identifier for a plugin
 */
export type PluginId = string;

/**
 * Plugin execution priority (lower = runs first)
 */
export type PluginPriority = number;

/**
 * Plugin lifecycle state
 */
export type PluginState =
  | 'registered'
  | 'initializing'
  | 'active'
  | 'disabled'
  | 'error'
  | 'destroyed';

/**
 * Context passed to plugins during request processing
 */
export interface PluginRequestContext {
  /** Unique request ID */
  requestId: string;
  /** Current thread ID */
  threadId: string;
  /** Current user ID */
  userId: string;
  /** Current resource ID (for scoped memory) */
  resourceId: string;
  /** Tool being used */
  toolSlug: string;
  /** Tool customization ID */
  customizationId?: string;
  /** User's locale */
  locale: string;
  /** Request metadata */
  metadata: Record<string, unknown>;
  /** Abort controller for cancellation */
  abortController: AbortController;
}

/**
 * Plugin manifest - static metadata describing the plugin
 */
export interface PluginManifest {
  /** Unique plugin identifier (e.g., 'safety-processor', 'chat-memory') */
  id: PluginId;
  /** Human-readable name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Short description */
  description: string;
  /** Plugin author/maintainer */
  author?: string;
  /** Execution priority (lower runs first, default: 100) */
  priority?: PluginPriority;
  /** Dependencies on other plugins */
  dependencies?: PluginId[];
  /** Feature flags this plugin provides */
  features?: string[];
  /** Tags for categorization */
  tags?: string[];
  /** Whether plugin is enabled by default */
  enabledByDefault?: boolean;
  /** License (e.g., 'MIT', 'proprietary') */
  license?: string;
}

/**
 * Plugin configuration schema
 */
export interface PluginConfigSchema<T = unknown> {
  /** JSON Schema for validation */
  schema: Record<string, unknown>;
  /** Default configuration values */
  defaults: T;
  /** Validation function */
  validate?: (config: T) => { valid: boolean; errors?: string[] };
}

/**
 * Plugin hooks for lifecycle events
 */
export interface PluginHooks {
  /** Called when plugin is registered */
  onRegister?: () => void | Promise<void>;
  /** Called when plugin configuration changes */
  onConfigure?: (config: unknown) => void | Promise<void>;
  /** Called when plugin is fully initialized */
  onReady?: () => void | Promise<void>;
  /** Called at start of each request */
  onRequestStart?: (ctx: PluginRequestContext) => void | Promise<void>;
  /** Called at end of each request */
  onRequestEnd?: (ctx: PluginRequestContext) => void | Promise<void>;
  /** Called when plugin is disabled */
  onDisable?: () => void | Promise<void>;
  /** Called when plugin is destroyed */
  onDestroy?: () => void | Promise<void>;
  /** Called on errors */
  onError?: (error: Error) => void | Promise<void>;
}

/**
 * Plugin storage interface
 */
export interface PluginStorage {
  /** Get a value by key */
  get<T>(key: string): Promise<T | null>;
  /** Set a value by key */
  set<T>(key: string, value: T): Promise<void>;
  /** Delete a value by key */
  delete(key: string): Promise<void>;
  /** List keys with optional prefix */
  list(prefix?: string): Promise<string[]>;
  /** Scoped storage for a specific context */
  scoped(scope: { threadId?: string; userId?: string; resourceId?: string }): PluginStorage;
}

/**
 * Admin UI component definition
 */
export interface PluginAdminComponent {
  /** Component identifier */
  id: string;
  /** Display name in admin UI */
  name: string;
  /** Description */
  description?: string;
  /** Icon (React component or icon name) */
  icon?: ReactNode | string;
  /** The React component to render */
  component: ComponentType<PluginAdminComponentProps>;
  /** Where to show this component */
  placement: 'tool-settings' | 'global-settings' | 'dashboard' | 'standalone';
  /** Required permissions to view */
  permissions?: string[];
}

export interface PluginAdminComponentProps {
  /** Current plugin configuration */
  config: unknown;
  /** Update configuration */
  onConfigChange: (config: unknown) => void;
  /** Plugin storage instance */
  storage: PluginStorage;
  /** Current user context */
  userContext: { userId: string; orgId?: string; roles: string[] };
}

/**
 * User-facing UI component definition
 */
export interface PluginUserComponent {
  /** Component identifier */
  id: string;
  /** Display name */
  name: string;
  /** The React component to render */
  component: ComponentType<PluginUserComponentProps>;
  /** Where to show this component */
  placement:
    | 'chat-header'
    | 'chat-footer'
    | 'message-action'
    | 'message-decorator'
    | 'input-toolbar'
    | 'sidebar-widget'
    | 'modal'
    | 'tooltip';
  /** Condition for showing component */
  showWhen?: (ctx: PluginUserComponentContext) => boolean;
}

export interface PluginUserComponentProps {
  /** Current message (if applicable) */
  message?: CoreMessage;
  /** Current thread ID */
  threadId: string;
  /** Plugin storage instance */
  storage: PluginStorage;
  /** Request context */
  context: PluginRequestContext;
}

export interface PluginUserComponentContext {
  threadId: string;
  userId: string;
  userRole: 'student' | 'teacher' | 'admin';
  messageRole?: 'user' | 'assistant';
  toolSlug: string;
}

/**
 * Main plugin interface
 */
export interface ChatPlugin<TConfig = unknown> {
  /** Plugin manifest (static metadata) */
  manifest: PluginManifest;

  /** Configuration schema */
  configSchema?: PluginConfigSchema<TConfig>;

  /** Current configuration */
  config?: TConfig;

  /** Current state */
  state: PluginState;

  /** Lifecycle hooks */
  hooks?: PluginHooks;

  /**
   * Initialize the plugin
   * @param config - Initial configuration
   * @param storage - Storage adapter
   */
  initialize(config: TConfig, storage: PluginStorage): Promise<void>;

  /**
   * Input processors provided by this plugin
   */
  getInputProcessors?(ctx: PluginRequestContext): Processor[] | Promise<Processor[]>;

  /**
   * Output processors provided by this plugin
   */
  getOutputProcessors?(ctx: PluginRequestContext): Processor[] | Promise<Processor[]>;

  /**
   * Tools provided by this plugin
   */
  getTools?(ctx: PluginRequestContext): Tool[] | Promise<Tool[]>;

  /**
   * Memory configuration provided by this plugin
   */
  getMemoryConfig?(ctx: PluginRequestContext): PluginMemoryConfig | Promise<PluginMemoryConfig>;

  /**
   * Admin UI components provided by this plugin
   */
  getAdminComponents?(): PluginAdminComponent[];

  /**
   * User-facing UI components provided by this plugin
   */
  getUserComponents?(): PluginUserComponent[];

  /**
   * Disable the plugin (keep config, stop processing)
   */
  disable(): Promise<void>;

  /**
   * Destroy the plugin (cleanup and remove)
   */
  destroy(): Promise<void>;
}

/**
 * Memory configuration from a plugin
 */
export interface PluginMemoryConfig {
  /** Enable/configure message history */
  messageHistory?: {
    enabled: boolean;
    lastMessages?: number;
  };

  /** Enable/configure semantic recall */
  semanticRecall?: {
    enabled: boolean;
    topK?: number;
    messageRange?: { before: number; after: number };
  };

  /** Enable/configure working memory */
  workingMemory?: {
    enabled: boolean;
    scope?: 'thread' | 'resource' | 'user';
    template?: string;
    schema?: Record<string, unknown>;
  };

  /** Custom memory processors */
  processors?: Processor[];
}
```

### 3.2 Plugin Registry Interface

```typescript
// ============================================================
// FILE: types/registry.ts
// Plugin registry type definitions
// ============================================================

import type { ChatPlugin, PluginId, PluginManifest, PluginRequestContext, PluginStorage } from './plugin';
import type { Processor } from '@mastra/core';
import type { Tool } from '@mastra/core/tools';

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Default storage adapter factory */
  storageFactory: (pluginId: PluginId) => PluginStorage;
  /** Global plugin configurations (by plugin ID) */
  pluginConfigs?: Record<PluginId, unknown>;
  /** Plugin IDs to enable by default */
  enabledPlugins?: PluginId[];
  /** Plugin IDs to explicitly disable */
  disabledPlugins?: PluginId[];
  /** Error handler for plugin failures */
  onPluginError?: (pluginId: PluginId, error: Error) => void;
  /** Logger instance */
  logger?: Logger;
}

/**
 * Plugin registration options
 */
export interface PluginRegistrationOptions {
  /** Override default configuration */
  config?: unknown;
  /** Override enabled state */
  enabled?: boolean;
  /** Override priority */
  priority?: number;
}

/**
 * Aggregated processors from all plugins
 */
export interface AggregatedProcessors {
  input: Array<{ pluginId: PluginId; processor: Processor; priority: number }>;
  output: Array<{ pluginId: PluginId; processor: Processor; priority: number }>;
}

/**
 * Aggregated tools from all plugins
 */
export interface AggregatedTools {
  tools: Array<{ pluginId: PluginId; tool: Tool }>;
}

/**
 * Plugin registry interface
 */
export interface ChatPluginRegistry {
  /**
   * Register a plugin with the registry
   */
  register(plugin: ChatPlugin, options?: PluginRegistrationOptions): Promise<void>;

  /**
   * Unregister a plugin
   */
  unregister(pluginId: PluginId): Promise<void>;

  /**
   * Get a plugin by ID
   */
  getPlugin<T extends ChatPlugin = ChatPlugin>(id: PluginId): T | undefined;

  /**
   * List all registered plugins
   */
  listPlugins(): PluginManifest[];

  /**
   * Update plugin configuration
   */
  configure(pluginId: PluginId, config: unknown): Promise<void>;

  /**
   * Enable a plugin
   */
  enable(pluginId: PluginId): Promise<void>;

  /**
   * Disable a plugin
   */
  disable(pluginId: PluginId): Promise<void>;

  /**
   * Check if a plugin is enabled
   */
  isEnabled(pluginId: PluginId): boolean;

  // ─────────────────────────────────────────────────────────
  // Aggregation methods (used during request processing)
  // ─────────────────────────────────────────────────────────

  /**
   * Get all input processors from enabled plugins, ordered by priority
   */
  getInputProcessors(ctx: PluginRequestContext): Promise<AggregatedProcessors['input']>;

  /**
   * Get all output processors from enabled plugins, ordered by priority
   */
  getOutputProcessors(ctx: PluginRequestContext): Promise<AggregatedProcessors['output']>;

  /**
   * Get all tools from enabled plugins
   */
  getTools(ctx: PluginRequestContext): Promise<AggregatedTools>;

  /**
   * Get merged memory configuration from all enabled plugins
   */
  getMemoryConfig(ctx: PluginRequestContext): Promise<PluginMemoryConfig>;

  /**
   * Get all admin UI components from enabled plugins
   */
  getAdminComponents(): PluginAdminComponent[];

  /**
   * Get all user UI components from enabled plugins
   */
  getUserComponents(): PluginUserComponent[];

  // ─────────────────────────────────────────────────────────
  // Lifecycle methods
  // ─────────────────────────────────────────────────────────

  /**
   * Initialize all registered plugins
   */
  initializeAll(): Promise<void>;

  /**
   * Notify plugins of request start
   */
  onRequestStart(ctx: PluginRequestContext): Promise<void>;

  /**
   * Notify plugins of request end
   */
  onRequestEnd(ctx: PluginRequestContext): Promise<void>;

  /**
   * Shutdown all plugins
   */
  shutdown(): Promise<void>;
}
```

### 3.3 Base Plugin Class

```typescript
// ============================================================
// FILE: lib/BasePlugin.ts
// Base class for implementing plugins
// ============================================================

import type {
  ChatPlugin,
  PluginManifest,
  PluginConfigSchema,
  PluginHooks,
  PluginStorage,
  PluginRequestContext,
  PluginState,
  PluginMemoryConfig,
  PluginAdminComponent,
  PluginUserComponent,
} from '../types/plugin';
import type { Processor } from '@mastra/core';
import type { Tool } from '@mastra/core/tools';

/**
 * Abstract base class for chat plugins.
 * Provides default implementations and lifecycle management.
 */
export abstract class BasePlugin<TConfig = unknown> implements ChatPlugin<TConfig> {
  abstract manifest: PluginManifest;

  configSchema?: PluginConfigSchema<TConfig>;
  config?: TConfig;
  hooks?: PluginHooks;

  protected storage!: PluginStorage;

  private _state: PluginState = 'registered';

  get state(): PluginState {
    return this._state;
  }

  protected setState(state: PluginState): void {
    this._state = state;
  }

  /**
   * Initialize the plugin with configuration and storage
   */
  async initialize(config: TConfig, storage: PluginStorage): Promise<void> {
    this.setState('initializing');

    try {
      // Validate configuration
      if (this.configSchema?.validate) {
        const result = this.configSchema.validate(config);
        if (!result.valid) {
          throw new Error(`Invalid plugin config: ${result.errors?.join(', ')}`);
        }
      }

      this.config = { ...this.configSchema?.defaults, ...config };
      this.storage = storage;

      // Call hook
      await this.hooks?.onConfigure?.(this.config);

      // Subclass initialization
      await this.onInitialize();

      this.setState('active');
      await this.hooks?.onReady?.();
    } catch (error) {
      this.setState('error');
      await this.hooks?.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Override in subclass for custom initialization
   */
  protected async onInitialize(): Promise<void> {
    // Default: no-op
  }

  /**
   * Disable the plugin
   */
  async disable(): Promise<void> {
    await this.hooks?.onDisable?.();
    this.setState('disabled');
  }

  /**
   * Destroy the plugin and cleanup resources
   */
  async destroy(): Promise<void> {
    await this.hooks?.onDestroy?.();
    this.setState('destroyed');
  }

  // ─────────────────────────────────────────────────────────
  // Optional methods - override in subclass as needed
  // ─────────────────────────────────────────────────────────

  getInputProcessors?(ctx: PluginRequestContext): Processor[] | Promise<Processor[]>;
  getOutputProcessors?(ctx: PluginRequestContext): Processor[] | Promise<Processor[]>;
  getTools?(ctx: PluginRequestContext): Tool[] | Promise<Tool[]>;
  getMemoryConfig?(ctx: PluginRequestContext): PluginMemoryConfig | Promise<PluginMemoryConfig>;
  getAdminComponents?(): PluginAdminComponent[];
  getUserComponents?(): PluginUserComponent[];
}
```

---

## 4. Built-in Plugins

The registry comes with several built-in plugins:

### 4.1 Plugin Inventory

| Plugin ID | Description | Processors | Memory | Tools | Admin UI | User UI |
|-----------|-------------|------------|--------|-------|----------|---------|
| `core/message-history` | Recent message history | - | messageHistory | - | - | - |
| `core/semantic-recall` | Vector similarity search | - | semanticRecall | - | - | - |
| `core/working-memory` | Persistent facts/preferences | - | workingMemory | updateWorkingMemory | - | - |
| `core/token-limiter` | Context window management | input | - | - | - | - |
| `core/tool-filter` | Filter tool calls from context | input | - | - | - | - |
| `safety/moderation` | Content moderation | input, output | - | - | Settings | Warnings |
| `safety/pii-detector` | PII detection/redaction | input, output | - | - | Settings | - |
| `safety/prompt-injection` | Injection detection | input | - | - | Settings | - |

### 4.2 Plugin Dependencies

```
core/working-memory
  └─► core/message-history (stores working memory updates)

core/semantic-recall
  └─► core/message-history (needs message embeddings)

safety/moderation
  └─► (no dependencies)

safety/pii-detector
  └─► (no dependencies)
```

---

## 5. Example: SafetyProcessor Module

### 5.1 Module Structure

```
modules/SafetyProcessor/
├── index.ts                    # Plugin export
├── SafetyProcessorPlugin.ts    # Plugin implementation
├── processors/
│   ├── ModerationProcessor.ts  # Content moderation
│   ├── PIIProcessor.ts         # PII detection
│   └── InjectionProcessor.ts   # Prompt injection
├── types.ts                    # Type definitions
├── config-schema.ts            # Configuration schema
├── ui/
│   ├── admin/
│   │   ├── SafetySettings.tsx  # Admin configuration UI
│   │   └── SafetyDashboard.tsx # Analytics dashboard
│   └── user/
│       ├── ModerationWarning.tsx  # Warning message component
│       └── ContentFlagged.tsx     # Flagged content indicator
└── storage/
    └── SafetyAuditStorage.ts   # Audit log storage
```

### 5.2 Plugin Implementation

```typescript
// ============================================================
// FILE: modules/SafetyProcessor/SafetyProcessorPlugin.ts
// ============================================================

import { BasePlugin } from '../../lib/BasePlugin';
import type {
  PluginManifest,
  PluginConfigSchema,
  PluginRequestContext,
  PluginAdminComponent,
  PluginUserComponent,
} from '../../types/plugin';
import type { Processor } from '@mastra/core';
import { ModerationProcessor } from './processors/ModerationProcessor';
import { PIIProcessor } from './processors/PIIProcessor';
import { InjectionProcessor } from './processors/InjectionProcessor';
import { SafetySettings } from './ui/admin/SafetySettings';
import { ModerationWarning } from './ui/user/ModerationWarning';

export interface SafetyProcessorConfig {
  moderation: {
    enabled: boolean;
    model: string;
    categories: ('hate' | 'harassment' | 'violence' | 'self-harm' | 'sexual')[];
    threshold: number;
    strategy: 'block' | 'warn' | 'log';
    roleOverrides?: {
      teacher?: { strategy: 'block' | 'warn' | 'log' };
      admin?: { strategy: 'block' | 'warn' | 'log' };
      student?: { strategy: 'block' | 'warn' | 'log' };
    };
  };
  pii: {
    enabled: boolean;
    detectionTypes: ('email' | 'phone' | 'ssn' | 'credit-card' | 'address')[];
    strategy: 'redact' | 'block' | 'warn';
    redactionMethod: 'mask' | 'placeholder' | 'hash';
  };
  injection: {
    enabled: boolean;
    model: string;
    threshold: number;
    strategy: 'block' | 'rewrite' | 'warn';
  };
  audit: {
    enabled: boolean;
    retention: '7d' | '30d' | '90d' | '1y';
  };
}

export class SafetyProcessorPlugin extends BasePlugin<SafetyProcessorConfig> {
  manifest: PluginManifest = {
    id: 'safety/processor',
    name: 'Safety Processor',
    version: '1.0.0',
    description: 'Content moderation, PII detection, and prompt injection prevention',
    priority: 10, // Run early in the pipeline
    tags: ['safety', 'moderation', 'security'],
    enabledByDefault: true,
  };

  configSchema: PluginConfigSchema<SafetyProcessorConfig> = {
    schema: {
      type: 'object',
      properties: {
        moderation: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            model: { type: 'string' },
            categories: { type: 'array', items: { type: 'string' } },
            threshold: { type: 'number', minimum: 0, maximum: 1 },
            strategy: { type: 'string', enum: ['block', 'warn', 'log'] },
          },
        },
        pii: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            detectionTypes: { type: 'array', items: { type: 'string' } },
            strategy: { type: 'string', enum: ['redact', 'block', 'warn'] },
            redactionMethod: { type: 'string', enum: ['mask', 'placeholder', 'hash'] },
          },
        },
        injection: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            model: { type: 'string' },
            threshold: { type: 'number' },
            strategy: { type: 'string', enum: ['block', 'rewrite', 'warn'] },
          },
        },
        audit: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            retention: { type: 'string', enum: ['7d', '30d', '90d', '1y'] },
          },
        },
      },
    },
    defaults: {
      moderation: {
        enabled: true,
        model: 'openai/gpt-5-mini',
        categories: ['hate', 'harassment', 'violence'],
        threshold: 0.7,
        strategy: 'warn',
      },
      pii: {
        enabled: true,
        detectionTypes: ['email', 'phone', 'ssn', 'credit-card'],
        strategy: 'redact',
        redactionMethod: 'mask',
      },
      injection: {
        enabled: true,
        model: 'openai/gpt-5-mini',
        threshold: 0.8,
        strategy: 'block',
      },
      audit: {
        enabled: true,
        retention: '30d',
      },
    },
  };

  hooks = {
    onRequestEnd: async (ctx: PluginRequestContext) => {
      // Persist audit log
      if (this.config?.audit.enabled) {
        await this.saveAuditLog(ctx);
      }
    },
  };

  // ─────────────────────────────────────────────────────────
  // Input Processors
  // ─────────────────────────────────────────────────────────

  async getInputProcessors(ctx: PluginRequestContext): Promise<Processor[]> {
    const processors: Processor[] = [];

    // 1. PII Detection (runs first)
    if (this.config?.pii.enabled) {
      processors.push(
        new PIIProcessor({
          ...this.config.pii,
          onDetection: (findings) => this.recordFindings(ctx, 'pii', findings),
        })
      );
    }

    // 2. Prompt Injection Detection
    if (this.config?.injection.enabled) {
      processors.push(
        new InjectionProcessor({
          ...this.config.injection,
          onDetection: (findings) => this.recordFindings(ctx, 'injection', findings),
        })
      );
    }

    // 3. Content Moderation
    if (this.config?.moderation.enabled) {
      // Determine strategy based on user role
      const strategy = this.getStrategyForRole(ctx);

      processors.push(
        new ModerationProcessor({
          ...this.config.moderation,
          strategy,
          onFlagged: (result) => this.recordFindings(ctx, 'moderation', result),
        })
      );
    }

    return processors;
  }

  // ─────────────────────────────────────────────────────────
  // Output Processors
  // ─────────────────────────────────────────────────────────

  async getOutputProcessors(ctx: PluginRequestContext): Promise<Processor[]> {
    const processors: Processor[] = [];

    // 1. Output moderation (check LLM responses)
    if (this.config?.moderation.enabled) {
      processors.push(
        new ModerationProcessor({
          ...this.config.moderation,
          strategy: this.getStrategyForRole(ctx),
          onFlagged: (result) => this.recordFindings(ctx, 'moderation-output', result),
        })
      );
    }

    // 2. PII in responses
    if (this.config?.pii.enabled) {
      processors.push(
        new PIIProcessor({
          ...this.config.pii,
          onDetection: (findings) => this.recordFindings(ctx, 'pii-output', findings),
        })
      );
    }

    return processors;
  }

  // ─────────────────────────────────────────────────────────
  // Admin UI Components
  // ─────────────────────────────────────────────────────────

  getAdminComponents(): PluginAdminComponent[] {
    return [
      {
        id: 'safety-settings',
        name: 'Safety Settings',
        description: 'Configure content moderation, PII detection, and injection prevention',
        icon: 'shield',
        component: SafetySettings,
        placement: 'tool-settings',
        permissions: ['admin', 'org-admin'],
      },
      {
        id: 'safety-dashboard',
        name: 'Safety Dashboard',
        description: 'View moderation events and audit logs',
        icon: 'chart',
        component: SafetyDashboard,
        placement: 'dashboard',
        permissions: ['admin', 'org-admin'],
      },
    ];
  }

  // ─────────────────────────────────────────────────────────
  // User UI Components
  // ─────────────────────────────────────────────────────────

  getUserComponents(): PluginUserComponent[] {
    return [
      {
        id: 'moderation-warning',
        name: 'Moderation Warning',
        component: ModerationWarning,
        placement: 'message-decorator',
        showWhen: (ctx) => {
          // Show warning if message was flagged
          return ctx.message?.metadata?.moderationResult?.flagged === true;
        },
      },
    ];
  }

  // ─────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────

  private getStrategyForRole(ctx: PluginRequestContext): 'block' | 'warn' | 'log' {
    const userRole = ctx.metadata.userRole as string;
    const roleOverrides = this.config?.moderation.roleOverrides;

    if (roleOverrides?.[userRole]?.strategy) {
      return roleOverrides[userRole].strategy;
    }

    return this.config?.moderation.strategy ?? 'warn';
  }

  private async recordFindings(
    ctx: PluginRequestContext,
    type: string,
    findings: unknown
  ): Promise<void> {
    const scopedStorage = this.storage.scoped({
      threadId: ctx.threadId,
      userId: ctx.userId
    });

    await scopedStorage.set(`findings:${ctx.requestId}:${type}`, {
      timestamp: new Date().toISOString(),
      type,
      findings,
      metadata: ctx.metadata,
    });
  }

  private async saveAuditLog(ctx: PluginRequestContext): Promise<void> {
    // Get all findings from this request
    const keys = await this.storage.list(`findings:${ctx.requestId}:`);
    const findings = await Promise.all(
      keys.map(key => this.storage.get(key))
    );

    // Save to audit log
    await this.storage.set(`audit:${ctx.requestId}`, {
      requestId: ctx.requestId,
      threadId: ctx.threadId,
      userId: ctx.userId,
      timestamp: new Date().toISOString(),
      findings: findings.filter(Boolean),
    });
  }
}

export default SafetyProcessorPlugin;
```

### 5.3 User Component Example

```tsx
// ============================================================
// FILE: modules/SafetyProcessor/ui/user/ModerationWarning.tsx
// ============================================================

import type { FC } from 'react';
import type { PluginUserComponentProps } from '../../../../types/plugin';
import { Alert, AlertIcon, AlertTitle, AlertDescription } from '@magicschool/spellbook';

interface ModerationWarningProps extends PluginUserComponentProps {
  message: {
    metadata?: {
      moderationResult?: {
        flagged: boolean;
        categories: string[];
        action: 'blocked' | 'warned';
      };
    };
  };
}

export const ModerationWarning: FC<ModerationWarningProps> = ({ message }) => {
  const result = message.metadata?.moderationResult;

  if (!result?.flagged) return null;

  const isBlocked = result.action === 'blocked';

  return (
    <Alert variant={isBlocked ? 'destructive' : 'warning'} className="mt-2">
      <AlertIcon name={isBlocked ? 'x-circle' : 'alert-triangle'} />
      <AlertTitle>
        {isBlocked ? 'Content Blocked' : 'Content Warning'}
      </AlertTitle>
      <AlertDescription>
        {isBlocked
          ? 'This message was blocked due to safety concerns.'
          : `This message may contain ${result.categories.join(', ')} content.`
        }
      </AlertDescription>
    </Alert>
  );
};
```

---

## 6. Example: ChatMemory Module

### 6.1 Module Structure

```
modules/ChatMemory/
├── index.ts                      # Plugin export
├── ChatMemoryPlugin.ts           # Plugin implementation
├── memory/
│   ├── SemanticRecallProvider.ts # Vector similarity search
│   ├── WorkingMemoryProvider.ts  # Structured fact storage
│   └── MessageHistoryProvider.ts # Recent messages
├── processors/
│   ├── MemoryInjector.ts         # Inject memory into context
│   └── MemoryPersister.ts        # Persist after response
├── tools/
│   └── UpdateWorkingMemoryTool.ts # LLM-invokable tool
├── types.ts                      # Type definitions
├── config-schema.ts              # Configuration schema
├── ui/
│   ├── admin/
│   │   ├── MemorySettings.tsx    # Admin configuration
│   │   ├── MemoryBrowser.tsx     # View stored memories
│   │   └── MemoryAnalytics.tsx   # Memory usage stats
│   └── user/
│       ├── MemoryIndicator.tsx   # "I remember..." indicator
│       ├── MemoryContext.tsx     # What the AI remembers
│       └── ForgetButton.tsx      # User can request forget
└── storage/
    └── MemoryVectorStorage.ts    # pgvector adapter
```

### 6.2 Plugin Implementation

```typescript
// ============================================================
// FILE: modules/ChatMemory/ChatMemoryPlugin.ts
// ============================================================

import { BasePlugin } from '../../lib/BasePlugin';
import type {
  PluginManifest,
  PluginConfigSchema,
  PluginRequestContext,
  PluginMemoryConfig,
  PluginAdminComponent,
  PluginUserComponent,
} from '../../types/plugin';
import type { Processor } from '@mastra/core';
import type { Tool } from '@mastra/core/tools';
import { MemoryInjector } from './processors/MemoryInjector';
import { MemoryPersister } from './processors/MemoryPersister';
import { createUpdateWorkingMemoryTool } from './tools/UpdateWorkingMemoryTool';
import { MemorySettings } from './ui/admin/MemorySettings';
import { MemoryIndicator } from './ui/user/MemoryIndicator';
import { ForgetButton } from './ui/user/ForgetButton';

export interface ChatMemoryConfig {
  messageHistory: {
    enabled: boolean;
    lastMessages: number;
  };
  semanticRecall: {
    enabled: boolean;
    topK: number;
    messageRange: { before: number; after: number };
    similarityThreshold: number;
  };
  workingMemory: {
    enabled: boolean;
    scope: 'thread' | 'resource' | 'user';
    mode: 'template' | 'schema';
    template?: string;
    schema?: Record<string, unknown>;
    autoUpdate: boolean; // LLM automatically updates
  };
  ui: {
    showMemoryIndicator: boolean;
    allowUserForget: boolean;
  };
}

export class ChatMemoryPlugin extends BasePlugin<ChatMemoryConfig> {
  manifest: PluginManifest = {
    id: 'chat/memory',
    name: 'Chat Memory',
    version: '1.0.0',
    description: 'Semantic memory, working memory, and message history for chat',
    priority: 50, // Middle of pipeline
    tags: ['memory', 'context', 'personalization'],
    enabledByDefault: true,
    features: ['semantic-recall', 'working-memory', 'memory-ui'],
  };

  configSchema: PluginConfigSchema<ChatMemoryConfig> = {
    schema: { /* ... JSON Schema ... */ },
    defaults: {
      messageHistory: {
        enabled: true,
        lastMessages: 10,
      },
      semanticRecall: {
        enabled: true,
        topK: 5,
        messageRange: { before: 1, after: 1 },
        similarityThreshold: 0.7,
      },
      workingMemory: {
        enabled: true,
        scope: 'resource',
        mode: 'template',
        template: `# User Profile
- Name: [Unknown]
- Role: [Unknown]
- Preferences: [None recorded]
- Key Context: [None]`,
        autoUpdate: true,
      },
      ui: {
        showMemoryIndicator: true,
        allowUserForget: true,
      },
    },
  };

  // ─────────────────────────────────────────────────────────
  // Memory Configuration
  // ─────────────────────────────────────────────────────────

  async getMemoryConfig(ctx: PluginRequestContext): Promise<PluginMemoryConfig> {
    return {
      messageHistory: this.config?.messageHistory.enabled ? {
        enabled: true,
        lastMessages: this.config.messageHistory.lastMessages,
      } : undefined,

      semanticRecall: this.config?.semanticRecall.enabled ? {
        enabled: true,
        topK: this.config.semanticRecall.topK,
        messageRange: this.config.semanticRecall.messageRange,
      } : undefined,

      workingMemory: this.config?.workingMemory.enabled ? {
        enabled: true,
        scope: this.config.workingMemory.scope,
        template: this.config.workingMemory.mode === 'template'
          ? this.config.workingMemory.template
          : undefined,
        schema: this.config.workingMemory.mode === 'schema'
          ? this.config.workingMemory.schema
          : undefined,
      } : undefined,
    };
  }

  // ─────────────────────────────────────────────────────────
  // Tools
  // ─────────────────────────────────────────────────────────

  async getTools(ctx: PluginRequestContext): Promise<Tool[]> {
    const tools: Tool[] = [];

    // Only provide the tool if working memory is enabled with auto-update
    if (this.config?.workingMemory.enabled && this.config?.workingMemory.autoUpdate) {
      tools.push(
        createUpdateWorkingMemoryTool({
          storage: this.storage.scoped({
            resourceId: ctx.resourceId,
            threadId: ctx.threadId,
          }),
          scope: this.config.workingMemory.scope,
          mode: this.config.workingMemory.mode,
          template: this.config.workingMemory.template,
          schema: this.config.workingMemory.schema,
        })
      );
    }

    return tools;
  }

  // ─────────────────────────────────────────────────────────
  // Admin UI Components
  // ─────────────────────────────────────────────────────────

  getAdminComponents(): PluginAdminComponent[] {
    return [
      {
        id: 'memory-settings',
        name: 'Memory Settings',
        description: 'Configure memory options for this tool',
        icon: 'brain',
        component: MemorySettings,
        placement: 'tool-settings',
        permissions: ['admin', 'org-admin', 'tool-owner'],
      },
      {
        id: 'memory-browser',
        name: 'Memory Browser',
        description: 'Browse and manage stored memories',
        icon: 'database',
        component: MemoryBrowser,
        placement: 'standalone',
        permissions: ['admin'],
      },
    ];
  }

  // ─────────────────────────────────────────────────────────
  // User UI Components
  // ─────────────────────────────────────────────────────────

  getUserComponents(): PluginUserComponent[] {
    const components: PluginUserComponent[] = [];

    if (this.config?.ui.showMemoryIndicator) {
      components.push({
        id: 'memory-indicator',
        name: 'Memory Indicator',
        component: MemoryIndicator,
        placement: 'chat-header',
        showWhen: () => true,
      });
    }

    if (this.config?.ui.allowUserForget) {
      components.push({
        id: 'forget-button',
        name: 'Forget Button',
        component: ForgetButton,
        placement: 'sidebar-widget',
        showWhen: (ctx) => ctx.userRole !== 'student', // Teachers/admins only
      });
    }

    return components;
  }
}

export default ChatMemoryPlugin;
```

### 6.3 UpdateWorkingMemory Tool

```typescript
// ============================================================
// FILE: modules/ChatMemory/tools/UpdateWorkingMemoryTool.ts
// ============================================================

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { PluginStorage } from '../../../types/plugin';

interface UpdateWorkingMemoryToolConfig {
  storage: PluginStorage;
  scope: 'thread' | 'resource' | 'user';
  mode: 'template' | 'schema';
  template?: string;
  schema?: Record<string, unknown>;
}

export function createUpdateWorkingMemoryTool(config: UpdateWorkingMemoryToolConfig) {
  const { storage, scope, mode, template, schema } = config;

  // Build input schema based on mode
  const inputSchema = mode === 'template'
    ? z.object({
        updates: z.string().describe(
          'Updated markdown content for working memory. ' +
          'Should follow the template format and only update changed fields.'
        ),
      })
    : z.object({
        updates: z.record(z.unknown()).describe(
          'Structured updates to working memory fields.'
        ),
      });

  return createTool({
    id: 'updateWorkingMemory',
    description: `
Update the working memory with new information about the user or conversation.
Use this when the user shares important details like:
- Their name, role, or profession
- Preferences or settings they want remembered
- Key context about their current project or task
- Important decisions or conclusions from the conversation

Only call this when there is genuinely new information to remember.
Do not call this for every message.
`.trim(),
    inputSchema,
    execute: async ({ updates }) => {
      try {
        // Get current working memory
        const current = await storage.get<{ content: string | Record<string, unknown> }>('workingMemory');

        if (mode === 'template') {
          // Merge template-based updates
          const updatedContent = mergeTemplateContent(
            current?.content as string ?? template ?? '',
            updates as string
          );
          await storage.set('workingMemory', { content: updatedContent });
        } else {
          // Merge schema-based updates
          const updatedContent = {
            ...(current?.content as Record<string, unknown> ?? {}),
            ...(updates as Record<string, unknown>),
          };
          await storage.set('workingMemory', { content: updatedContent });
        }

        return { success: true, message: 'Working memory updated.' };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  });
}

function mergeTemplateContent(existing: string, updates: string): string {
  // Simple merge: if updates contains the same headers, replace those sections
  // Otherwise, append new content
  // (Actual implementation would be more sophisticated)
  return updates;
}
```

### 6.4 Memory Indicator Component

```tsx
// ============================================================
// FILE: modules/ChatMemory/ui/user/MemoryIndicator.tsx
// ============================================================

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import type { PluginUserComponentProps } from '../../../../types/plugin';
import { Badge, Tooltip, Popover } from '@magicschool/spellbook';
import { Brain } from 'lucide-react';

export const MemoryIndicator: FC<PluginUserComponentProps> = ({
  storage,
  threadId
}) => {
  const [memoryStatus, setMemoryStatus] = useState<{
    hasWorkingMemory: boolean;
    messageCount: number;
    lastUpdated?: string;
  }>({ hasWorkingMemory: false, messageCount: 0 });

  useEffect(() => {
    async function loadStatus() {
      const workingMemory = await storage.get('workingMemory');
      const stats = await storage.get<{ count: number; lastUpdated: string }>('memoryStats');

      setMemoryStatus({
        hasWorkingMemory: !!workingMemory,
        messageCount: stats?.count ?? 0,
        lastUpdated: stats?.lastUpdated,
      });
    }

    loadStatus();
  }, [storage, threadId]);

  if (!memoryStatus.hasWorkingMemory && memoryStatus.messageCount === 0) {
    return null;
  }

  return (
    <Popover>
      <Popover.Trigger asChild>
        <Badge variant="secondary" className="cursor-pointer gap-1">
          <Brain className="h-3 w-3" />
          Memory Active
        </Badge>
      </Popover.Trigger>
      <Popover.Content>
        <div className="space-y-2">
          <h4 className="font-medium">Memory Status</h4>
          <div className="text-sm text-muted-foreground">
            {memoryStatus.hasWorkingMemory && (
              <p>Working memory is active with your preferences.</p>
            )}
            {memoryStatus.messageCount > 0 && (
              <p>{memoryStatus.messageCount} messages in recall context.</p>
            )}
            {memoryStatus.lastUpdated && (
              <p className="text-xs">Last updated: {memoryStatus.lastUpdated}</p>
            )}
          </div>
        </div>
      </Popover.Content>
    </Popover>
  );
};
```

---

## 7. Streaming Tool Integration

Streaming presents unique challenges for the plugin architecture. When the LLM generates responses token-by-token, plugins must handle **progressive data** rather than complete messages.

### 7.1 Streaming Architecture Overview

MagicSchool uses the AI SDK's `createUIMessageStream()` pattern:

```
User Message
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  createUIMessageStreamResponse()                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  createUIMessageStream({ execute: async ({ writer }) │   │
│  │    │                                                  │   │
│  │    │  1. Write metadata parts                        │   │
│  │    │     writer.write({ type: 'data-threadId', ... })│   │
│  │    │                                                  │   │
│  │    │  2. Start LLM generation                        │   │
│  │    │     const result = await createAIResponse()     │   │
│  │    │                                                  │   │
│  │    │  3. Convert to UI stream                        │   │
│  │    │     result.toUIMessageStream({                  │   │
│  │    │       sendReasoning: true,                      │   │
│  │    │       onFinish: saveMessage                     │   │
│  │    │     })                                          │   │
│  │    │                                                  │   │
│  │    │  4. Merge into writer                           │   │
│  │    │     writer.merge(uiStream)                      │   │
│  │    ▼                                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
     │
     ▼ Stream Events
┌─────────────────────────────────────────────────────────────┐
│  Browser (useChat / useIncantate)                           │
│                                                              │
│  Events:                                                     │
│  • data-threadId, data-userMessageDbId, ...  (metadata)     │
│  • text-start → text-delta → text-end        (text)         │
│  • tool-{name} with state transitions        (tools)        │
│  • reasoning with streaming state            (thinking)     │
│  • source-url, source-document               (citations)    │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Tool State Machine

Tools have a **state machine** during streaming:

```
┌──────────────────┐
│  input-streaming │ ← Tool call being composed by LLM
└────────┬─────────┘
         │ Input complete
         ▼
┌──────────────────┐
│ input-available  │ ← Ready to execute
└────────┬─────────┘
         │ Execution starts
         ▼
┌──────────────────┐
│ output-streaming │ ← Tool running (for streaming tools)
└────────┬─────────┘
         │ Complete or error
         ▼
┌──────────────────────────────────────┐
│ output-available │ output-error      │
└──────────────────────────────────────┘
```

**Plugin UI components must handle ALL states:**

```typescript
interface PluginToolPartProps {
  part: ToolCallPart;
  isStreaming: boolean;  // Overall message still streaming
  isLastMessage: boolean;
}

// Example: Rubric feedback tool renderer
function RubricFeedbackPart({ part, isStreaming }: PluginToolPartProps) {
  switch (part.state) {
    case 'input-streaming':
      return <LoadingSpinner message="Preparing rubric analysis..." />;

    case 'input-available':
      return <LoadingSpinner message="Analyzing submission..." />;

    case 'output-streaming':
      // For streaming structured outputs, show partial results
      return <PartialRubricDisplay partialData={part.output} />;

    case 'output-available':
      return <CompletedRubricDisplay data={part.output} />;

    case 'output-error':
      return <ErrorDisplay error={part.error} />;
  }
}
```

### 7.3 Plugin Streaming Interfaces

#### A. Stream Part Emitters

Plugins can emit custom stream parts:

```typescript
// ============================================================
// FILE: types/streaming.ts
// ============================================================

import type { UIMessageStreamWriter } from 'ai';

/**
 * Custom stream parts that plugins can emit
 */
export interface PluginStreamPart<T = unknown> {
  /** Part type identifier (e.g., 'plugin-safety-warning') */
  type: `plugin-${string}`;
  /** Part data */
  data: T;
  /** Optional ID for updates */
  id?: string;
}

/**
 * Stream writer wrapper for plugins
 */
export interface PluginStreamWriter {
  /** Write a custom plugin part */
  writePluginPart<T>(part: PluginStreamPart<T>): void;

  /** Write text delta (for text-generating plugins) */
  writeTextDelta(delta: string, id?: string): void;

  /** Write a tool state update */
  writeToolState(toolName: string, state: ToolPartState, data?: unknown): void;

  /** Check if stream is still active */
  isActive(): boolean;
}

/**
 * Context for streaming output processors
 */
export interface StreamingProcessorContext extends PluginRequestContext {
  /** Stream writer for emitting parts */
  writer: PluginStreamWriter;

  /** Signal to abort processing */
  abortSignal: AbortSignal;

  /** Whether this is the final chunk */
  isFinal: boolean;
}
```

#### B. Streaming Output Processors

Output processors need special handling for streams:

```typescript
// ============================================================
// FILE: types/processor.ts (additions)
// ============================================================

export interface StreamingProcessor extends Processor {
  /**
   * Process a streaming chunk (called for each delta)
   * Return transformed chunk or null to filter
   */
  processStreamChunk?(
    chunk: StreamChunk,
    ctx: StreamingProcessorContext
  ): Promise<StreamChunk | null>;

  /**
   * Called when stream starts
   */
  onStreamStart?(ctx: StreamingProcessorContext): Promise<void>;

  /**
   * Called when stream ends (before persistence)
   */
  onStreamEnd?(
    finalMessage: UIMessage,
    ctx: StreamingProcessorContext
  ): Promise<UIMessage>;
}

export type StreamChunk =
  | { type: 'text-delta'; delta: string; id: string }
  | { type: 'tool-call'; toolName: string; state: string; data: unknown }
  | { type: 'reasoning'; text: string; state: 'streaming' | 'complete' }
  | PluginStreamPart;
```

#### C. Example: Real-time Safety Scanning

```typescript
// ============================================================
// FILE: modules/SafetyProcessor/processors/StreamingSafetyProcessor.ts
// ============================================================

export class StreamingSafetyProcessor implements StreamingProcessor {
  id = 'streaming-safety';

  private buffer = '';
  private scanThreshold = 50; // Scan every 50 chars

  async processStreamChunk(
    chunk: StreamChunk,
    ctx: StreamingProcessorContext
  ): Promise<StreamChunk | null> {
    if (chunk.type !== 'text-delta') return chunk;

    // Accumulate text for scanning
    this.buffer += chunk.delta;

    // Periodic safety scan
    if (this.buffer.length >= this.scanThreshold) {
      const result = await this.quickScan(this.buffer);

      if (result.flagged) {
        // Emit warning part to stream
        ctx.writer.writePluginPart({
          type: 'plugin-safety-warning',
          data: {
            severity: result.severity,
            category: result.category,
            position: this.buffer.length,
          },
        });

        // Optionally abort if severe
        if (result.severity === 'critical') {
          ctx.abortSignal.abort();
          return null;
        }
      }

      this.buffer = ''; // Reset buffer
    }

    return chunk;
  }

  async onStreamEnd(
    finalMessage: UIMessage,
    ctx: StreamingProcessorContext
  ): Promise<UIMessage> {
    // Full scan of complete message
    const fullText = getTextFromParts(finalMessage);
    const result = await this.fullScan(fullText);

    if (result.flagged) {
      // Add metadata to message
      return {
        ...finalMessage,
        metadata: {
          ...finalMessage.metadata,
          safetyResult: result,
        },
      };
    }

    return finalMessage;
  }
}
```

### 7.4 Structured Output Streaming (Rubric Example)

For tools that generate structured data (like rubric feedback), the plugin must handle **partial JSON**:

```typescript
// ============================================================
// FILE: modules/RubricFeedback/ui/user/PartialRubricDisplay.tsx
// ============================================================

import { useState, useEffect } from 'react';
import { parsePartialJson } from '@/lib/streaming/partialJsonParser';

interface RubricFeedbackData {
  overall_score?: number;
  max_score?: number;
  rubric_scores?: Array<{
    criterion_id: string;
    criterion_name: string;
    score?: number;
    max_score?: number;
    level_achieved?: string;
    comments?: string;
  }>;
}

export function PartialRubricDisplay({
  partialData
}: {
  partialData: string | Partial<RubricFeedbackData>
}) {
  const [parsed, setParsed] = useState<Partial<RubricFeedbackData>>({});

  useEffect(() => {
    if (typeof partialData === 'string') {
      // Try to parse incomplete JSON
      const result = parsePartialJson<RubricFeedbackData>(partialData);
      if (result) setParsed(result);
    } else {
      setParsed(partialData);
    }
  }, [partialData]);

  return (
    <div className="space-y-4">
      {/* Overall score - show as soon as available */}
      {parsed.overall_score !== undefined && (
        <div className="flex items-center gap-2">
          <span className="font-semibold">Overall Score:</span>
          <span className="text-2xl font-bold">
            {parsed.overall_score}/{parsed.max_score ?? '...'}
          </span>
        </div>
      )}

      {/* Criteria - render progressively as they arrive */}
      {parsed.rubric_scores?.map((criterion, index) => (
        <CriterionCard
          key={criterion.criterion_id || index}
          criterion={criterion}
          isComplete={!!criterion.comments}
        />
      ))}

      {/* Loading indicator for remaining criteria */}
      {!parsed.rubric_scores && (
        <div className="animate-pulse">
          <div className="h-20 bg-muted rounded-lg" />
          <div className="h-20 bg-muted rounded-lg mt-2" />
        </div>
      )}
    </div>
  );
}

function CriterionCard({
  criterion,
  isComplete
}: {
  criterion: RubricFeedbackData['rubric_scores'][0];
  isComplete: boolean;
}) {
  return (
    <div className={`p-4 border rounded-lg ${isComplete ? '' : 'animate-pulse'}`}>
      <div className="flex justify-between items-start">
        <h4 className="font-medium">{criterion.criterion_name || 'Loading...'}</h4>
        {criterion.score !== undefined && (
          <span className="text-sm font-mono">
            {criterion.score}/{criterion.max_score}
          </span>
        )}
      </div>

      {criterion.level_achieved && (
        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
          {criterion.level_achieved}
        </span>
      )}

      {criterion.comments ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {criterion.comments}
        </p>
      ) : (
        <div className="mt-2 h-4 bg-muted rounded w-3/4" />
      )}
    </div>
  );
}
```

### 7.5 Plugin Tool Part Renderers

Plugins register custom renderers for their tools:

```typescript
// ============================================================
// FILE: types/plugin.ts (additions)
// ============================================================

/**
 * Custom tool part renderer
 */
export interface PluginToolRenderer {
  /** Tool name this renderer handles */
  toolName: string;

  /** React component to render the tool part */
  component: ComponentType<PluginToolPartProps>;

  /** Optional: loading state component */
  loadingComponent?: ComponentType<{ state: ToolPartState }>;

  /** Optional: error state component */
  errorComponent?: ComponentType<{ error: unknown }>;
}

export interface PluginToolPartProps {
  /** The tool part from the stream */
  part: ToolCallPart;

  /** Whether the overall message is still streaming */
  isStreaming: boolean;

  /** Whether this is the last message in the thread */
  isLastMessage: boolean;

  /** Plugin storage */
  storage: PluginStorage;

  /** Request context */
  context: PluginRequestContext;
}
```

#### Plugin Tool Renderer Registration

```typescript
// ============================================================
// FILE: modules/RubricFeedback/index.ts
// ============================================================

export class RubricFeedbackPlugin extends BasePlugin<RubricFeedbackConfig> {
  manifest: PluginManifest = {
    id: 'feedback/rubric',
    name: 'Rubric Feedback',
    version: '1.0.0',
    description: 'AI-powered rubric-based feedback generation',
    tags: ['feedback', 'assessment', 'rubric'],
  };

  /**
   * Tools that this plugin provides
   */
  async getTools(ctx: PluginRequestContext): Promise<Tool[]> {
    return [
      createTool({
        id: 'generateRubricFeedback',
        description: 'Generate feedback for student work based on a rubric',
        inputSchema: z.object({
          submissionId: z.string(),
          rubricId: z.string(),
          includeGlowsGrows: z.boolean().optional(),
          includeNextSteps: z.boolean().optional(),
        }),
        execute: async (input) => {
          // Tool execution - returns structured feedback
          return await this.generateFeedback(input, ctx);
        },
      }),
    ];
  }

  /**
   * Custom renderers for tool outputs
   */
  getToolRenderers(): PluginToolRenderer[] {
    return [
      {
        toolName: 'generateRubricFeedback',
        component: RubricFeedbackDisplay,
        loadingComponent: RubricFeedbackLoading,
        errorComponent: RubricFeedbackError,
      },
    ];
  }

  /**
   * User UI components
   */
  getUserComponents(): PluginUserComponent[] {
    return [
      {
        id: 'rubric-summary',
        name: 'Rubric Summary Widget',
        component: RubricSummaryWidget,
        placement: 'sidebar-widget',
        showWhen: (ctx) => ctx.toolSlug === 'writing-feedback',
      },
    ];
  }
}
```

### 7.6 Streaming Metadata & Analytics

Plugins can emit metadata during streaming for analytics:

```typescript
// ============================================================
// FILE: modules/Analytics/StreamingAnalyticsProcessor.ts
// ============================================================

export class StreamingAnalyticsProcessor implements StreamingProcessor {
  id = 'streaming-analytics';

  private metrics = {
    startTime: 0,
    firstTokenTime: 0,
    tokenCount: 0,
    toolCalls: [] as string[],
  };

  async onStreamStart(ctx: StreamingProcessorContext): Promise<void> {
    this.metrics.startTime = Date.now();
  }

  async processStreamChunk(
    chunk: StreamChunk,
    ctx: StreamingProcessorContext
  ): Promise<StreamChunk> {
    // Track first token time
    if (chunk.type === 'text-delta' && !this.metrics.firstTokenTime) {
      this.metrics.firstTokenTime = Date.now();

      // Emit TTFT metric
      ctx.writer.writePluginPart({
        type: 'plugin-analytics-ttft',
        data: {
          ttft: this.metrics.firstTokenTime - this.metrics.startTime,
        },
      });
    }

    // Count tokens
    if (chunk.type === 'text-delta') {
      this.metrics.tokenCount += chunk.delta.split(/\s+/).length;
    }

    // Track tool calls
    if (chunk.type === 'tool-call' && chunk.state === 'input-available') {
      this.metrics.toolCalls.push(chunk.toolName);
    }

    return chunk; // Pass through unchanged
  }

  async onStreamEnd(
    finalMessage: UIMessage,
    ctx: StreamingProcessorContext
  ): Promise<UIMessage> {
    const totalTime = Date.now() - this.metrics.startTime;

    // Save analytics
    await ctx.storage.set(`analytics:${ctx.requestId}`, {
      ...this.metrics,
      totalTime,
      tokensPerSecond: this.metrics.tokenCount / (totalTime / 1000),
    });

    return finalMessage;
  }
}
```

### 7.7 UI Integration for Streaming Parts

The chat UI needs to handle plugin stream parts:

```tsx
// ============================================================
// FILE: components/UnifiedChat/incantate/src/components/message/parts/PluginPart.tsx
// ============================================================

import { usePluginRegistry } from '@/features/plugins/hooks/usePluginRegistry';

interface PluginPartProps {
  part: PluginStreamPart;
  isStreaming: boolean;
}

export function PluginPart({ part, isStreaming }: PluginPartProps) {
  const registry = usePluginRegistry();

  // Extract plugin ID from part type (e.g., 'plugin-safety-warning' → 'safety')
  const pluginId = part.type.replace('plugin-', '').split('-')[0];

  // Get the renderer from the plugin
  const plugin = registry.getPlugin(pluginId);
  const renderer = plugin?.getStreamPartRenderer?.(part.type);

  if (!renderer) {
    // Fallback: render as JSON in dev mode
    if (process.env.NODE_ENV === 'development') {
      return (
        <pre className="text-xs bg-muted p-2 rounded">
          {JSON.stringify(part, null, 2)}
        </pre>
      );
    }
    return null;
  }

  const Component = renderer;
  return <Component part={part} isStreaming={isStreaming} />;
}
```

### 7.8 Key Streaming Considerations Summary

| Concern | Solution |
|---------|----------|
| **Partial data rendering** | Parse incomplete JSON, render progressive UI |
| **Tool state handling** | Components handle all 5 states |
| **Real-time processing** | `StreamingProcessor` with chunk-by-chunk methods |
| **Custom stream parts** | `PluginStreamPart` type with `plugin-*` prefix |
| **Analytics/metrics** | Emit `plugin-analytics-*` parts during stream |
| **Safety during stream** | Buffer + periodic scan, abort on critical |
| **Memory persistence** | Only in `onStreamEnd`, after complete message |
| **Error recovery** | `errorComponent` in tool renderers |

---

## 8. UI Integration Patterns

### 8.1 Admin UI Integration

The registry provides admin components to the admin dashboard:

```tsx
// ============================================================
// FILE: app/(admin)/tools/[slug]/settings/page.tsx
// Integration with tool settings page
// ============================================================

import { usePluginRegistry } from '@/features/plugins/hooks/usePluginRegistry';

export default function ToolSettingsPage({ params }: { params: { slug: string } }) {
  const registry = usePluginRegistry();

  // Get all admin components for 'tool-settings' placement
  const pluginComponents = registry.getAdminComponents()
    .filter(c => c.placement === 'tool-settings');

  return (
    <div className="space-y-8">
      <h1>Tool Settings: {params.slug}</h1>

      {/* Standard tool settings */}
      <StandardToolSettings slug={params.slug} />

      {/* Plugin-provided settings */}
      {pluginComponents.map(pluginComponent => {
        const { component: Component, id, name, permissions } = pluginComponent;

        // Check permissions
        if (!hasPermission(permissions)) return null;

        return (
          <section key={id} className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">{name}</h2>
            <Component
              config={registry.getPlugin(pluginComponent.pluginId)?.config}
              onConfigChange={(config) => registry.configure(pluginComponent.pluginId, config)}
              storage={registry.getPluginStorage(pluginComponent.pluginId)}
              userContext={getUserContext()}
            />
          </section>
        );
      })}
    </div>
  );
}
```

### 7.2 User UI Integration

The UnifiedChat component integrates plugin UI components:

```tsx
// ============================================================
// FILE: components/UnifiedChat/UnifiedChat.tsx
// Integration with chat UI
// ============================================================

import { usePluginRegistry } from '@/features/plugins/hooks/usePluginRegistry';
import { PluginUISlot } from '@/features/plugins/components/PluginUISlot';

export function UnifiedChat({ threadId, toolSlug }: UnifiedChatProps) {
  const registry = usePluginRegistry();

  return (
    <div className="flex flex-col h-full">
      {/* Header with plugin slots */}
      <header className="flex items-center gap-2 p-4 border-b">
        <h1>Chat</h1>
        <PluginUISlot
          placement="chat-header"
          context={{ threadId, toolSlug }}
        />
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.map(message => (
          <Message key={message.id} message={message}>
            {/* Plugin decorators for each message */}
            <PluginUISlot
              placement="message-decorator"
              context={{ threadId, toolSlug, message }}
            />
          </Message>
        ))}
      </div>

      {/* Input area with plugin toolbar */}
      <footer className="p-4 border-t">
        <PluginUISlot
          placement="input-toolbar"
          context={{ threadId, toolSlug }}
        />
        <ChatInput />
      </footer>

      {/* Footer widgets */}
      <PluginUISlot
        placement="chat-footer"
        context={{ threadId, toolSlug }}
      />
    </div>
  );
}
```

### 7.3 PluginUISlot Component

```tsx
// ============================================================
// FILE: features/plugins/components/PluginUISlot.tsx
// Renders all plugin components for a given placement
// ============================================================

import type { FC } from 'react';
import { usePluginRegistry } from '../hooks/usePluginRegistry';
import type { PluginUserComponentContext } from '../types';

interface PluginUISlotProps {
  placement: string;
  context: Partial<PluginUserComponentContext>;
}

export const PluginUISlot: FC<PluginUISlotProps> = ({ placement, context }) => {
  const registry = usePluginRegistry();

  // Get all user components for this placement
  const components = registry.getUserComponents()
    .filter(c => c.placement === placement);

  if (components.length === 0) return null;

  return (
    <>
      {components.map(pluginComponent => {
        const { component: Component, id, showWhen } = pluginComponent;

        // Check visibility condition
        if (showWhen && !showWhen(context as PluginUserComponentContext)) {
          return null;
        }

        return (
          <Component
            key={id}
            message={context.message}
            threadId={context.threadId!}
            storage={registry.getPluginStorage(pluginComponent.pluginId)}
            context={context as PluginRequestContext}
          />
        );
      })}
    </>
  );
};
```

---

## 9. Data Persistence Patterns

### 9.1 Storage Adapter Interface

Each plugin gets a scoped storage instance:

```typescript
// ============================================================
// FILE: lib/storage/PluginStorageAdapter.ts
// ============================================================

import type { PluginStorage, PluginId } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

interface StorageScope {
  threadId?: string;
  userId?: string;
  resourceId?: string;
}

export class SupabasePluginStorage implements PluginStorage {
  constructor(
    private supabase: SupabaseClient,
    private pluginId: PluginId,
    private scope: StorageScope = {}
  ) {}

  private buildKey(key: string): string {
    const parts = [this.pluginId];
    if (this.scope.userId) parts.push(`user:${this.scope.userId}`);
    if (this.scope.threadId) parts.push(`thread:${this.scope.threadId}`);
    if (this.scope.resourceId) parts.push(`resource:${this.scope.resourceId}`);
    parts.push(key);
    return parts.join(':');
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const { data } = await this.supabase
      .from('plugin_storage')
      .select('value')
      .eq('key', fullKey)
      .single();

    return data?.value as T ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const fullKey = this.buildKey(key);
    await this.supabase
      .from('plugin_storage')
      .upsert({
        key: fullKey,
        plugin_id: this.pluginId,
        scope_user_id: this.scope.userId,
        scope_thread_id: this.scope.threadId,
        scope_resource_id: this.scope.resourceId,
        value,
        updated_at: new Date().toISOString(),
      });
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);
    await this.supabase
      .from('plugin_storage')
      .delete()
      .eq('key', fullKey);
  }

  async list(prefix?: string): Promise<string[]> {
    const pattern = this.buildKey(prefix ?? '');
    const { data } = await this.supabase
      .from('plugin_storage')
      .select('key')
      .like('key', `${pattern}%`);

    return data?.map(d => d.key) ?? [];
  }

  scoped(scope: StorageScope): PluginStorage {
    return new SupabasePluginStorage(
      this.supabase,
      this.pluginId,
      { ...this.scope, ...scope }
    );
  }
}
```

### 9.2 Database Schema

```sql
-- ============================================================
-- FILE: supabase/migrations/YYYYMMDD_plugin_storage.sql
-- ============================================================

-- Plugin storage table for arbitrary key-value data
CREATE TABLE plugin_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  plugin_id TEXT NOT NULL,
  scope_user_id UUID REFERENCES auth.users(id),
  scope_thread_id BIGINT REFERENCES assistant_threads(id),
  scope_resource_id TEXT,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX idx_plugin_storage_plugin ON plugin_storage(plugin_id);
CREATE INDEX idx_plugin_storage_user ON plugin_storage(scope_user_id);
CREATE INDEX idx_plugin_storage_thread ON plugin_storage(scope_thread_id);
CREATE INDEX idx_plugin_storage_key_prefix ON plugin_storage(key text_pattern_ops);

-- Plugin configuration table
CREATE TABLE plugin_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id TEXT NOT NULL,
  tool_uuid UUID REFERENCES tools(uuid),
  org_id UUID,
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique per plugin + scope
  UNIQUE(plugin_id, tool_uuid, org_id)
);

-- Index for config lookups
CREATE INDEX idx_plugin_configs_lookup ON plugin_configs(plugin_id, tool_uuid);

-- RLS policies
ALTER TABLE plugin_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_configs ENABLE ROW LEVEL SECURITY;

-- Storage: users can access their own data
CREATE POLICY "Users can access their plugin storage"
  ON plugin_storage
  FOR ALL
  USING (scope_user_id = auth.uid());

-- Configs: admins can manage, users can read
CREATE POLICY "Admins can manage plugin configs"
  ON plugin_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'org-admin')
    )
  );
```

---

## 10. Configuration & Admin

### 10.1 Per-Tool Configuration

Each tool can have plugin-specific configuration:

```typescript
// ============================================================
// FILE: features/plugins/api/getToolPluginConfig.ts
// ============================================================

import { createServiceRoleSupabaseClient } from '@magicschool/supabase/clients/server';
import type { PluginId } from '../types';

interface ToolPluginConfig {
  pluginId: PluginId;
  config: unknown;
  enabled: boolean;
}

export async function getToolPluginConfigs(
  toolUuid: string,
  orgId?: string
): Promise<ToolPluginConfig[]> {
  const supabase = createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from('plugin_configs')
    .select('plugin_id, config, enabled')
    .or(`tool_uuid.eq.${toolUuid},tool_uuid.is.null`)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .order('tool_uuid', { nullsFirst: true }) // Global defaults first
    .order('org_id', { nullsFirst: true });   // Then org-specific

  if (error) throw error;

  // Merge configs (tool-specific overrides global)
  const configMap = new Map<PluginId, ToolPluginConfig>();

  for (const row of data ?? []) {
    const existing = configMap.get(row.plugin_id);
    if (existing) {
      // Merge, keeping more specific config
      configMap.set(row.plugin_id, {
        ...existing,
        config: { ...existing.config, ...row.config },
        enabled: row.enabled,
      });
    } else {
      configMap.set(row.plugin_id, row);
    }
  }

  return Array.from(configMap.values());
}
```

### 10.2 Global Admin Dashboard

```tsx
// ============================================================
// FILE: app/(admin)/plugins/page.tsx
// ============================================================

import { usePluginRegistry } from '@/features/plugins/hooks/usePluginRegistry';

export default function PluginAdminPage() {
  const registry = usePluginRegistry();
  const plugins = registry.listPlugins();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plugin Management</h1>

      <div className="grid gap-4">
        {plugins.map(plugin => (
          <PluginCard
            key={plugin.id}
            plugin={plugin}
            enabled={registry.isEnabled(plugin.id)}
            onToggle={() => {
              if (registry.isEnabled(plugin.id)) {
                registry.disable(plugin.id);
              } else {
                registry.enable(plugin.id);
              }
            }}
            onConfigure={() => openConfigModal(plugin.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 11. Implementation Roadmap

### Phase 1: Core Infrastructure (2-3 weeks)

- [ ] Define core TypeScript interfaces (`plugin.ts`, `registry.ts`)
- [ ] Implement `BasePlugin` abstract class
- [ ] Implement `ChatPluginRegistry` class
- [ ] Create `SupabasePluginStorage` adapter
- [ ] Database migrations for plugin storage
- [ ] Basic unit tests

### Phase 2: Built-in Plugins (2-3 weeks)

- [ ] Port existing token limiter to plugin format
- [ ] Port existing tool filter to plugin format
- [ ] Create `ChatMemoryPlugin` (wrapping Mastra memory)
- [ ] Create basic `SafetyProcessorPlugin` (moderation only)

### Phase 3: UI Integration (2 weeks)

- [ ] Create `PluginUISlot` component
- [ ] Integrate with UnifiedChat
- [ ] Create admin settings components
- [ ] Create user-facing components

### Phase 4: Advanced Features (2-3 weeks)

- [ ] Full SafetyProcessor (PII, injection)
- [ ] Memory browser admin UI
- [ ] Analytics/observability
- [ ] Plugin hot-reload in development

### Phase 5: Documentation & Polish (1 week)

- [ ] API documentation
- [ ] Plugin development guide
- [ ] Example plugins
- [ ] Performance optimization

---

## Appendix: Design Decisions

### Why Composition over Inheritance?

Plugins compose their capabilities (processors, tools, UI) rather than inheriting from base classes. This allows:

1. **Flexibility**: A plugin can provide just a processor, or tools + UI, or any combination
2. **Testing**: Each capability can be tested in isolation
3. **Tree-shaking**: Unused capabilities don't bloat bundles

### Why Plugin-Scoped Storage?

Each plugin gets isolated storage to:

1. **Prevent conflicts**: Plugins can't accidentally overwrite each other's data
2. **Enable cleanup**: When a plugin is removed, its data can be easily identified
3. **Support multi-tenancy**: Scoping by user/thread/resource is built-in

### Why Priority-Based Ordering?

Processors run in priority order (lower number = earlier) because:

1. **Predictable**: Developers know exactly when their code runs
2. **Configurable**: Priority can be adjusted without code changes
3. **Debuggable**: Easier to trace issues through a defined order

### Why Lazy Loading?

Plugins initialize on-demand to:

1. **Reduce startup time**: Only load what's needed
2. **Save memory**: Disabled plugins consume minimal resources
3. **Enable dynamic loading**: Plugins can be added at runtime

---

## References

- [Mastra.ai Documentation](https://mastra.ai/docs)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [MagicSchool Architecture (internal)](./mastra-memory-impact-analysis.md)
- [Plugin Architectures in JavaScript](https://css-tricks.com/designing-a-javascript-plugin-system/)
