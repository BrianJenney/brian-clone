# Claude Code Instructions

## Project Overview

AI-powered business assistant for Brian that combines a Next.js chat interface, LLM tool-calling, multi-agent orchestration, and vector semantic search over Brian's writing samples, business data, and YouTube transcripts.

## Tech Stack

- **Framework:** Next.js (App Router) + React 19 + TypeScript 5
- **AI:** Vercel AI SDK v5, OpenAI SDK, LangChain, LangGraph
- **Vector DB:** Qdrant (3 collections: `brian-articles`, `brian-posts`, `brian-transcripts`)
- **Validation:** Zod
- **Linter/Formatter:** Biome (replaces ESLint/Prettier)
- **Python Backend:** Flask on port 5328 (YouTube transcript ingestion)
- **Package Manager:** Yarn

## Development Commands

```bash
yarn dev          # Run Next.js + Python API concurrently
yarn dev:next     # Next.js only
yarn dev:py       # Python Flask API only
yarn build        # Production build
yarn lint         # Biome check
yarn format       # Biome format --write
yarn upload-posts     # Upload Medium articles to Qdrant
yarn upload-linkedin  # Upload LinkedIn posts to Qdrant
yarn brian            # Run CLI tool
```

## Required Environment Variables

```
OPENAI_API_KEY
HELICONE_API_KEY
QDRANT_URL
QDRANT_API_KEY
YOUTUBE_API_KEY
CRON_SECRET
```

## Architecture

### API Routes (`/app/api/`)

| Route | Description |
|---|---|
| `/api/chat` | Main chat endpoint — tool calling with streaming |
| `/api/chat-agents` | Experimental multi-agent endpoint |
| `/api/upload` | Upload articles/posts to Qdrant |
| `/api/search` | Semantic search across collections |
| `/api/delete` | Remove documents from collections |
| `/api/linkedin-posts` | LinkedIn-specific operations |
| `/api/auth/login` | Authentication |
| `/api/auth/logout` | Sign out |

### Tool System (`/libs/tools/`)

Six tools available to the main chat agent:

1. **searchWritingSamplesTool** — Qdrant semantic search over articles/posts
2. **getBusinessContextTool** — Read from `data/context/*.json` files
3. **searchResourcesTool** — Search learning resources collection
4. **analyzeChannelTool** — YouTube channel performance analysis
5. **researchTopicTool** — YouTube video trend research
6. **excalidrawerTool** — Generate Excalidraw diagram specs

### Agent Router Architecture (`/api/chat-agents`)

Router → Agents (parallel) → Summarizer pattern:

1. **Router** (gpt-4o-mini) — Analyzes request, selects agents, creates refined query
2. **Agents** (parallel, gpt-4o-mini) — Execute specialized tasks using tools
3. **Summarizer** (gpt-4o) — Combines agent responses into final answer

Five specialized agents (`/libs/agents/config.ts`):
- `videoResearch` — YouTube channel analysis & video topic research
- `businessContext` — Fetch business data & audience personas
- `writingSamples` — Search writing samples to match Brian's style
- `resources` — Find learning resources & courses
- `excalidrawer` — Generate diagrams and flowcharts

### Qdrant Collections

| Collection | Content |
|---|---|
| `brian-articles` | Medium blog posts |
| `brian-posts` | LinkedIn posts |
| `brian-transcripts` | YouTube video transcripts (chunked, 1500 chars with overlap) |

### Python Backend (`/api/youtube-transcripts/index.py`)

Flask app on port 5328. Runs on a cron schedule (authenticated via `CRON_SECRET` header):
1. Fetches recent videos from Brian's YouTube channel
2. Extracts transcripts with fallback methods
3. Chunks text (1500-char chunks with overlap)
4. Embeds with `text-embedding-3-small`
5. Upserts into Qdrant `brian-transcripts` collection

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

const parsed = requestSchema.parse(body);
```

### Generating Structured Objects

Use `generateObject` for structured JSON responses:

```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await generateObject({
	model: openai('gpt-4o'),
	schema: z.object({
		agent: z.enum(['linkedin', 'rag']),
		refinedQuery: z.string(),
		reasoning: z.string().optional(),
	}),
	prompt: 'Your prompt here',
});

console.log(result.object.agent);
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

### Agent Type Definitions

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

## Key Principles

1. **Always validate inputs** — Use Zod schemas with `.parse()` for runtime validation
2. **Infer types from schemas** — Use `z.infer<typeof schema>` for TypeScript types
3. **Use structured outputs** — Prefer `generateObject` when you need JSON, `streamText` for streaming
4. **Type your agent contracts** — Define clear `AgentRequest` and `AgentResponse` types
5. **Lint with Biome** — Run `yarn lint` before committing; `yarn format` to auto-fix style issues
6. **Path alias** — Use `@/*` for imports from the project root
