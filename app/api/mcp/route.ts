import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { timingSafeEqual } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import { traceable } from "langsmith/traceable";
import { z } from "zod";
import {
  type CompetitorKey,
  getAllCompetitors,
  getCompetitorChannel,
} from "@/libs/mcp/getCompetitorChannels";
import { getLeadMagnets } from "@/libs/mcp/getLeadMagnets";
import { getYouTubeChannel } from "@/libs/mcp/getYouTubeChannel";
import { lookupWriting, type WritingHit } from "@/libs/mcp/lookupWriting";
import { baseUrl, verify } from "@/libs/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// LangSmith-traced wrappers. When LANGSMITH_TRACING=true each MCP tool call
// becomes a run (nesting the wrapped OpenAI calls); otherwise these are
// transparent passthroughs.
const tracedLookupWriting = traceable(lookupWriting, {
  name: "lookup_writing",
  run_type: "tool",
});
const tracedGetLeadMagnets = traceable(getLeadMagnets, {
  name: "get_lead_magnets",
  run_type: "tool",
});
const tracedGetYouTubeChannel = traceable(getYouTubeChannel, {
  name: "get_youtube_channel",
  run_type: "tool",
});
const tracedGetCompetitorChannel = traceable(getCompetitorChannel, {
  name: "get_competitors",
  run_type: "tool",
});
const tracedGetAllCompetitors = traceable(getAllCompetitors, {
  name: "get_competitors_all",
  run_type: "tool",
});

function formatHit(h: WritingHit, index: number): string {
  const parts: (string | null)[] = [`#${index} [${h.source}]`];

  if (h.source === "post") {
    if (h.numImpressions !== undefined)
      parts.push(`impressions=${h.numImpressions}`);
    if (h.numReactions !== undefined) parts.push(`reactions=${h.numReactions}`);
    if (h.createdAt) parts.push(`createdAt=${h.createdAt}`);
  } else {
    if (h.title) parts.push(`title="${h.title}"`);
    if (h.author) parts.push(`author=${h.author}`);
    if (h.date) parts.push(`date=${h.date}`);
  }
  if (h.sourceUrl) parts.push(`url=${h.sourceUrl}`);

  return `${parts.filter(Boolean).join(" | ")}\n${h.text}`;
}

function unauthorized(req: Request): Response {
  const base = baseUrl(req);
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer realm="mcp", error="invalid_token", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      },
    },
  );
}

