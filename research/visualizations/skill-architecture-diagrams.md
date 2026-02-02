# Skill Architecture Diagrams

This document contains visual diagrams explaining the design, architecture, and concepts of the **AI SDK Tool UI** skill and the **Mastra Plugin** skill.

## 1. AI SDK Tool UI Architecture

This diagram illustrates the structure and data flow of the `create-tool-ui` skill, focusing on how tool definitions and UI components interact in a chat interface.

![AI SDK Component Architecture](./images/ai-sdk-component-architecture.png)

### Architecture Visualizations (Variations)

| Style | Image |
|-------|-------|
| Standard | ![Standard](./images/ai-sdk-architecture-v1.png) |
| Blueprint | ![Blueprint](./images/ai-sdk-architecture-v2.png) |
| 3D Render | ![3D Render](./images/ai-sdk-architecture-v3.png) |
| Minimalist | ![Minimalist](./images/ai-sdk-architecture-v4.png) |

### AI SDK Plugin Architecture Variations

| Style | Image |
|-------|-------|
| Standard | ![Standard](./images/ai-sdk-plugin-architecture-v1.png) |
| Modern Dark | ![Modern Dark](./images/ai-sdk-plugin-architecture-v2.png) |
| Blueprint | ![Blueprint](./images/ai-sdk-plugin-architecture-v3.png) |
| Conceptual | ![Conceptual](./images/ai-sdk-plugin-architecture-v4.png) |

### Multi-Plugin Architecture Variations

| Style | Image |
|-------|-------|
| Standard | ![Standard](./images/multi-plugin-architecture-v1.png) |
| Modern Dark | ![Modern Dark](./images/multi-plugin-architecture-v2.png) |
| Blueprint | ![Blueprint](./images/multi-plugin-architecture-v3.png) |
| 3D Glass | ![3D Glass](./images/multi-plugin-architecture-v4.png) |
| Minimalist | ![Minimalist](./images/multi-plugin-architecture-v5.png) |

### AI SDK Plugin Stacks Variations

| Style | Image |
|-------|-------|
| Standard | ![Standard](./images/ai-sdk-plugin-stacks-v1.png) |
| Isometric | ![Isometric](./images/ai-sdk-plugin-stacks-v2.png) |
| Top-down | ![Top-down](./images/ai-sdk-plugin-stacks-v3.png) |
| Circuit | ![Circuit](./images/ai-sdk-plugin-stacks-v4.png) |
| Exploded | ![Exploded](./images/ai-sdk-plugin-stacks-v5.png) |

```mermaid
graph TD
    subgraph "Server Side"
        Config["config.ts<br/>(Schemas & IDs)"]
        ToolDef["tool.ts<br/>(Server Tool Definition)"]
        LLM["LLM / AI SDK"]
        
        Config --> ToolDef
        ToolDef --> LLM
    end

    subgraph "Client Side"
        UIConfig["config.ts<br/>(Shared Config)"]
        ToolUI["ui.tsx<br/>(createToolUI)"]
        Registry["Tool UI Registry"]
        ChatInterface["Chat Interface"]
        
        UIConfig --> ToolUI
        ToolUI --> Registry
        Registry --> ChatInterface
    end

    LLM -- "Tool Call (Streaming)" --> ChatInterface
    ChatInterface -- "Render" --> Registry
```

## 2. Mastra Plugin Architecture

This diagram shows the comprehensive architecture of a Mastra Plugin, highlighting the integration of Agents, Tools, Memory, Workflows, and UI.

![Mastra Agent Architecture](./images/mastra-agent-architecture.png)

### Architecture Visualizations (Variations)

| Style | Image |
|-------|-------|
| Standard | ![Standard](./images/mastra-plugin-architecture-v1.png) |
| Modern Dark | ![Modern Dark](./images/mastra-plugin-architecture-v2.png) |
| Blueprint | ![Blueprint](./images/mastra-plugin-architecture-v3.png) |
| Conceptual | ![Conceptual](./images/mastra-plugin-architecture-v4.png) |

