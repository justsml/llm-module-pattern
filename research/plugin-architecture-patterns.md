# Plugin Architecture Patterns for TypeScript Monorepos

**Date**: 2026-02-04
**Status**: Complete
**Related Research**: AI Plugin System Design

## Executive Summary

After analyzing plugin architectures from Payload CMS, Medusa.js, Strapi, Vite, and TanStack Router, several key patterns emerge for building publishable, type-safe plugin packages in TypeScript monorepos. The most successful architectures use:

1. **Function-based plugin factories** that accept options and return configuration objects
2. **Dual export strategies** with development (TypeScript sources) and production (compiled JS + types) modes
3. **Optional property interfaces** for feature declaration with strong type safety
4. **Entry point separation** (index.ts for core, specialized exports for optional features)
5. **Hook-based extensibility** where plugins declare only the features they provide

These patterns are directly applicable to AI plugin systems where plugins may selectively provide tools, agents, UI components, processors, or storage capabilities.

## Research Objectives

- Understand how established TypeScript ecosystems structure publishable plugins
- Identify manifest patterns for declaring available plugin features
- Learn strategies for handling optional features with type safety
- Document package structure best practices for monorepo publishability
- Extract entry point patterns and their tradeoffs

## Findings

### 1. Payload CMS - Config Extension Pattern

#### Architecture Overview

Payload uses a **function-based plugin pattern** where plugins are functions that receive a config object and return a modified config.

**Core Pattern:**
```typescript
type Plugin = (incomingConfig: Config) => Config
```

**Example Plugin Structure:**
```typescript
export const myPlugin = (pluginOptions?: PluginOptions): Plugin => {
  return (incomingConfig: Config): Config => {
    return {
      ...incomingConfig,
      collections: [
        ...(incomingConfig.collections || []),
        // Add new collections
      ],
      hooks: {
        // Extend hooks (function properties require special handling)
      }
    }
  }
}
```

#### Key Principles

1. **Spread Syntax for Arrays**: Always spread existing arrays (collections, fields, etc.) to preserve existing data and avoid conflicts
2. **Function Property Extension**: For function properties (hooks, access control), execute the existing function first, then add new functionality
3. **NextJS-Style Composition**: Uses a `withPlugin()` pattern for chaining multiple plugins

#### Package Structure (Payload 3.x)

**Development vs Production Dual Export:**
```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./src/index.tsx",
      "types": "./src/index.tsx"
    },
    "./types": {
      "import": "./src/exports/types.ts",
      "types": "./src/exports/types.ts"
    },
    "./fields": {
      "import": "./src/exports/fields.ts",
      "types": "./src/exports/fields.ts"
    },
    "./client": {
      "import": "./src/exports/client.ts",
      "types": "./src/exports/client.ts"
    }
  },
  "publishConfig": {
    "exports": {
      ".": {
        "import": "./dist/index.js",
        "types": "./dist/index.d.ts"
      },
      "./types": {
        "import": "./dist/exports/types.js",
        "types": "./dist/exports/types.d.ts"
      }
      // ... mirrors development structure but points to dist/
    }
  }
}
```

**Key Insights:**
- During development: exports point to TypeScript source files for fast iteration
- During publishing: `publishConfig` overrides to point to compiled `.js` + `.d.ts` files
- Multiple entry points allow users to import specific plugin features
- ES modules first with `"type": "module"`

**Files Distribution:**
```json
{
  "files": ["dist", "README.md"]
}
```

#### Manifest Pattern

Payload doesn't use explicit manifests; instead, plugins **declaratively extend the config** with the features they provide. The config schema itself acts as the manifest through TypeScript types.

Optional features are handled through conditional logic within the plugin function:

```typescript
export const seoPlugin = (options?: SEOPluginOptions): Plugin => {
  return (config: Config): Config => {
    const newConfig = { ...config }

    // Optional: Add UI fields only if generateTitle is true
    if (options?.generateTitle) {
      // Add title generation fields
    }

    // Optional: Add image fields only if enabled
    if (options?.uploadsCollection) {
      // Add image fields
    }

    return newConfig
  }
}
```

---

### 2. Medusa.js - Module Definition Pattern

#### Architecture Overview

Medusa uses an **explicit module definition** pattern with a clear three-file structure:

