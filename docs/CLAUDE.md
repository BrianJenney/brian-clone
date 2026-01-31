# Claude Code Instructions

## Agent Router Architecture

This project uses a router → agents → summarizer pattern for intelligent request handling.

**Flow:**
1. Router (gpt-4o-mini) - Analyzes request, selects agents, creates refined query
2. Agents (parallel, gpt-4o-mini) - Execute specialized tasks using tools
3. Summarizer (gpt-5) - Combines agent responses into final answer

**Agent Configuration:** See `libs/agents/config.ts` for available agents and their tools.

**Endpoint:** `/api/chat-agents` - Experimental agent-based chat endpoint

## Structured Outputs with AI SDK

### Using Zod Schemas for Type Safety

Always define Zod schemas for request/response validation:

```typescript
import { z } from 'zod';

const requestSchema = z.object({
	messages: z.array(messageSchema),
	agent: agentTypeSchema,
	query: z.string(),
});

// Parse and validate
const parsed = requestSchema.parse(body);
```

### Generating Structured Objects

Use `generateObject` for structured JSON responses:

```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const responseSchema = z.object({
	agent: z.enum(['linkedin', 'rag']),
	refinedQuery: z.string(),
	reasoning: z.string().optional(),
});

const result = await generateObject({
	model: openai('gpt-4o'),
	schema: responseSchema,
	prompt: 'Your prompt here',
});

// result.object is typed and validated
console.log(result.object.agent);
```

### Agent Type Definitions

Define strict types for agents using Zod:

```typescript
export const agentTypeSchema = z.enum(['linkedin', 'rag']);
export type AgentType = z.infer<typeof agentTypeSchema>;

export const messageSchema = z.object({
	role: z.enum(['user', 'assistant', 'system']),
	content: z.string(),
});
export type Message = z.infer<typeof messageSchema>;

export type AgentRequest = {
	type: AgentType;
	query: string;
	originalQuery: string;
	messages: Message[];
};
```

### Streaming Text Responses

Use `streamText` for streaming responses:

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await streamText({
	model: openai('gpt-4o'),
	system: 'Your system prompt',
	messages: [...request.messages],
	temperature: 0.7,
});

return result.toTextStreamResponse();
```

### Example: Chat Route with Validation

```typescript
import { z } from 'zod';

const chatSchema = z.object({
	messages: z.array(messageSchema),
	agent: agentTypeSchema,
	query: z.string(),
});

export async function POST(req: Request) {
	const body = await req.json();
	const parsed = chatSchema.parse(body); // Throws if invalid
	const { messages, agent, query } = parsed;

	// Use validated data...
}
```

## Key Principles

1. **Always validate inputs** - Use Zod schemas with `.parse()` for runtime validation
2. **Infer types from schemas** - Use `z.infer<typeof schema>` for TypeScript types
3. **Use structured outputs** - Prefer `generateObject` when you need JSON, `streamText` for streaming
4. **Type your agent contracts** - Define clear `AgentRequest` and `AgentResponse` types