```mermaid
graph TB
    subgraph "Mastra Plugin Package"
        Config["config.ts<br/>(Config & Schemas)"]
        
        subgraph "Core Logic"
            Agent["agent.ts<br/>(Agent Definition)"]
            Tools["tools.ts<br/>(Tool Definitions)"]
            Memory["memory.ts<br/>(Vector & Storage)"]
            Workflow["workflow.ts<br/>(Multi-step Logic)"]
        end
        
        subgraph "Quality & Testing"
            Evals["evals.ts<br/>(Evaluations)"]
            Tests["*.test.ts<br/>(Unit Tests)"]
        end
        
        subgraph "Interface"
            UI["ui.tsx<br/>(Client Components)"]
        end
        
        Config --> Agent
        Config --> Tools
        Config --> Workflow
        
        Tools --> Agent
        Memory --> Agent
        Agent --> Workflow
        
        Agent --> Evals
        Tools --> Tests
        
        Tools -.-> UI
    end
    
    User["User / App"] --> Agent
    User --> Workflow
```

## 3. Tool UI State Lifecycle

Both skills utilize a reactive UI model for tool execution. This state machine diagram explains the lifecycle of a tool call from the UI perspective.

![AI SDK Streaming UI](./images/ai-sdk-streaming-ui.png)

```mermaid
stateDiagram-v2
    [*] --> InputStreaming : LLM starts generating args
    
    InputStreaming --> InputAvailable : Args complete
    InputStreaming --> InputStreaming : Streaming continues
    
    InputAvailable --> Executing : Tool invoked
    
    Executing --> OutputStreaming : Result streaming starts
    Executing --> OutputAvailable : Result complete (immediate)
    Executing --> OutputError : Execution failed
    
    OutputStreaming --> OutputAvailable : Streaming complete
    OutputStreaming --> OutputStreaming : Streaming continues
    
    OutputAvailable --> [*]
    OutputError --> [*]

    note right of InputStreaming
        Props: { input (partial) }
        UI: Skeleton / Loading
    end note

    note right of OutputAvailable
        Props: { input, output }
        UI: Final Result Card
    end note
```

## 4. Mastra Workflow & Human-in-the-Loop

The Mastra Plugin skill supports complex workflows with suspension and resumption. This diagram illustrates the flow including human approval steps.

![Mastra Workflow Pipeline](./images/mastra-workflow-pipeline.png)

```mermaid
sequenceDiagram
    participant User
    participant Workflow as Mastra Workflow
    participant Agent
    participant Human as Human Approver

    User->>Workflow: Start Run (Input)
    Workflow->>Agent: Step 1: Agent Processing
    Agent-->>Workflow: Result
    
    Workflow->>Workflow: Step 2: Check Approval Needed
    
    alt Requires Approval
        Workflow-->>User: Suspend (Reason: Approval)
        User->>Human: Notify Approver
        Human->>Workflow: Resume (Approved/Rejected)
    else Auto Approved
        Workflow->>Workflow: Continue
    end
    
    Workflow->>Workflow: Step 3: Final Processing
    Workflow-->>User: Final Output
```

## 5. Comparison & Integration

This diagram compares the scope of the two skills and shows how `create-tool-ui` concepts are embedded within the broader `mastra-plugin` architecture.

![Mastra Plugin Ecosystem](./images/mastra-plugin-ecosystem.png)
![AI SDK Tool Registry](./images/ai-sdk-tool-registry.png)

```mermaid
graph TD
    subgraph "AI SDK Tool UI Skill"
        style ToolUI fill:#e1f5fe,stroke:#01579b
        ToolUI["Tool UI Component"]
        ToolConfig["Tool Config"]
    end

    subgraph "Mastra Plugin Skill"
        style Mastra fill:#f3e5f5,stroke:#4a148c
        
        MastraAgent["Agent"]
        MastraWorkflow["Workflow"]
        MastraMemory["Memory"]
        MastraTools["Tools"]
        
        subgraph "Mastra UI Layer"
            MastraUI["ui.tsx"]
        end
    end

    ToolUI -.->|"Conceptually Similar"| MastraUI
    ToolConfig -.->|"Shared Schema Pattern"| MastraTools

    note["The 'create-tool-ui' skill focuses purely on the<br/>presentation layer (Blue), while the 'mastra-plugin'<br/>skill provides the full backend stack (Purple)<br/>plus the presentation layer."]
```