**Required Files:**
1. **`index.ts`** - Exports the module definition using `Module()` function
2. **`service.ts`** - Contains the module's main service with business logic
3. **Optional directories**: `models/`, `migrations/`, `loaders/`

#### Module Definition Structure

**1. Data Model (`models/brand.ts`):**
```typescript
import { model } from "@medusajs/framework/utils"

export const Brand = model.define("brand", {
  id: model.id().primaryKey(),
  name: model.text(),
})
```

**2. Service (`service.ts`):**
```typescript
import { MedusaService } from "@medusajs/framework/utils"
import { Brand } from "./models/brand"

class BrandModuleService extends MedusaService({
  Brand,
}) {
  // Service automatically gets CRUD methods for Brand model
  // Add custom business logic methods here
}

export default BrandModuleService
```

**3. Module Definition (`index.ts`):**
```typescript
import MyService from "./service"
import { Module } from "@medusajs/framework/utils"

export const BRAND_MODULE = "brand"

export default Module(BRAND_MODULE, {
  service: MyService,
})
```

#### Manifest Pattern

Medusa's manifest is the **Module export itself**. The `Module()` function creates a structured definition that Medusa's core can introspect.

**Registration in `medusa-config.ts`:**
```typescript
module.exports = defineConfig({
  modules: [
    {
      resolve: "./src/modules/brand",
      options: {
        // Module-specific options
      }
    },
  ],
})
```

#### Optional Features

Modules declare features through:
1. **Conditional exports** - Include/exclude models, methods, or capabilities
2. **Service method presence** - Features exist if service methods are implemented
3. **Module options** - Configuration passed during registration controls behavior

**Example of Optional Loaders:**
```typescript
// loaders/custom-loader.ts (optional)
export default async function customLoader(container, options) {
  if (options.enableFeature) {
    // Initialize optional feature
  }
}
```

#### Key Insights

- **Service as Interface**: The service class acts as the public API; introspection reveals capabilities
- **Directory Structure Signals Intent**: Presence of `models/`, `migrations/`, etc. indicates what the module provides
- **Framework Registration**: Modules are registered in config, allowing the framework to discover and initialize them
- **Type Safety**: Service methods are fully typed, providing compile-time guarantees

---

### 3. Strapi - Server/Admin Split Pattern

#### Architecture Overview

Strapi plugins use a **dual-context architecture** with separate server and admin entry points.

**Plugin Structure:**
```
src/
├── server/
│   ├── index.ts          # Server-side features
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── content-types/
│   └── policies/
└── admin/
    ├── src/
    │   └── index.tsx     # Admin panel features
    └── app.example.tsx
```

#### Server Entry Point (`server/index.ts`)

**Structure:**
```typescript
export default {
  register({ strapi }) {
    // Called during plugin registration
    // Register custom functionality
  },

  bootstrap({ strapi }) {
    // Called after all plugins are registered
    // Initialize features that depend on other plugins
  },

  destroy({ strapi }) {
    // Cleanup when Strapi shuts down
  },

  config: {
    default: {
      // Default plugin configuration
    },
    validator: (config) => {
      // Validate configuration
    }
  },

  // Optional feature exports
  controllers,
  services,
  routes,
  contentTypes,
  policies,
  middlewares,
}
```

#### Admin Entry Point (`admin/src/index.tsx`)

**Structure:**
```typescript
export default {
  register(app) {
    // Register admin panel features
    // Add menu links, reducers, settings pages, etc.
  },

  bootstrap(app) {
    // Bootstrap admin-specific features
  },

  registerTrads({ locales }) {
    // Register translations
  },
}
```

#### Manifest Pattern

Strapi's manifest is **implicitly defined by exported properties**:
- If a plugin exports `controllers`, it has controller features
- If it exports `services`, it has service features
- If it exports `routes`, it has route features
- Admin features are separate from server features

**All features are optional** - plugins only export what they implement.

#### Type Safety Pattern

**Plugin Interface (TypeScript):**
```typescript
interface StrapiPlugin {
  register?: (context: { strapi: Strapi }) => void | Promise<void>
  bootstrap?: (context: { strapi: Strapi }) => void | Promise<void>
  destroy?: (context: { strapi: Strapi }) => void | Promise<void>
  config?: {
    default?: Record<string, any>
    validator?: (config: any) => void
  }
  controllers?: Record<string, Controller>
  services?: Record<string, Service>
  routes?: Routes[]
  contentTypes?: Record<string, ContentType>
  policies?: Record<string, Policy>
  middlewares?: Record<string, Middleware>
}
```

