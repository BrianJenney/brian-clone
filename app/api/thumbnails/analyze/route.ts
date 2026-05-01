import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import Anthropic from '@anthropic-ai/sdk';
import { anthropic } from '@/libs/anthropic';
import { qdrantClient, COLLECTIONS } from '@/libs/qdrant';
import { generateVoyageEmbedding } from '@/libs/voyage';

type ContentBlockParam = Anthropic.ContentBlockParam;

// Request schema
const requestSchema = z.object({
	concept: z.string().min(1).max(500),
	filters: z
		.object({
			niche: z.string().optional(),
			minPerformanceScore: z.number().min(0).max(10).optional(),
			hasText: z.boolean().optional(),
			hasFaces: z.boolean().optional(),
			colorMood: z.string().optional(),
		})
		.optional(),
	limit: z.number().min(1).max(50).default(15),
});

// Claude response schemas
const expansionSchema = z.object({
	search_concepts: z
		.array(z.string())
		.describe('3-5 semantic search queries to find relevant thumbnails'),
	visual_patterns: z
		.array(z.string())
		.describe('Expected visual patterns in thumbnails for this concept'),
	suggested_filters: z
		.object({
			hasFaces: z.boolean().nullable().optional(),
			hasText: z.boolean().nullable().optional(),
			colorMood: z
				.enum(['dark', 'bright', 'vibrant', 'muted', 'high-contrast'])
				.nullable()
				.optional(),
		})
		.optional(),
});

const directionSchema = z.object({
	name: z.string().describe('Short name for this design direction'),
	description: z.string().describe('What this direction involves'),
	key_elements: z.array(z.string()).describe('Key visual elements to include'),
	reference_thumbnails: z
		.array(z.string())
		.optional()
		.describe('Video IDs of reference thumbnails'),
});

const analysisSchema = z.object({
	pattern_summary: z
		.string()
		.describe('2-3 sentence summary of the dominant patterns'),
	common_elements: z.object({
		composition: z.array(z.string()).describe('Common composition approaches'),
		colors: z.array(z.string()).describe('Common color strategies'),
		text: z.array(z.string()).describe('Common text approaches'),
		faces: z.array(z.string()).describe('How faces are used'),
	}),
	directions: z.array(directionSchema).describe('3 distinct design directions'),
	anti_patterns: z
		.array(z.string())
		.describe('Things successful thumbnails avoid'),
	niche_specific_insights: z
		.string()
		.describe('What works specifically for this niche'),
});

// Qdrant payload schema
const thumbnailPayloadSchema = z.object({
	video_id: z.string(),
	title: z.string(),
	channel: z.string(),
	thumbnail_url: z.string(),
	performance_score: z.number(),
	view_count: z.number(),
	description: z.string().optional(),
	composition_layout: z.string().optional(),
	has_text: z.boolean().optional(),
	text_content: z.string().optional(),
	face_count: z.number().optional(),
	dominant_color: z.string().optional(),
	color_mood: z.string().optional(),
	style_tags: z.array(z.string()).optional(),
});

type ThumbnailPayload = z.infer<typeof thumbnailPayloadSchema>;

// Convert Zod to JSON Schema for tool definitions
function zodToToolSchema(schema: z.ZodTypeAny): Record<string, unknown> {
	const jsonSchema = zodToJsonSchema(schema, { $refStrategy: 'none' });
	const { $schema, ...rest } = jsonSchema as Record<string, unknown>;
	return rest;
}

