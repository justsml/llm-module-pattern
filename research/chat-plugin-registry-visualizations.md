# Chat Plugin Registry Design - Visualizations

This document contains visual diagrams for the Chat Plugin Registry architecture described in [`chat-plugin-registry-design.md`](./chat-plugin-registry-design.md).

## 1. Plugin Registry Architecture Overview

```mermaid
graph TB
    subgraph "ChatPluginRegistry"
        Registry[Registry Core<br/>Map&lt;string, ChatPlugin&gt;]
        Config[Configuration<br/>Manager]
        Storage[Storage<br/>Factory]
    end

    subgraph "Plugin Ecosystem"
        Safety[Safety Processor<br/>🛡️<br/>• Moderation<br/>• PII Detection<br/>• Injection Prevention]
        Memory[Chat Memory<br/>🧠<br/>• Semantic Recall<br/>• Working Memory<br/>• Message History]
        Custom[Custom Tool<br/>⚙️<br/>• Domain Logic<br/>• Integrations]
        Analytics[Analytics<br/>📊<br/>• Metrics<br/>• Logging]
        Rubric[Rubric Feedback<br/>📋<br/>• Assessment<br/>• Grading]
    end

    subgraph "Processing Pipeline"
        Input[Input<br/>Processors]
        LLM[LLM<br/>Invocation]
        Output[Output<br/>Processors]
    end

    Registry --> Safety
    Registry --> Memory
    Registry --> Custom
    Registry --> Analytics
    Registry --> Rubric

    Safety --> Input
    Memory --> Input
    Custom --> Input

    Input --> LLM
    LLM --> Output

    Safety --> Output
    Memory --> Output
    Analytics --> Output

    Config --> Registry
    Storage --> Registry

    style Registry fill:#4169e1,stroke:#000,stroke-width:3px,color:#fff
    style Safety fill:#dc143c,stroke:#000,stroke-width:2px,color:#fff
    style Memory fill:#9370db,stroke:#000,stroke-width:2px,color:#fff
    style Custom fill:#20b2aa,stroke:#000,stroke-width:2px,color:#fff
    style Analytics fill:#ff8c00,stroke:#000,stroke-width:2px,color:#fff
    style Rubric fill:#32cd32,stroke:#000,stroke-width:2px,color:#fff
    style LLM fill:#ffd700,stroke:#000,stroke-width:3px,color:#000
```

## 2. Plugin Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Definition: Plugin Module Export
    Definition --> Registered: register()

    Registered --> Initializing: initialize(config)
    Initializing --> Active: onReady()
    Initializing --> Error: Initialization Failed

    Active --> Disabled: disable()
    Active --> Error: Runtime Error

    Disabled --> Registered: enable()
    Disabled --> Destroyed: destroy()

    Error --> Disabled: Handled & Disabled
    Error --> Destroyed: Unrecoverable

    Destroyed --> [*]: Cleanup Complete

    note right of Active
        Plugin fully operational:
        - Processes requests
        - Provides tools
        - Renders UI components
        - Persists data
    end note

    note right of Disabled
        Plugin inactive:
        - Config preserved
        - No request processing
        - Can be re-enabled
    end note