All properties are optional via `?`, enabling flexible plugin composition.

#### Package Structure

**Basic exports:**
```json
{
  "main": "./dist/server/index.js",
  "types": "./dist/server/index.d.ts",
  "exports": {
    "./strapi-admin": {
      "types": "./dist/admin/src/index.d.ts",
      "import": "./dist/admin/src/index.js"
    },
    "./strapi-server": {
      "types": "./dist/server/index.d.ts",
      "import": "./dist/server/index.js"
    },
    "./package.json": "./package.json"
  }
}
```

**Key Insights:**
- Named exports for different contexts (`strapi-admin`, `strapi-server`)
- Clear separation between frontend and backend features
- Users explicitly import the context they need

---

### 4. Vite - Hook-Based Plugin Pattern

#### Architecture Overview

Vite plugins use a **hook-based architecture** where plugins are objects with a name and optional hook functions.

**Core Plugin Structure:**
```typescript
interface Plugin {
  name: string                    // Required: unique plugin name
  enforce?: 'pre' | 'post'        // Optional: execution order
  apply?: 'serve' | 'build' | ((config, env) => boolean)  // Optional: conditional application

  // Optional Hooks (only implement what you need)
  config?(config, env): UserConfig | null | void
  configResolved?(config): void | Promise<void>
  configureServer?(server): (() => void) | void | Promise<() => void>
  transformIndexHtml?(html, ctx): IndexHtmlTransformResult | void | Promise<IndexHtmlTransformResult>
  resolveId?(id, importer, options): ResolveIdResult
  load?(id): LoadResult
  transform?(code, id): TransformResult
  // ... many more optional hooks
}
```

#### Plugin Factory Pattern

**Typical Implementation:**
```typescript
export function myPlugin(options: PluginOptions = {}): Plugin {
  return {
    name: 'vite-plugin-my-feature',
    enforce: 'pre',

    // Only implement hooks you need
    config(config) {
      // Modify config if needed
      if (options.modifyConfig) {
        return { /* partial config */ }
      }
    },

    transform(code, id) {
      // Only transform files you care about
      if (!id.endsWith('.special')) return null

      return {
        code: transformCode(code),
        map: null
      }
    }
  }
}
```

#### Hook Filtering (Performance Optimization)

**Modern Pattern (Vite 6.3.0+, Rollup 4.38.0+):**
```typescript
export function myPlugin(): Plugin {
  const jsFileRegex = /\.js$/

  return {
    name: 'my-plugin',
    transform: {
      filter: {
        id: jsFileRegex,  // Only call hook for .js files
      },
      handler(code, id) {
        // Backward compatibility check
        if (!jsFileRegex.test(id)) return null

        return {
          code: transformCode(code),
          map: null,
        }
      }
    }
  }
}
```

#### Manifest Pattern

Vite plugins **self-describe through presence of hooks**:
- No explicit manifest needed
- Framework calls available hooks at appropriate times
- Plugins that don't implement a hook are simply skipped for that phase
- Hook presence = feature availability

#### Type Safety

**Full TypeScript support:**
```typescript
import type { Plugin } from 'vite'

export function myPlugin(): Plugin {
  return {
    name: 'my-plugin',
    // TypeScript ensures only valid hooks and properties
  }
}
```

#### Conditional Features

**1. Conditional Hook Implementation:**
```typescript
export function myPlugin(options: PluginOptions): Plugin {
  const plugin: Plugin = {
    name: 'my-plugin',
  }

  // Add hooks based on options
  if (options.enableTransform) {
    plugin.transform = function(code, id) {
      // Transform logic
    }
  }

  if (options.enableHMR) {
    plugin.handleHotUpdate = function(ctx) {
      // HMR logic
    }
  }

  return plugin
}
```

**2. Apply-Time Filtering:**
```typescript
export function myPlugin(): Plugin {
  return {
    name: 'my-plugin',
    apply: 'build',  // Only active during build, not dev server
    // ... hooks
  }
}
```

**3. Enforce for Ordering:**
```typescript
export function myPlugin(): Plugin {
  return {
    name: 'my-plugin',
    enforce: 'pre',  // Run before Vite core plugins
    // ... hooks
  }
}
```

