import { z } from 'zod/v4';
import { registry } from '@langchain/langgraph/zod';
import { MessagesZodMeta } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

import { searchWritingSamplesTool } from '@/libs/tools/search-content';
import { searchLinkedInPostsTool } from '@/libs/tools/search-linkedin';
import { getBusinessContextTool } from '@/libs/tools/get-business-context';
import { getRecentContentTool } from '@/libs/tools/get-recent-content';
import { searchResourcesTool } from '@/libs/tools/search-resources';
import {
	analyzeChannelTool,
	researchTopicTool,
} from '@/libs/tools/video-research';
import { excalidrawerTool } from '@/libs/tools/excalidrawer';
import { createTypeformTool } from '@/libs/tools/typeform';

export const AVAILABLE_TOOLS = [
	'searchWritingSamples',
	'searchLinkedInPosts',
	'getBusinessContext',
	'getRecentContent',
	'searchResources',
	'analyzeChannel',
	'researchTopic',
	'excalidrawer',
	'createTypeform',
] as const;

export type ToolName = (typeof AVAILABLE_TOOLS)[number];

/** Input types for each tool - derived keys from AVAILABLE_TOOLS */
type ToolInputSchemas = {
	searchWritingSamples: { query: string };
	searchLinkedInPosts: { query: string };
	getBusinessContext: Record<string, never>;
	getRecentContent: Record<string, never>;
	searchResources: { query: string };
	analyzeChannel: { maxVideos: number };
	researchTopic: { topic: string };
	excalidrawer: { request: string };
	createTypeform: { description: string };
};

export type ToolInputs = {
	[K in ToolName]?: ToolInputSchemas[K];
};

export const TOOL_MAP: Record<
	string,
	{ invoke: (input: any) => Promise<any> }
> = {
	searchWritingSamples: searchWritingSamplesTool,
	searchLinkedInPosts: searchLinkedInPostsTool,
	getBusinessContext: getBusinessContextTool,
	getRecentContent: getRecentContentTool,
	searchResources: searchResourcesTool,
	analyzeChannel: analyzeChannelTool,
	researchTopic: researchTopicTool,
	excalidrawer: excalidrawerTool,
	createTypeform: createTypeformTool,
};

export const CHAT_SYSTEM_PROMPT = `
You are Brian's AI business and content assistant with tools to help you.

## Content Creation
For content creation requests, use searchWritingSamples to find similar content Brian has written and match his style.

## Brian's Brand Voice
- Professional peer, not condescending
- Transparent about timelines and challenges
- Practical over theoretical
- No excessive motivation/inspiration - focus on clear roadmaps
- No emojis

## Initial Suggestions (when using getRecentContent)
When suggesting what to work on, be BRIEF:
- 2-3 sentence summary of recent activity
- 2-3 quick suggestions with one-line descriptions
- Keep total response under 150 words
- Focus on leverage: repurpose recent content, fill gaps, or capitalize on momentum

## Available Tools
- **searchWritingSamples**: Search Brian's previous articles, posts, and transcripts to match his writing style
- **searchLinkedInPosts**: Search LinkedIn posts with natural language (time range, likes, topics) e.g. "top performing React posts from last month"
- **getBusinessContext**: Retrieve business strategy and performance data
- **getRecentContent**: Check recent LinkedIn posts, YouTube videos, and Medium articles to suggest what to work on
- **searchResources**: Find learning resources, tutorials and lead magnets
- **analyzeChannel**: Analyze Brian's YouTube channel performance
- **researchTopic**: Research YouTube topics to see what's trending
- **excalidrawer**: Draw diagrams and flowcharts
- **createTypeform**: Design and create Typeform surveys (requires human approval)
`.trim();

export const TypeformStateSchema = z.object({
	threadId: z.string().optional(),
	interrupted: z.boolean().optional(),
	formDesign: z.any().optional(),
	result: z
		.object({
			id: z.string(),
			url: z.string(),
			editUrl: z.string(),
		})
		.optional(),
	formDescription: z.string().optional(),
});

export const graphStateSchema = z.object({
	messages: z
		.custom<BaseMessage[]>()
		.register(registry, MessagesZodMeta)
		.describe('Conversation history as LangChain messages.'),

	toolsNeeded: z
		.array(z.enum(AVAILABLE_TOOLS))
		.optional()
		.describe(
			'Tool names selected by intent classification for this request.',
		),
	toolResults: z
		.record(z.string(), z.any())
		.optional()
		.describe('Map of tool name to raw tool output.'),
	refinedQuery: z
		.string()
		.optional()
		.describe(
			"A concise query for the tools to use. Prefer verbose queries that are more specific to the user's request.",
		),
	typeformState: TypeformStateSchema.optional().describe(
		'State for typeform creation and approval flow.',
	),
	finalResponse: z
		.string()
		.optional()
		.describe('Final assistant response returned to the caller.'),
});

export type GraphState = z.infer<typeof graphStateSchema>;

export type StreamEvent =
	| { type: 'progress'; node: string; message: string }
	| { type: 'reasoning'; content: string }
	| { type: 'text'; content: string }
	| { type: 'interrupt'; payload: any }
	| { type: 'error'; message: string }
	| { type: 'done' };

export const NODE_DISPLAY_NAMES: Record<string, string> = {
	classifyIntent: 'analyzing request',
	executeTools: 'running tools',
	handleTypeform: 'creating form',
	generateResponse: 'generating response',
};