```

## 3. Request Flow with Plugin Processing

```mermaid
sequenceDiagram
    participant User
    participant Registry as ChatPluginRegistry
    participant PluginA as Plugin A (Safety)
    participant PluginB as Plugin B (Memory)
    participant LLM
    participant Storage

    User->>Registry: Send Message

    Note over Registry: Phase 1: Input Processing
    Registry->>PluginA: onRequestStart(ctx)
    Registry->>PluginB: onRequestStart(ctx)

    Registry->>PluginA: getInputProcessors()
    PluginA-->>Registry: [PIIProcessor, InjectionProcessor]
    Registry->>PluginB: getInputProcessors()
    PluginB-->>Registry: [MemoryInjector]

    Note over Registry: Run processors in priority order
    Registry->>Registry: Process with priorities

    Note over Registry: Phase 2: Gather Context
    Registry->>PluginB: getMemoryConfig()
    PluginB->>Storage: Get working memory
    Storage-->>PluginB: Memory data
    PluginB-->>Registry: Memory context

    Registry->>PluginA: getTools()
    PluginA-->>Registry: [ ]
    Registry->>PluginB: getTools()
    PluginB-->>Registry: [updateWorkingMemory]

    Note over Registry: Phase 3: LLM Invocation
    Registry->>LLM: Invoke with:<br/>- Processed message<br/>- Memory context<br/>- Available tools
    LLM-->>Registry: Response (streaming)

    Note over Registry: Phase 4: Output Processing
    Registry->>PluginA: getOutputProcessors()
    PluginA-->>Registry: [OutputModeration]
    Registry->>PluginB: getOutputProcessors()
    PluginB-->>Registry: [MemoryPersister]

    Registry->>Registry: Process output

    Note over Registry: Phase 5: Persistence
    Registry->>PluginB: Persist memory updates
    PluginB->>Storage: Save embeddings & working memory
    Registry->>PluginA: Save audit logs
    PluginA->>Storage: Write safety events

    Registry->>PluginA: onRequestEnd(ctx)
    Registry->>PluginB: onRequestEnd(ctx)

    Registry-->>User: Final Response
```

## 4. Plugin Interface Hierarchy

```mermaid
classDiagram
    class ChatPlugin {
        <<interface>>
        +PluginManifest manifest
        +PluginConfigSchema configSchema
        +TConfig config
        +PluginState state
        +PluginHooks hooks
        +initialize(config, storage) Promise~void~
        +getInputProcessors(ctx) Processor[]
        +getOutputProcessors(ctx) Processor[]
        +getTools(ctx) Tool[]
        +getMemoryConfig(ctx) PluginMemoryConfig
        +getAdminComponents() PluginAdminComponent[]
        +getUserComponents() PluginUserComponent[]
        +disable() Promise~void~
        +destroy() Promise~void~
    }

    class BasePlugin {
        <<abstract>>
        #storage: PluginStorage
        #_state: PluginState
        #setState(state)
        #onInitialize() Promise~void~
        +initialize(config, storage)
        +disable()
        +destroy()
    }

    class PluginManifest {
        +PluginId id
        +string name
        +string version
        +string description
        +string author
        +PluginPriority priority
        +PluginId[] dependencies
        +string[] features
        +string[] tags
        +boolean enabledByDefault
    }

    class PluginRequestContext {
        +string requestId
        +string threadId
        +string userId
        +string resourceId
        +string toolSlug
        +string customizationId
        +string locale
        +Record metadata
        +AbortController abortController
    }

    class PluginStorage {
        <<interface>>
        +get~T~(key) Promise~T|null~
        +set~T~(key, value) Promise~void~
        +delete(key) Promise~void~
        +list(prefix) Promise~string[]~
        +scoped(scope) PluginStorage
    }

    class PluginHooks {
        +onRegister() void|Promise
        +onConfigure(config) void|Promise
        +onReady() void|Promise
        +onRequestStart(ctx) void|Promise
        +onRequestEnd(ctx) void|Promise
        +onDisable() void|Promise
        +onDestroy() void|Promise
        +onError(error) void|Promise
    }

    class SafetyProcessorPlugin {
        +manifest: PluginManifest
        +config: SafetyProcessorConfig
        +getInputProcessors(ctx)
        +getOutputProcessors(ctx)
        +getAdminComponents()
        +getUserComponents()
        -getStrategyForRole(ctx)
        -recordFindings(ctx, type, findings)
    }

    class ChatMemoryPlugin {
        +manifest: PluginManifest
        +config: ChatMemoryConfig
        +getMemoryConfig(ctx)
        +getTools(ctx)
        +getAdminComponents()
        +getUserComponents()
    }

    ChatPlugin <|.. BasePlugin : implements
    BasePlugin <|-- SafetyProcessorPlugin : extends
    BasePlugin <|-- ChatMemoryPlugin : extends
    ChatPlugin ..> PluginManifest : contains
    ChatPlugin ..> PluginRequestContext : uses
    ChatPlugin ..> PluginStorage : uses
    ChatPlugin ..> PluginHooks : contains