#### Key Insights

- **Hooks are the API**: Plugin capability is defined by which hooks are implemented
- **Minimal Interface**: Only `name` is required; everything else is optional
- **Performance-Conscious**: Hook filters avoid unnecessary invocations
- **Highly Composable**: Multiple plugins work together through hook execution order
- **Type-Safe**: Full TypeScript definitions for all hooks and options

---

### 5. TanStack Router - Type-First Plugin Pattern

#### Architecture Overview

TanStack Router emphasizes **compile-time type generation** and **build-tool plugins** for code generation and type safety.

**Key Characteristics:**
- TypeScript-first design with extensive use of generics
- File-based routing powered by bundler plugins (Vite, Webpack, etc.)
- Generated route trees with full type inference
- Plugin generates boilerplate, not runtime features

#### Plugin Architecture

**TanStack Router Bundler Plugin:**
```typescript
// Vite config example
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default {
  plugins: [
    TanStackRouterVite({
      // Plugin generates:
      // 1. Route configuration boilerplate
      // 2. Route tree stitching
      // 3. Automatic code splitting

      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    })
  ]
}
```

#### Type Generation Pattern

**Generated Route Tree (`routeTree.gen.ts`):**
```typescript
// Auto-generated by TanStack Router plugin
import type { Route } from '@tanstack/router'

export const routeTree = {
  // Fully typed route structure
  // Enables 100% type-safe navigation
}

declare module '@tanstack/router' {
  interface Register {
    router: typeof routeTree
  }
}
```

#### Manifest Pattern

TanStack Router's "manifest" is the **generated type declarations**:
- Route configuration is inferred from file structure
- Types propagate throughout the application
- No runtime manifest needed - all information is in types

**User-Facing Generated Code:**
The file-based routing is "uniquely user-facing" - developers can see and modify the generated route configuration, maintaining control while benefiting from automation.

#### Plugin Interface

Unlike runtime plugins, TanStack Router plugins are **build-time code generators**:

```typescript
interface TanStackRouterPlugin {
  // Scans file system for routes
  // Generates TypeScript code
  // Emits type declarations
  // Configures code splitting

  routesDirectory?: string
  generatedRouteTree?: string
  quoteStyle?: 'single' | 'double'
  // ... configuration options
}
```

#### Key Insights

- **Build-Time vs Runtime**: Plugin works during build, not at runtime
- **Type Safety is the Feature**: The primary plugin output is TypeScript types
- **Generated Code is Transparent**: Developers see and can modify generated files
- **No Runtime Overhead**: All plugin work happens at build time
- **Framework-Agnostic Pattern**: Can work with different bundlers (Vite, Webpack, etc.)

This pattern is **less applicable** to AI plugin systems (which need runtime features), but demonstrates the value of **type generation** for plugin manifests.

---

## Comparative Analysis

### Feature Declaration Strategies

| System | Strategy | Explicit Manifest | Type Safety | Discoverability |
|--------|----------|-------------------|-------------|-----------------|
| **Payload CMS** | Config extension with spread syntax | ❌ No (implicit in config) | ✅ Full | Config schema |
| **Medusa.js** | Module() function with service | ✅ Yes (Module export) | ✅ Full | Service introspection |
| **Strapi** | Object with optional properties | ⚠️ Partial (property presence) | ✅ Full | Export inspection |
| **Vite** | Hook presence pattern | ❌ No (hooks = features) | ✅ Full | Hook enumeration |
| **TanStack** | Build-time type generation | ✅ Yes (generated types) | ✅✅ Strongest | Type system |

### Optional Feature Handling

| System | Pattern | Example |
|--------|---------|---------|
| **Payload CMS** | Conditional logic in plugin function | `if (options.enableFeature) { config.collections.push(...) }` |
| **Medusa.js** | Optional directories and service methods | Presence of `models/`, `loaders/` directories |
| **Strapi** | Optional object properties with `?` | `controllers?: Record<string, Controller>` |
| **Vite** | Optional hook implementations | Only implement `transform` if plugin transforms code |
| **TanStack** | Build-time configuration | Plugin options control generated code |

### Package Structure Patterns

#### Development vs Production Exports

**Winner: Payload CMS**
- Uses `exports` for TypeScript sources in development
- Uses `publishConfig.exports` for compiled `.js` + `.d.ts` in production
- Seamless developer experience with fast iteration