function authorized(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = match[1].trim();

  // Static token — Claude Code / MCP Inspector.
  const expected = process.env.MCP_AUTH_TOKEN;
  if (expected) {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }

  // OAuth access token — claude.ai / Desktop connector.
  return verify(provided, "access") !== null;
}

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "brian-clone-mcp", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Tools for Brian's writing, business, and YouTube analytics. Use `lookup_writing` to find relevant content across articles, LinkedIn posts, and transcripts — an internal router picks which collections to search, and LinkedIn posts are over-fetched and preferred by impressions (falls back to top 3). Use `get_lead_magnets` to retrieve Brian's current business lead magnets. Use `get_offer_stack` for the AI Engineering program's objection → solution map — call it together with `lookup_writing` for any writing task touching the AI program, since it supplies the reader's objections and Brian's credible claims while `lookup_writing` supplies voice and prior art. Use `get_youtube_channel` for Brian's YouTube analytics. Use `get_competitors` to analyze tracked competitors (Owain Lewis and Louis-François Bouchard).",
    },
  );

  server.registerTool(
    "lookup_writing",
    {
      title: "Lookup Brian's writing",
      description:
        "Semantic search across Brian's articles, LinkedIn posts, and transcripts. An LLM router decides which collections are relevant to the query (override with `sources` if you know). LinkedIn posts are over-fetched and filtered to those with `numImpressions >= minImpressions` (default 50), falling back to the top 3 semantic matches if none qualify. Articles and transcripts return the top `topK` semantic matches. When drafting anything (post, email, video script, landing copy), call `get_offer_stack` alongside this tool: this returns voice and prior art, `get_offer_stack` returns the objections to write against and the claims Brian can credibly make.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Natural language topic or excerpt to search for."),
        sources: z
          .array(z.enum(["article", "post", "transcript"]))
          .optional()
          .describe(
            "Optional override for which collections to search. Omit to let the router decide.",
          ),
        minImpressions: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Minimum impressions for LinkedIn posts. Defaults to 50."),
        minReactions: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            "Minimum reactions for LinkedIn posts. Applied natively in Qdrant (posts only).",
          ),
        dateFrom: z
          .string()
          .optional()
          .describe(
            'ISO datetime lower bound on a LinkedIn post’s createdAt (posts only), e.g. "2025-01-01T00:00:00Z".',
          ),
        dateTo: z
          .string()
          .optional()
          .describe(
            "ISO datetime upper bound on a LinkedIn post’s createdAt (posts only).",
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe(
            "Restrict articles/transcripts to those tagged with any of these tags.",
          ),
        topK: z
          .number()
          .int()
          .positive()
          .max(25)
          .optional()
          .describe("Max matches per source. Defaults to 5."),
      },
    },
    async ({
      query,
      sources,
      minImpressions,
      minReactions,
      dateFrom,
      dateTo,
      tags,
      topK,
    }) => {
      const response = await tracedLookupWriting({
        query,
        sources,
        minImpressions,
        minReactions,
        dateFrom,
        dateTo,
        tags,
        topK,
      });

      const header = `Searched: ${response.chosenSources.join(", ")}${
        response.routerReasoning ? ` — ${response.routerReasoning}` : ""
      }`;

      const body =
        response.hits.length === 0
          ? "No matching writing found."
          : response.hits
              .map((h: WritingHit, i: number) => formatHit(h, i + 1))
              .join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text: `${header}\n\n${body}` }],
        structuredContent: {
          chosenSources: response.chosenSources,
          routerReasoning: response.routerReasoning,
          hits: response.hits,
        } as unknown as { [x: string]: unknown },
      };
    },
  );

  server.registerTool(
    "get_lead_magnets",
    {
      title: "Brian's business lead magnets",
      description:
        "Returns Brian's current business lead magnets (free offers used to bring in new audience), sourced from the canonical business overview. Use when asked about free courses, lead magnets, or funnel top-of-funnel offers.",
      inputSchema: {},
    },
    async () => {
      const payload = await tracedGetLeadMagnets();
      return {
        content: [
          {
            type: "text" as const,
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
    "get_offer_stack",
    {
      title: "AI Engineering offer stack",
      description:
        "Returns the objection → solution map for the Parsity AI Engineering program (the 'grand slam offer' stack), plus the credibility story behind it. Call this for any writing task about the AI program — posts, emails, video scripts, sales and landing copy, content angles — not just direct objection handling: the objections are the reader's actual state of mind, so they are what the writing has to speak to. Pair with `lookup_writing` for voice and prior art.",
      inputSchema: {},
    },
    async () => {
      const text = await readFile(
        join(process.cwd(), "data", "context", "offer-stack.md"),
        "utf-8",
      );
      return { content: [{ type: "text" as const, text }] };
    },
  );

  server.registerTool(
    "get_youtube_channel",
    {
      title: "YouTube channel analytics",
      description:
        "Returns analytics and recent videos from a YouTube channel. Includes subscriber count, total views, recent videos with performance metrics, top performers, and engagement trends. Defaults to Brian's channel. Pass a handle (e.g. @owainlewis) or channel ID to analyze competitors.",
      inputSchema: {
        channel: z
          .string()
          .optional()
          .describe(
            "YouTube channel handle (e.g. @owainlewis) or channel ID. Defaults to Brian's channel if not provided.",
          ),
        maxVideos: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("Max recent videos to fetch. Defaults to 12."),
      },
    },
    async ({ channel, maxVideos }) => {
      const data = await tracedGetYouTubeChannel(channel, maxVideos ?? 12);

      const summary = [
        `Channel: ${data.stats.title}`,
        `Subscribers: ${data.stats.subscriberCount.toLocaleString()}`,
        `Total Views: ${data.stats.totalViews.toLocaleString()}`,
        `Total Videos: ${data.stats.videoCount.toLocaleString()}`,
        "",
        "--- Analysis ---",
        `Average Views per Video: ${data.analysis.averageViews.toLocaleString()}`,
        `Average Engagement Rate: ${data.analysis.averageEngagement}%`,
        `Views Distribution: ${data.analysis.trends.viewsDistribution}`,
        `Engagement Insights: ${data.analysis.trends.engagementInsights}`,
        "",
        "--- Top Performers ---",
        ...data.topPerformers.map(
          (v, i) =>
            `${i + 1}. "${v.title}" - ${v.viewCount.toLocaleString()} views, ${v.engagementRate}% engagement`,
        ),
        "",
        "--- Recent Videos ---",
        ...data.recentVideos.map(
          (v, i) =>
            `${i + 1}. "${v.title}" (${v.publishedAt}) - ${v.viewCount.toLocaleString()} views`,
        ),
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent: data as unknown as { [x: string]: unknown },
      };
    },
  );

  server.registerTool(
    "get_competitors",
    {
      title: "Competitor YouTube analytics",
      description:
        "Returns YouTube analytics for tracked competitors: Owain Lewis (@owainlewis) and Louis-François Bouchard (@WhatsAI). Compare their performance, recent videos, and engagement to yours.",
      inputSchema: {
        competitor: z
          .enum(["owainlewis", "whatsai", "all"])
          .optional()
          .describe(
            'Which competitor to analyze. "owainlewis" for Owain Lewis, "whatsai" for Louis-François Bouchard, or "all" for both. Defaults to "all".',
          ),
        maxVideos: z
          .number()
          .int()
          .positive()
          .max(20)
          .optional()
          .describe("Max recent videos per competitor. Defaults to 6."),
      },
    },
    async ({ competitor, maxVideos }) => {
      const vids = maxVideos ?? 6;

      if (!competitor || competitor === "all") {
        const results = await tracedGetAllCompetitors(vids);
        const summaries = results.map((r) => {
          const d = r.data;
          return [
            `## ${r.competitor.name} (${r.competitor.handle})`,
            `Subscribers: ${d.stats.subscriberCount.toLocaleString()}`,
            `Total Views: ${d.stats.totalViews.toLocaleString()}`,
            `Avg Views/Video: ${d.analysis.averageViews.toLocaleString()}`,
            `Avg Engagement: ${d.analysis.averageEngagement}%`,
            "",
            "Top Videos:",
            ...d.topPerformers.map(
              (v, i) =>
                `  ${i + 1}. "${v.title}" - ${v.viewCount.toLocaleString()} views`,
            ),
          ].join("\n");
        });

        return {
          content: [
            {
              type: "text" as const,
              text: summaries.join("\n\n---\n\n"),
            },
          ],
          structuredContent: results as unknown as {
            [x: string]: unknown;
          },
        };
      }

      const result = await tracedGetCompetitorChannel(
        competitor as CompetitorKey,
        vids,
      );
      const d = result.data;
      const summary = [
        `## ${result.competitor.name} (${result.competitor.handle})`,
        `Subscribers: ${d.stats.subscriberCount.toLocaleString()}`,
        `Total Views: ${d.stats.totalViews.toLocaleString()}`,
        `Total Videos: ${d.stats.videoCount.toLocaleString()}`,
        `Avg Views/Video: ${d.analysis.averageViews.toLocaleString()}`,
        `Avg Engagement: ${d.analysis.averageEngagement}%`,
        "",
        "Top Performers:",
        ...d.topPerformers.map(
          (v, i) =>
            `  ${i + 1}. "${v.title}" - ${v.viewCount.toLocaleString()} views, ${v.engagementRate}% engagement`,
        ),
        "",
        "Recent Videos:",
        ...d.recentVideos.map(
          (v, i) =>
            `  ${i + 1}. "${v.title}" (${v.publishedAt}) - ${v.viewCount.toLocaleString()} views`,
        ),
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
        structuredContent: result as unknown as {
          [x: string]: unknown;
        },
      };
    },
  );

  return server;
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) return unauthorized(req);

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
