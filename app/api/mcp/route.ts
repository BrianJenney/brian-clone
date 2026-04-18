import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { lookupLinkedInWriting } from '@/libs/mcp/lookupLinkedInWriting';
import { getLeadMagnets } from '@/libs/mcp/getLeadMagnets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
				"Tools for Brian's LinkedIn writing and business lead magnets. Use `lookup_linkedin_writing` to find relevant LinkedIn posts (over-fetches and prefers posts with high impressions, falls back to top 3). Use `get_lead_magnets` to retrieve Brian's current business lead magnets.",
		},
	);

	server.registerTool(
		'lookup_linkedin_writing',
		{
			title: "Lookup Brian's LinkedIn writing",
			description:
				"Semantic search over Brian's LinkedIn posts. Over-fetches candidates and prefers posts with higher impressions (default minImpressions=50). If no post clears that bar, returns the top 3 closest semantic matches.",
			inputSchema: {
				query: z
					.string()
					.min(1)
					.describe(
						'Natural language topic or excerpt to find similar LinkedIn posts for.',
					),
				minImpressions: z
					.number()
					.int()
					.nonnegative()
					.optional()
					.describe(
						'Minimum impression count for filtering. Defaults to 50.',
					),
				topK: z
					.number()
					.int()
					.positive()
					.max(25)
					.optional()
					.describe(
						'Max high-impression matches to return. Defaults to 5.',
					),
			},
		},
		async ({ query, minImpressions, topK }) => {
			const results = await lookupLinkedInWriting({
				query,
				minImpressions,
				topK,
			});

			return {
				content: [
					{
						type: 'text' as const,
						text:
							results.length === 0
								? 'No LinkedIn posts found.'
								: results
										.map((r, i) => {
											const parts = [
												`Post ${i + 1}`,
												r.numImpressions !== undefined
													? `impressions=${r.numImpressions}`
													: null,
												r.numReactions !== undefined
													? `reactions=${r.numReactions}`
													: null,
												r.createdAt
													? `createdAt=${r.createdAt}`
													: null,
												r.sourceUrl
													? `url=${r.sourceUrl}`
													: null,
											]
												.filter(Boolean)
												.join(' | ');
											return `${parts}\n${r.text}`;
										})
										.join('\n\n---\n\n'),
					},
				],
				structuredContent: { results },
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