**Pattern:**
```json
{
  "exports": { ".": { "import": "./src/index.ts" } },
  "publishConfig": {
    "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }
  }
}
```

#### Multiple Entry Points

**Winner: Payload CMS, Strapi**
- Allow importing specific plugin features
- Reduce bundle size by avoiding unused code
- Clear API boundaries

**Pattern:**
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client.js",
    "./server": "./dist/server.js",
    "./types": "./dist/types.js"
  }
}
```

#### ES Modules First

**All systems:** Use `"type": "module"` for modern ES module support

### Type Safety Approaches

| System | Type Safety Method | Strength |
|--------|-------------------|----------|
| **Payload CMS** | Generic config types | Strong - full config typing |
| **Medusa.js** | Service class types | Strong - OOP with inheritance |
| **Strapi** | Interface with optional properties | Strong - explicit plugin interface |
| **Vite** | Plugin interface definition | Strong - hook signatures enforced |
| **TanStack** | Generated declaration merging | Strongest - compile-time guarantees |

### Entry Point Patterns

#### Single Entry (index.ts)

**Used by:** Medusa.js, Vite
- Simple, single export
- Plugin factory or definition
- Works well for focused plugins

```typescript
// index.ts
export default function myPlugin(options) {
  // Return plugin definition
}
```

#### Multiple Entry (index + specialized)

**Used by:** Payload CMS, Strapi
- Separate concerns (client/server, types/runtime)
- Better code splitting
- Clearer API boundaries

```
index.ts        # Main plugin
client.ts       # Client-only features
server.ts       # Server-only features
types.ts        # Type exports only
```

#### Config Entry (separate config file)

**Less common** - Most systems use index.ts as both entry and config export

---

## Recommendations for AI Plugin Systems

Based on this research, here are architecture recommendations for an AI plugin system where plugins may provide **tools, agents, UI components, processors, and/or storage**.

### 1. Plugin Definition Pattern

**Recommended: Hybrid of Vite + Strapi Patterns**

Use a **hook-based approach with optional properties** for clear feature declaration:

```typescript
interface AIPluginDefinition {
  // Required
  name: string
  version: string

  // Optional feature declarations
  tools?: ToolDefinition[]
  agents?: AgentDefinition[]
  ui?: UIComponentDefinition[]
  processors?: ProcessorDefinition[]
  storage?: StorageDefinition

  // Lifecycle hooks (optional)
  register?(context: PluginContext): void | Promise<void>
  initialize?(context: PluginContext): void | Promise<void>
  destroy?(context: PluginContext): void | Promise<void>

  // Configuration
  config?: {
    default?: Record<string, any>
    schema?: JSONSchema  // Runtime validation
  }
}

// Plugin factory pattern
export function definePlugin(definition: AIPluginDefinition): AIPlugin {
  return createPlugin(definition)
}
```

**Why this approach:**
- ✅ Clear declaration of available features through property presence
- ✅ Type-safe with full TypeScript support
- ✅ Flexible - only implement features you need
- ✅ Inspectable - can enumerate available features at runtime
- ✅ Familiar pattern from Vite and Strapi

### 2. Optional Feature Declaration

**Pattern: Optional Properties + Type Guards**

```typescript
interface AIPluginDefinition {
  name: string
  tools?: {
    list: ToolDefinition[]
    register?(context: ToolContext): void
  }
  agents?: {
    list: AgentDefinition[]
    factory?: AgentFactory
  }
  ui?: {
    components: ComponentDefinition[]
    routes?: RouteDefinition[]
  }
}

// Type guards for feature detection
function hasTools(plugin: AIPlugin): plugin is AIPlugin & { tools: NonNullable<AIPluginDefinition['tools']> } {
  return plugin.tools !== undefined
}

function hasAgents(plugin: AIPlugin): plugin is AIPlugin & { agents: NonNullable<AIPluginDefinition['agents']> } {
  return plugin.agents !== undefined
}

