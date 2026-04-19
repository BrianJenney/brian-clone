import type Anthropic from '@anthropic-ai/sdk';

export const CHAT_SYSTEM_PROMPT = `
You are Brian's AI business and content assistant.

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

## Tool Usage Guidelines
- For content creation: use searchWritingSamples to match Brian's style
- For LinkedIn analytics: use searchLinkedInPosts with natural language queries
- For business questions: use getBusinessContext
- For "what should I work on": use getRecentContent
- For learning resources: use searchResources
- For YouTube strategy: use analyzeChannel and/or researchTopic
- For diagrams: use excalidrawer
`.trim();

/**
 * Anthropic tool definitions
 */
export const TOOLS: Anthropic.Tool[] = [
	{
		name: 'searchWritingSamples',
		description:
			"Search through Brian's previous articles, posts, and transcripts to find writing style examples, tone references, and similar content. Use this when writing new content to match Brian's authentic voice.",
		input_schema: {
			type: 'object' as const,
			properties: {
				query: {
					type: 'string',
					description: 'The search query to find relevant writing samples',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'searchLinkedInPosts',
		description: `Search Brian's LinkedIn posts using natural language. Supports filtering by topic, time range ("last month", "in 2024"), and engagement ("top performing", "more than 50 likes").`,
		input_schema: {
			type: 'object' as const,
			properties: {
				query: {
					type: 'string',
					description:
						'Natural language query describing what LinkedIn posts to find',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'getBusinessContext',
		description:
			'Retrieve business context including mission, value proposition, content strategy, and podcast performance metrics.',
		input_schema: {
			type: 'object' as const,
			properties: {},
			required: [],
		},
	},
	{
		name: 'getRecentContent',
		description:
			'Fetch recent content from LinkedIn, YouTube, and Medium to suggest what to work on next.',
		input_schema: {
			type: 'object' as const,
			properties: {},
			required: [],
		},
	},
	{
		name: 'searchResources',
		description:
			"Search Brian's curated learning resources including courses, guides, and templates.",
		input_schema: {
			type: 'object' as const,
			properties: {
				query: {
					type: 'string',
					description: 'What kind of learning resources to search for',
				},
			},
			required: ['query'],
		},
	},
	{
		name: 'analyzeChannel',
		description:
			"Analyze Brian's YouTube channel performance and get stats on what's working.",
		input_schema: {
			type: 'object' as const,
			properties: {
				maxVideos: {
					type: 'number',
					description: 'Number of recent videos to analyze (default: 10)',
				},
			},
			required: [],
		},
	},
	{
		name: 'researchTopic',
		description:
			"Research a YouTube video topic to see what's trending and get strategic suggestions.",
		input_schema: {
			type: 'object' as const,
			properties: {
				topic: {
					type: 'string',
					description: 'The video topic or idea to research',
				},
			},
			required: ['topic'],
		},
	},
	{
		name: 'excalidrawer',
		description: 'Create diagrams and flowcharts using Excalidraw format.',
		input_schema: {
			type: 'object' as const,
			properties: {
				request: {
					type: 'string',
					description: 'What kind of diagram to create',
				},
			},
			required: ['request'],
		},
	},
];

export type ToolName = (typeof TOOLS)[number]['name'];

export type StreamEvent =
	| { type: 'progress'; message: string }
	| { type: 'text'; content: string }
	| { type: 'tool_use'; name: string; input: Record<string, unknown> }
	| { type: 'tool_result'; name: string; result: string }
	| { type: 'error'; message: string }
	| { type: 'done' };
