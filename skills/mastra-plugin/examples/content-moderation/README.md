# Content Moderation - Guardrails with Processors

Reusable processor configurations for adding guardrails to Mastra agents.

## Pattern

**Processors** run before or after each interaction, letting you review, transform, or block messages.

```
User Message → [Input Processors] → LLM → [Output Processors] → Response
```

## Built-in Processors

| Processor | Purpose |
|-----------|---------|
| `ModerationProcessor` | Detect/block harmful content (hate, harassment, violence) |
| `PromptInjectionDetector` | Block jailbreak and injection attempts |
| `PIIDetector` | Redact personal information (emails, SSNs, etc.) |
| `UnicodeNormalizer` | Prevent unicode smuggling attacks |

## Exports in `processors.ts`

### 1. Basic Moderation

```typescript
export const basicModeration = new ModerationProcessor({
  model: 'openai/gpt-4.1-nano',
  categories: ['hate', 'harassment', 'violence'],
  threshold: 0.7,
  strategy: 'block',
});
```

### 2. Layered Security

```typescript
export const layeredSecurity = [
  new UnicodeNormalizer(),
  new PromptInjectionDetector(),
  new PIIDetector(),
  new ModerationProcessor({ ... }),
];
```

### 3. Input + Output Moderation

```typescript
export const inputModeration = new ModerationProcessor({
  strategy: 'block',
});

export const outputModeration = new ModerationProcessor({
  strategy: 'rewrite', // Better UX
});
```

### 4. Custom Input Processor

```typescript
export class ProfanityFilter implements Processor {
  id = 'profanity-filter';

  async processInput({ messages, abort }) {
    if (containsProfanity(lastMessage)) {
      abort('Message contains prohibited content');
    }
    return messages;
  }
}
```

### 5. Custom Output Guardrail

```typescript
export class ResponseLengthGuard implements Processor {
  constructor(private maxLength: number = 1000) {}

  async processOutputResult({ messages, abort }) {
    // Truncate or abort long responses
  }
}
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { layeredSecurity, outputModeration } from './processors';

const agent = new Agent({
  name: 'safe-agent',
  inputProcessors: layeredSecurity,
  outputProcessors: [outputModeration],
});
```

## Handling Blocked Content

When a processor calls `abort()`, the agent returns a `tripwire` result:

```typescript
const result = await agent.generate('Some message');

if (result.tripwire) {
  console.log('Blocked:', result.tripwire.reason);
} else {
  console.log('Response:', result.text);
}
```

## ModerationProcessor Options

| Option | Type | Description |
|--------|------|-------------|
| `model` | `string` | Model for classification |
| `categories` | `string[]` | Content categories to detect |
| `threshold` | `number` | Confidence threshold (0-1) |
| `strategy` | `'block' \| 'rewrite'` | Block or attempt to rewrite |
| `instructions` | `string` | Custom classifier instructions |
| `includeScores` | `boolean` | Include confidence scores |

## Files

```
content-moderation/
├── processors.ts  # Processor exports
└── README.md
```