// Usage
if (hasTools(plugin)) {
  plugin.tools.list.forEach(registerTool)
}
```

**Why this approach:**
- ✅ Type-safe feature detection
- ✅ Optional features are genuinely optional
- ✅ No runtime overhead for unused features
- ✅ Clear from TypeScript what features are available

### 3. Package Structure for Publishability

**Recommended: Payload CMS Dual-Export Pattern**

```json
{
  "name": "@my-scope/ai-plugin-example",
  "version": "1.0.0",
  "type": "module",

  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./tools": {
      "import": "./src/tools/index.ts",
      "types": "./src/tools/index.ts"
    },
    "./agents": {
      "import": "./src/agents/index.ts",
      "types": "./src/agents/index.ts"
    },
    "./ui": {
      "import": "./src/ui/index.ts",
      "types": "./src/ui/index.ts"
    }
  },

  "publishConfig": {
    "exports": {
      ".": {
        "import": "./dist/index.js",
        "types": "./dist/index.d.ts"
      },
      "./tools": {
        "import": "./dist/tools/index.js",
        "types": "./dist/tools/index.d.ts"
      },
      "./agents": {
        "import": "./dist/agents/index.js",
        "types": "./dist/agents/index.d.ts"
      },
      "./ui": {
        "import": "./dist/ui/index.js",
        "types": "./dist/ui/index.d.ts"
      }
    }
  },

  "files": ["dist", "README.md"],

  "scripts": {
    "build": "tsc",
    "prepublishOnly": "pnpm build"
  },

  "peerDependencies": {
    "@ai-system/core": "^1.0.0"
  }
}
```

**Why this approach:**
- ✅ Fast development iteration (TypeScript sources)
- ✅ Proper publishing (compiled JS + types)
- ✅ Multiple entry points for tree-shaking
- ✅ Works in monorepos with workspace references

### 4. Entry Point Organization

**Recommended Structure:**

```
src/
├── index.ts              # Main plugin export & definition
├── tools/
│   ├── index.ts          # Tool exports
│   ├── tool-a.ts
│   └── tool-b.ts
├── agents/
│   ├── index.ts          # Agent exports
│   └── agent-example.ts
├── ui/
│   ├── index.ts          # UI component exports
│   └── components/
├── processors/
│   ├── index.ts          # Processor exports
│   └── processor-impl.ts
├── storage/
│   ├── index.ts          # Storage adapter export
│   └── adapter.ts
└── types.ts              # Shared type definitions
```

**Main Entry Point (`src/index.ts`):**

```typescript
import type { AIPluginDefinition } from '@ai-system/core'
import { tools } from './tools'
import { agents } from './agents'
import { ui } from './ui'
import { processors } from './processors'
import { storage } from './storage'

export const myPlugin: AIPluginDefinition = {
  name: 'my-ai-plugin',
  version: '1.0.0',

  // Only include features you implement
  tools: {
    list: tools,
  },

  agents: {
    list: agents,
  },

  ui: {
    components: ui.components,
  },

  // Lifecycle
  async initialize(context) {
    // Setup logic
  }
}

export default myPlugin

// Re-export for separate imports
export { tools } from './tools'
export { agents } from './agents'
export { ui } from './ui'
export type * from './types'
```

**Why this approach:**
- ✅ Single default export for simple usage
- ✅ Named exports for granular imports
- ✅ Clear separation of concerns
- ✅ Scales well as plugins grow

### 5. Type Safety Pattern

**Recommended: Generic Plugin Builder with Type Inference**

```typescript
// Core plugin builder with type inference
export function definePlugin<
  T extends Partial<AIPluginDefinition>
>(definition: T & Pick<AIPluginDefinition, 'name' | 'version'>): AIPlugin<T> {
  return {
    ...definition,
    // Internal plugin implementation
  } as AIPlugin<T>
}

// Type-safe plugin interface
type AIPlugin<T extends Partial<AIPluginDefinition>> = {
  name: string
  version: string
} & T

// Usage - types are automatically inferred
export const myPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',

  tools: {
    list: [
      { name: 'search', execute: async () => {} }
    ]
  },
  // agents, ui, etc. are optional and type-safe
})