```

## 5. Streaming Tool State Machine

```mermaid
stateDiagram-v2
    [*] --> InputStreaming: Tool Call Started

    InputStreaming: input-streaming
    note right of InputStreaming
        LLM composing tool call arguments
        UI: Loading spinner
    end note

    InputAvailable: input-available
    note right of InputAvailable
        Complete arguments ready
        UI: Show "Executing..."
    end note

    OutputStreaming: output-streaming
    note right of OutputStreaming
        Tool executing & streaming results
        UI: Progressive display
        (e.g., partial rubric scores)
    end note

    OutputAvailable: output-available
    note right of OutputAvailable
        Execution complete
        UI: Final display
    end note

    OutputError: output-error
    note right of OutputError
        Execution failed
        UI: Error component
    end note

    InputStreaming --> InputAvailable: Input Complete
    InputAvailable --> OutputStreaming: Execution Starts<br/>(for streaming tools)
    InputAvailable --> OutputAvailable: Execution Complete<br/>(for sync tools)
    InputAvailable --> OutputError: Execution Failed

    OutputStreaming --> OutputAvailable: Stream Complete
    OutputStreaming --> OutputError: Stream Failed

    OutputAvailable --> [*]
    OutputError --> [*]

    note left of InputStreaming
        Plugin Tool Renderer must
        handle ALL five states:
        1. input-streaming
        2. input-available
        3. output-streaming
        4. output-available
        5. output-error
    end note
```

## 6. Data Persistence & Storage Architecture

```mermaid
graph TB
    subgraph "Application Layer"
        PluginA[Plugin A<br/>Safety Processor]
        PluginB[Plugin B<br/>Chat Memory]
        PluginC[Plugin C<br/>Custom Tool]
    end

    subgraph "Storage Abstraction Layer"
        Storage[PluginStorage<br/>Interface]

        subgraph "Scoped Storage"
            UserScope[User Scope<br/>user:123]
            ThreadScope[Thread Scope<br/>thread:456]
            ResourceScope[Resource Scope<br/>resource:789]
        end
    end

    subgraph "Database Layer"
        PluginStorageTable[(plugin_storage<br/>Table)]
        PluginConfigTable[(plugin_configs<br/>Table)]

        subgraph "Key Structure"
            Key1["plugin-id:user:123:key"]
            Key2["plugin-id:thread:456:key"]
            Key3["plugin-id:resource:789:key"]
        end
    end

    PluginA --> Storage
    PluginB --> Storage
    PluginC --> Storage

    Storage --> UserScope
    Storage --> ThreadScope
    Storage --> ResourceScope

    UserScope --> Key1
    ThreadScope --> Key2
    ResourceScope --> Key3

    Key1 --> PluginStorageTable
    Key2 --> PluginStorageTable
    Key3 --> PluginStorageTable

    PluginA -.config.-> PluginConfigTable
    PluginB -.config.-> PluginConfigTable
    PluginC -.config.-> PluginConfigTable

    style Storage fill:#4169e1,stroke:#000,stroke-width:2px,color:#fff
    style PluginStorageTable fill:#228b22,stroke:#000,stroke-width:2px,color:#fff
    style PluginConfigTable fill:#ff8c00,stroke:#000,stroke-width:2px,color:#fff