// Parse Claude response with tool_choice
async function parseWithTool<T>(
	schema: z.ZodType<T>,
	toolName: string,
	systemPrompt: string,
	userContent: string | ContentBlockParam[],
	maxTokens = 1000
): Promise<T> {
	const response = await anthropic.messages.create({
		model: 'claude-sonnet-4-5-20250929',
		max_tokens: maxTokens,
		system: systemPrompt,
		tools: [
			{
				name: toolName,
				description: `Structured output for ${toolName}`,
				input_schema: zodToToolSchema(schema) as {
					type: 'object';
					properties?: Record<string, unknown>;
				},
			},
		],
		tool_choice: { type: 'tool', name: toolName },
		messages: [{ role: 'user', content: userContent }],
	});

	const toolUse = response.content.find((block) => block.type === 'tool_use');
	if (!toolUse || toolUse.type !== 'tool_use') {
		throw new Error('No tool use in response');
	}

	return schema.parse(toolUse.input);
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { concept, filters, limit } = requestSchema.parse(body);

		// Step 1: Expand concept with Claude
		const expansion = await parseWithTool(
			expansionSchema,
			'expand_concept',
			'Expand the video concept into 3-5 semantic search queries for finding relevant YouTube thumbnails.',
			concept,
			500
		);

		// Step 2: Build Qdrant filters
		const qdrantFilter: { must: Array<Record<string, unknown>> } = { must: [] };

		if (filters?.minPerformanceScore) {
			qdrantFilter.must.push({
				key: 'performance_score',
				range: { gte: filters.minPerformanceScore },
			});
		}

		if (filters?.hasText !== undefined) {
			qdrantFilter.must.push({
				key: 'has_text',
				match: { value: filters.hasText },
			});
		}

		if (filters?.hasFaces !== undefined) {
			qdrantFilter.must.push({
				key: 'face_count',
				range: filters.hasFaces ? { gte: 1 } : { lte: 0 },
			});
		}

		if (filters?.colorMood) {
			qdrantFilter.must.push({
				key: 'color_mood',
				match: { value: filters.colorMood },
			});
		}

		// Step 3: Multi-query retrieval
		const allResults: ThumbnailPayload[] = [];
		const seenIds = new Set<string>();

		for (const query of expansion.search_concepts.slice(0, 5)) {
			const embedding = await generateVoyageEmbedding(query);

			const searchResult = await qdrantClient.search(COLLECTIONS.THUMBNAILS, {
				vector: embedding,
				limit: Math.ceil(limit / expansion.search_concepts.length) + 5,
				filter: qdrantFilter.must.length > 0 ? qdrantFilter : undefined,
				with_payload: true,
			});

			for (const result of searchResult) {
				const parsed = thumbnailPayloadSchema.safeParse(result.payload);
				if (parsed.success && !seenIds.has(parsed.data.video_id)) {
					seenIds.add(parsed.data.video_id);
					allResults.push(parsed.data);
				}
			}
		}

		// Step 4: Sort by performance and take top K
		const topResults = allResults
			.sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))
			.slice(0, limit);

		if (topResults.length === 0) {
			return Response.json({
				concept,
				expansion,
				pattern_summary: 'No matching thumbnails found in the database.',
				directions: [],
				references: [],
			});
		}

		// Step 5: Prepare images for Claude analysis
		const thumbnailImages = await Promise.all(
			topResults.slice(0, 10).map(async (t) => {
				try {
					const response = await fetch(t.thumbnail_url);
					if (!response.ok) return null;
					const buffer = await response.arrayBuffer();
					const base64 = Buffer.from(buffer).toString('base64');
					return {
						type: 'image' as const,
						source: {
							type: 'base64' as const,
							media_type: 'image/jpeg' as const,
							data: base64,
						},
					};
				} catch {
					return null;
				}
			})
		);

		const validImages = thumbnailImages.filter(
			(img) => img !== null
		);

		// Step 6: Analyze patterns with Claude
		const analysisContext = topResults
			.slice(0, 10)
			.map(
				(t, i) =>
					`[${i + 1}] "${t.title}" by ${t.channel} - Score: ${t.performance_score}, Views: ${t.view_count}`
			)
			.join('\n');

		const analysis = await parseWithTool(
			analysisSchema,
			'analyze_thumbnails',
			'Analyze these YouTube thumbnails to identify design patterns and provide 3 actionable directions.',
			[
				...validImages,
				{
					type: 'text' as const,
					text: `Concept: ${concept}\n\nThumbnails:\n${analysisContext}\n\nProvide 3 design directions.`,
				},
			] as ContentBlockParam[],
			1500
		);

		return Response.json({
			concept,
			expansion,
			...analysis,
			references: topResults.map((t) => ({
				video_id: t.video_id,
				title: t.title,
				channel: t.channel,
				thumbnail_url: t.thumbnail_url,
				performance_score: t.performance_score,
				view_count: t.view_count,
				composition: t.composition_layout,
				has_text: t.has_text,
				face_count: t.face_count,
				color_mood: t.color_mood,
				style_tags: t.style_tags,
			})),
		});
	} catch (error) {
		console.error('Thumbnail analysis error:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return Response.json({ error: message }, { status: 500 });
	}
}