// TypeScript knows myPlugin has tools but not agents
myPlugin.tools.list  // ✅ Type-safe
myPlugin.agents      // ❌ Type error - property doesn't exist
```

**Why this approach:**
- ✅ Full type inference - no redundant type annotations
- ✅ Compile-time safety for plugin features
- ✅ IDE autocomplete for available features
- ✅ Prevents accessing undefined features

### 6. Manifest Generation Pattern

**Recommended: Runtime Introspection + Optional Static Manifest**

**Runtime Introspection:**
```typescript
export function getPluginManifest(plugin: AIPlugin): PluginManifest {
  return {
    name: plugin.name,
    version: plugin.version,
    features: {
      hasTools: plugin.tools !== undefined,
      hasAgents: plugin.agents !== undefined,
      hasUI: plugin.ui !== undefined,
      hasProcessors: plugin.processors !== undefined,
      hasStorage: plugin.storage !== undefined,
    },
    toolCount: plugin.tools?.list.length ?? 0,
    agentCount: plugin.agents?.list.length ?? 0,
    // ... etc
  }
}
```

**Optional Static Manifest (for discoverability):**
```json
{
  "name": "my-ai-plugin",
  "version": "1.0.0",
  "features": ["tools", "agents"],
  "tools": [
    { "name": "search", "description": "..." },
    { "name": "analyze", "description": "..." }
  ],
  "agents": [
    { "name": "assistant", "description": "..." }
  ]
}
```

Export manifest for plugin registry or marketplace discovery.

**Why this approach:**
- ✅ Runtime: Always accurate, generated from actual plugin
- ✅ Static: Good for discovery without loading plugin
- ✅ Hybrid: Both approaches complement each other

### 7. Configuration Pattern

**Recommended: Zod Schema + Type Inference**

```typescript
import { z } from 'zod'

// Define configuration schema
const ConfigSchema = z.object({
  apiKey: z.string().optional(),
  enableFeatureX: z.boolean().default(true),
  retries: z.number().int().min(0).max(5).default(3),
})

type Config = z.infer<typeof ConfigSchema>

export const myPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',

  config: {
    schema: ConfigSchema,
    default: {
      enableFeatureX: true,
      retries: 3,
    }
  },

  tools: {
    list: [/* tools can access validated config */]
  }
})
```

**Why this approach:**
- ✅ Runtime validation of configuration
- ✅ Type inference from schema
- ✅ Clear error messages for invalid config
- ✅ Self-documenting through schema

---

## Implementation Considerations

### Monorepo Setup

**For Internal Plugins (Development):**
```json
{
  "name": "@my-scope/plugin-internal",
  "exports": {
    ".": "./src/index.ts"  // Point to TypeScript sources
  }
}
```

**For Publishable Plugins:**
```json
{
  "name": "@my-scope/plugin-publishable",
  "exports": {
    ".": "./src/index.ts"
  },
  "publishConfig": {
    "exports": {
      ".": {
        "import": "./dist/index.js",
        "types": "./dist/index.d.ts"
      }
    }
  }
}
```

Use workspace protocols (`workspace:*`) for internal dependencies, which get resolved to proper versions on publish.

### Build Configuration

**TypeScript Config for Plugins:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules"]
}
```

### Plugin Registry Pattern

**For loading and managing plugins:**

```typescript
class PluginRegistry {
  private plugins = new Map<string, AIPlugin>()

  register(plugin: AIPlugin) {
    // Validate plugin
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} already registered`)
    }

    // Store plugin
    this.plugins.set(plugin.name, plugin)

    // Call lifecycle hooks
    plugin.register?.(this.createContext())
  }

  getTools(): ToolDefinition[] {
    return Array.from(this.plugins.values())
      .flatMap(p => p.tools?.list ?? [])
  }

  getAgents(): AgentDefinition[] {
    return Array.from(this.plugins.values())
      .flatMap(p => p.agents?.list ?? [])
  }

  // ... similar for other features
}
```

### Plugin Composition

**Allow plugins to depend on or extend other plugins:**

```typescript
export const myPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',

  dependencies: ['base-plugin'],  // Declare dependencies

  async register(context) {
    const basePlugin = context.getPlugin('base-plugin')
    // Extend or use base plugin features
  }
})
```

### Testing Strategy

**Test plugins in isolation:**

```typescript
import { describe, it, expect } from 'vitest'
import { createMockContext } from '@ai-system/test-utils'
import myPlugin from '../src/index'