```

## 7. UI Integration Pattern

```mermaid
graph LR
    subgraph "UnifiedChat Component"
        Header[Chat Header<br/>🎯 Placement: chat-header]
        Messages[Message List]
        Input[Input Area<br/>🎯 Placement: input-toolbar]
        Footer[Footer<br/>🎯 Placement: chat-footer]
        Sidebar[Sidebar<br/>🎯 Placement: sidebar-widget]
    end

    subgraph "PluginUISlot System"
        Slot1[PluginUISlot<br/>placement='chat-header']
        Slot2[PluginUISlot<br/>placement='message-decorator']
        Slot3[PluginUISlot<br/>placement='input-toolbar']
        Slot4[PluginUISlot<br/>placement='sidebar-widget']
    end

    subgraph "Plugin Components"
        MemoryIndicator[Memory Indicator<br/>🧠 Chat Memory Plugin]
        SafetyWarning[Moderation Warning<br/>🛡️ Safety Plugin]
        ToolbarButton[Custom Button<br/>⚙️ Custom Plugin]
        ForgetButton[Forget Button<br/>🗑️ Memory Plugin]
    end

    Header --> Slot1
    Messages --> Slot2
    Input --> Slot3
    Sidebar --> Slot4

    Slot1 -.renders.-> MemoryIndicator
    Slot2 -.renders.-> SafetyWarning
    Slot3 -.renders.-> ToolbarButton
    Slot4 -.renders.-> ForgetButton

    Registry[ChatPluginRegistry] -.provides components.-> Slot1
    Registry -.provides components.-> Slot2
    Registry -.provides components.-> Slot3
    Registry -.provides components.-> Slot4

    style Header fill:#e6f3ff,stroke:#333,stroke-width:2px
    style Messages fill:#e6f3ff,stroke:#333,stroke-width:2px
    style Input fill:#e6f3ff,stroke:#333,stroke-width:2px
    style Footer fill:#e6f3ff,stroke:#333,stroke-width:2px
    style Registry fill:#4169e1,stroke:#000,stroke-width:3px,color:#fff
```

## 8. Streaming Pipeline with Plugin Processors

```mermaid
sequenceDiagram
    autonumber
    participant Client as Browser Client
    participant Stream as Stream Writer
    participant Safety as Safety Processor
    participant Analytics as Analytics Processor
    participant LLM

    Client->>Stream: Initialize stream

    Stream->>Safety: onStreamStart(ctx)
    Stream->>Analytics: onStreamStart(ctx)
    Analytics->>Analytics: Record start time

    loop For each LLM chunk
        LLM->>Stream: Stream chunk (text-delta)

        Stream->>Safety: processStreamChunk(chunk)
        Safety->>Safety: Buffer text for scanning

        alt Buffer threshold reached
            Safety->>Safety: Quick safety scan
            alt Flagged content
                Safety->>Stream: writePluginPart('plugin-safety-warning')
                alt Critical severity
                    Safety->>Stream: abort()
                end
            end
        end
        Safety-->>Stream: Return chunk (or null)

        Stream->>Analytics: processStreamChunk(chunk)
        Analytics->>Analytics: Count tokens
        alt First token
            Analytics->>Stream: writePluginPart('plugin-analytics-ttft')
        end
        Analytics-->>Stream: Return chunk

        Stream->>Client: Forward chunk
    end

    LLM->>Stream: Stream complete

    Stream->>Safety: onStreamEnd(finalMessage)
    Safety->>Safety: Full content scan
    Safety-->>Stream: Enhanced message with metadata

    Stream->>Analytics: onStreamEnd(finalMessage)
    Analytics->>Analytics: Calculate total metrics
    Analytics->>Analytics: Save to storage
    Analytics-->>Stream: Final message

    Stream->>Client: Stream closed
    Client->>Client: Render complete message
