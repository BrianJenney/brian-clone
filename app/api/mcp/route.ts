import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { lookupWriting, type WritingHit } from '@/libs/mcp/lookupWriting';
import { getLeadMagnets } from '@/libs/mcp/getLeadMagnets';
import { getYouTubeChannel } from '@/libs/mcp/getYouTubeChannel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatHit(h: WritingHit, index: number): string {
	const parts: (string | null)[] = [`#${index} [${h.source}]`];

	if (h.source === 'post') {
		if (h.numImpressions !== undefined)
			parts.push(`impressions=${h.numImpressions}`);
		if (h.numReactions !== undefined)
			parts.push(`reactions=${h.numReactions}`);
		if (h.createdAt) parts.push(`createdAt=${h.createdAt}`);
	} else {
		if (h.title) parts.push(`title="${h.title}"`);
		if (h.author) parts.push(`author=${h.author}`);
		if (h.date) parts.push(`date=${h.date}`);
	}
	if (h.sourceUrl) parts.push(`url=${h.sourceUrl}`);

	return `${parts.filter(Boolean).join(' | ')}\n${h.text}`;
}

function unauthorized(): Response {
	return new Response(
		JSON.stringify({
			jsonrpc: '2.0',
			error: { code: -32001, message: 'Unauthorized' },
			id: null,
		}),
		{
			status: 401,
			headers: {
				'Content-Type': 'application/json',
				'WWW-Authenticate': 'Bearer realm="mcp", error="invalid_token"',
			},
		},
	);
}

function authorized(req: Request): boolean {
	const expected = process.env.MCP_AUTH_TOKEN;
	if (!expected) return false;

	const header = req.headers.get('authorization') ?? '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match) return false;

	const provided = match[1].trim();
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

function buildServer(): McpServer {
	const server = new McpServer(
		{ name: 'brian-clone-mcp', version: '0.1.0' },
		{
			capabilities: { tools: {} },
			instructions:
				"Tools for Brian's writing, business, and YouTube channel. Use `lookup_writing` to find relevant content across articles, LinkedIn posts, and transcripts — an internal router picks which collections to search, and LinkedIn posts are over-fetched and preferred by impressions (falls back to top 3). Use `get_lead_magnets` to retrieve Brian's current business lead magnets. Use `get_youtube_channel` to get analytics, recent videos, and top performers from Brian's YouTube channel.",
		},
	);

	server.registerTool(
		'lookup_writing',
		{
			title: "Lookup Brian's writing",
			description:
				"Semantic search across Brian's articles, LinkedIn posts, and transcripts. An LLM router decides which collections are relevant to the query (override with `sources` if you know). LinkedIn posts are over-fetched and filtered to those with `numImpressions >= minImpressions` (default 50), falling back to the top 3 semantic matches if none qualify. Articles and transcripts return the top `topK` semantic matches.",
			inputSchema: {
				query: z
					.string()
					.min(1)
					.describe(
						'Natural language topic or excerpt to search for.',
					),
				sources: z
					.array(z.enum(['article', 'post', 'transcript']))
					.optional()
					.describe(
						'Optional override for which collections to search. Omit to let the router decide.',
					),
				minImpressions: z
					.number()
					.int()
					.nonnegative()
					.optional()
					.describe(
						'Minimum impressions for LinkedIn posts. Defaults to 50.',
					),
				topK: z
					.number()
					.int()
					.positive()
					.max(25)
					.optional()
					.describe('Max matches per source. Defaults to 5.'),
			},
		},
		async ({ query, sources, minImpressions, topK }) => {
			const response = await lookupWriting({
				query,
				sources,
				minImpressions,
				topK,
			});

			const header = `Searched: ${response.chosenSources.join(', ')}${
				response.routerReasoning
					? ` — ${response.routerReasoning}`
					: ''
			}`;

			const body =
				response.hits.length === 0
					? 'No matching writing found.'
					: response.hits
							.map((h: WritingHit, i: number) =>
								formatHit(h, i + 1),
							)
							.join('\n\n---\n\n');

			return {
				content: [
					{ type: 'text' as const, text: `${header}\n\n${body}` },
				],
				structuredContent: {
					chosenSources: response.chosenSources,
					routerReasoning: response.routerReasoning,
					hits: response.hits,
				} as unknown as { [x: string]: unknown },
			};
		},
	);

	server.registerTool(
		'get_lead_magnets',
		{
			title: "Brian's business lead magnets",
			description:
				"Returns Brian's current business lead magnets (free offers used to bring in new audience), sourced from the canonical business overview. Use when asked about free courses, lead magnets, or funnel top-of-funnel offers.",
			inputSchema: {},
		},
		async () => {
			const payload = await getLeadMagnets();
			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(payload, null, 2),
					},
				],
				structuredContent: payload as unknown as {
					[x: string]: unknown;
				},
			};
		},
	);

	server.registerTool(
		'get_youtube_channel',
		{
			title: "Brian's YouTube channel analytics",
			description:
				"Returns analytics and recent videos from Brian's YouTube channel. Includes subscriber count, total views, recent videos with performance metrics, top performers, and engagement trends. Use when asked about YouTube content, video performance, or channel analytics.",
			inputSchema: {
				maxVideos: z
					.number()
					.int()
					.positive()
					.max(50)
					.optional()
					.describe('Max recent videos to fetch. Defaults to 12.'),
			},
		},
		async ({ maxVideos }) => {
			const data = await getYouTubeChannel(undefined, maxVideos ?? 12);

			const summary = [
				`Channel: ${data.stats.title}`,
				`Subscribers: ${data.stats.subscriberCount.toLocaleString()}`,
				`Total Views: ${data.stats.totalViews.toLocaleString()}`,
				`Total Videos: ${data.stats.videoCount.toLocaleString()}`,
				'',
				'--- Analysis ---',
				`Average Views per Video: ${data.analysis.averageViews.toLocaleString()}`,
				`Average Engagement Rate: ${data.analysis.averageEngagement}%`,
				`Views Distribution: ${data.analysis.trends.viewsDistribution}`,
				`Engagement Insights: ${data.analysis.trends.engagementInsights}`,
				'',
				'--- Top Performers ---',
				...data.topPerformers.map(
					(v, i) =>
						`${i + 1}. "${v.title}" - ${v.viewCount.toLocaleString()} views, ${v.engagementRate}% engagement`,
				),
				'',
				'--- Recent Videos ---',
				...data.recentVideos.map(
					(v, i) =>
						`${i + 1}. "${v.title}" (${v.publishedAt}) - ${v.viewCount.toLocaleString()} views`,
				),
			].join('\n');

			return {
				content: [{ type: 'text' as const, text: summary }],
				structuredContent: data as unknown as { [x: string]: unknown },
			};
		},
	);

	return server;
}

async function handle(req: Request): Promise<Response> {
	if (!authorized(req)) return unauthorized();

	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});

	const server = buildServer();
	await server.connect(transport);

	try {
		return await transport.handleRequest(req);
	} finally {
		await transport.close();
		await server.close();
	}
}

export async function GET(req: Request) {
	return handle(req);
}

export async function POST(req: Request) {
	return handle(req);
}

export async function DELETE(req: Request) {
	return handle(req);
}