describe('myPlugin', () => {
  it('provides expected tools', () => {
    expect(myPlugin.tools?.list).toHaveLength(2)
    expect(myPlugin.tools?.list[0].name).toBe('search')
  })

  it('initializes without errors', async () => {
    const context = createMockContext()
    await expect(myPlugin.initialize?.(context)).resolves.not.toThrow()
  })
})
```

---

## Open Questions

1. **Dynamic Plugin Loading**: Should plugins be loadable at runtime, or only at build/startup time?
   - **Runtime loading** enables plugin marketplaces and user-installed plugins
   - **Build-time only** is simpler and more secure

2. **Plugin Versioning**: How to handle breaking changes in plugin API?
   - Consider semantic versioning for plugin interface
   - Version compatibility matrix
   - Deprecation strategies

3. **Plugin Sandboxing**: How to ensure plugins don't interfere with each other or the core system?
   - Consider running plugins in isolated contexts
   - Resource limits (memory, CPU, API calls)
   - Permission system for sensitive operations

4. **Hot Module Replacement**: Should plugins support HMR in development?
   - Vite-style HMR for plugin development
   - State preservation between reloads
   - Partial plugin reloading

5. **Cross-Plugin Communication**: Should plugins be able to communicate with each other?
   - Event bus for plugin-to-plugin messages
   - Shared state management
   - Service discovery

---

## References

### Payload CMS
- [Plugins Overview](https://payloadcms.com/docs/plugins/overview)
- [Building Your Own Plugin](https://payloadcms.com/docs/plugins/build-your-own)
- [Plugin SEO Package.json](https://github.com/payloadcms/plugin-seo/blob/main/package.json)
- [Plugin Template Package.json](https://github.com/payloadcms/plugin-template/blob/main/package.json)
- [Payload Config Types](https://github.com/payloadcms/payload/blob/main/packages/payload/src/config/types.ts)

### Medusa.js
- [Modules Fundamentals](https://docs.medusajs.com/learn/fundamentals/modules)
- [Modules Directory Structure](https://docs.medusajs.com/learn/fundamentals/modules/modules-directory-structure)
- [Guide: Implement Brand Module](https://docs.medusajs.com/learn/customization/custom-features/module)
- [Architecture Overview](https://docs.medusajs.com/v1/development/fundamentals/architecture-overview)

### Strapi
- [Developing Plugins](https://docs.strapi.io/dev-docs/plugins-development)
- [Server API for Plugins](https://docs.strapi.io/cms/plugins-development/server-api)
- [Admin Panel API](https://docs.strapi.io/cms/plugins-development/admin-panel-api)
- [TypeScript Development](https://docs.strapi.io/cms/typescript/development)
- [Building a Plugin with TypeScript](https://strapi.io/blog/how-to-build-a-plugin-with-typescript)

### Vite
- [Plugin API](https://vite.dev/guide/api-plugin)
- [How to Write Vite Plugin](https://medium.com/@turingvang/how-to-write-vite-plugin-d8580153ee97)
- [Building a Plugin with Vite](https://www.vuemastery.com/blog/building-a-plugin-with-vite/)
- [Environment API for Plugins](https://vite.dev/guide/api-environment-plugins)

### TanStack Router
- [TanStack Router Overview](https://tanstack.com/router/latest/docs/framework/react/overview)
- [Decisions on Developer Experience](https://tanstack.com/router/latest/docs/framework/react/decisions-on-dx)
- [TanStack Ecosystem Guide 2026](https://www.codewithseb.com/blog/tanstack-ecosystem-complete-guide-2026)

### TypeScript & Monorepos
- [Managing TypeScript Packages in Monorepos](https://nx.dev/blog/managing-ts-packages-in-monorepos)
- [TypeScript Monorepo Guide](https://cryogenicplanet.tech/posts/typescript-monorepo)
- [Live Types in a TypeScript Monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo)
- [Internal Packages - Turborepo](https://turborepo.dev/docs/core-concepts/internal-packages)

### Design Patterns
- [TypeScript Optional Properties](https://www.geeksforgeeks.org/typescript/typescript-optional-properties-type/)
- [Factory Pattern in TypeScript](https://refactoring.guru/design-patterns/factory-method/typescript/example)
- [TypeScript Factory Pattern with Parameters](https://copyprogramming.com/howto/typescript-factory-pattern-with-parameters)

### AI Systems
- [AI SDK Agents Overview](https://ai-sdk.dev/docs/agents/overview)
- [AI SDK Agents Workflows](https://ai-sdk.dev/docs/agents/workflows)
- [Microsoft 365 Declarative Agents](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/overview-declarative-agent)
- [TypeSpec for Building Declarative Agents](https://www.voitanos.io/blog/microsoft-365-copilot-declarative-agent-typespec-101/)