```

## 9. Plugin Configuration Hierarchy

```mermaid
graph TB
    subgraph "Configuration Sources"
        GlobalDefault[Global Plugin<br/>Defaults<br/>plugin_configs<br/>tool_uuid=null<br/>org_id=null]
        OrgDefault[Organization<br/>Defaults<br/>plugin_configs<br/>tool_uuid=null<br/>org_id=123]
        ToolConfig[Tool-Specific<br/>Config<br/>plugin_configs<br/>tool_uuid=abc<br/>org_id=null]
        ToolOrgConfig[Tool + Org<br/>Config<br/>plugin_configs<br/>tool_uuid=abc<br/>org_id=123]
    end

    subgraph "Merge Strategy"
        Merge[Config Merger<br/>Priority Order:<br/>1. Tool + Org<br/>2. Tool<br/>3. Org<br/>4. Global]
    end

    subgraph "Runtime"
        ActiveConfig[Active Plugin<br/>Configuration]
        Plugin[Plugin Instance]
    end

    GlobalDefault -->|Priority: 4| Merge
    OrgDefault -->|Priority: 3| Merge
    ToolConfig -->|Priority: 2| Merge
    ToolOrgConfig -->|Priority: 1| Merge

    Merge --> ActiveConfig
    ActiveConfig --> Plugin

    Plugin -.validates against.-> Schema[Config Schema<br/>JSON Schema +<br/>Validation Function]

    style GlobalDefault fill:#d3d3d3,stroke:#333,stroke-width:2px
    style OrgDefault fill:#b8c5d6,stroke:#333,stroke-width:2px
    style ToolConfig fill:#9fb1cc,stroke:#333,stroke-width:2px
    style ToolOrgConfig fill:#7d97bf,stroke:#333,stroke-width:2px
    style ActiveConfig fill:#4169e1,stroke:#000,stroke-width:3px,color:#fff
```

## 10. Plugin Tool Renderer Pattern

```mermaid
graph TB
    subgraph "Message Rendering"
        Message[Chat Message<br/>with Tool Parts]
    end

    subgraph "Part Type Detection"
        Router{Part Router}
        TextPart[Text Part]
        ToolPart[Tool Call Part]
        PluginPart[Plugin Stream Part]
    end

    subgraph "Tool Renderer Registry"
        RendererRegistry[Plugin Tool<br/>Renderer Registry]

        Renderer1[Rubric Feedback<br/>Renderer]
        Renderer2[Search Results<br/>Renderer]
        Renderer3[Custom Tool<br/>Renderer]
    end

    subgraph "State-Aware Components"
        Loading[Loading Component<br/>input-streaming<br/>input-available]
        Streaming[Streaming Component<br/>output-streaming]
        Complete[Complete Component<br/>output-available]
        Error[Error Component<br/>output-error]
    end

    Message --> Router

    Router -->|type: text| TextPart
    Router -->|type: tool-call| ToolPart
    Router -->|type: plugin-*| PluginPart

    ToolPart --> RendererRegistry

    RendererRegistry --> Renderer1
    RendererRegistry --> Renderer2
    RendererRegistry --> Renderer3

    Renderer1 -->|state: input-*| Loading
    Renderer1 -->|state: output-streaming| Streaming
    Renderer1 -->|state: output-available| Complete
    Renderer1 -->|state: output-error| Error

    style Message fill:#e6f3ff,stroke:#333,stroke-width:2px
    style RendererRegistry fill:#4169e1,stroke:#000,stroke-width:2px,color:#fff
    style Streaming fill:#ffd700,stroke:#333,stroke-width:2px
    style Complete fill:#32cd32,stroke:#333,stroke-width:2px
    style Error fill:#dc143c,stroke:#333,stroke-width:2px,color:#fff
```

## Diagram Index

1. **Plugin Registry Architecture** - High-level system overview
2. **Plugin Lifecycle** - State transitions from registration to destruction
3. **Request Flow** - Sequence of plugin interactions during chat processing
4. **Interface Hierarchy** - TypeScript class relationships
5. **Streaming State Machine** - Tool call state transitions
6. **Data Persistence** - Storage architecture and scoping
7. **UI Integration** - Component placement and slot system
8. **Streaming Pipeline** - Real-time processing with processors
9. **Configuration Hierarchy** - Config merging strategy
10. **Tool Renderer Pattern** - Custom tool rendering system

Each diagram corresponds to a major section in the [`chat-plugin-registry-design.md`](./chat-plugin-registry-design.md) document.
