import { fetchChannelVideos } from './youtube';
import { searchYouTube } from './scraper';
import { openai } from './openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

export type ChannelAnalysis = {
	stats: string;
	topVideos: Array<{
		title: string;
		views: number;
		engagement: number;
	}>;
};

export type TopicResearch = {
	suggestions: string;
};

export async function analyzeChannel(
	channelId: string,
	maxVideos: number = 10
): Promise<ChannelAnalysis> {
	const videos = await fetchChannelVideos(channelId, maxVideos);

	const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
	const avgViews = Math.round(totalViews / videos.length);
	const avgEngagement =
		videos.reduce((sum, v) => sum + v.engagementRate, 0) / videos.length;

	const sorted = [...videos].sort((a, b) => b.viewCount - a.viewCount);
	const top3 = sorted.slice(0, 3);

	const stats = `Last ${videos.length} videos:
- Avg views: ${avgViews.toLocaleString()}
- Avg engagement: ${avgEngagement.toFixed(2)}%

Top performers:
${top3
	.map(
		(v, i) =>
			`${i + 1}. "${
				v.title
			}" - ${v.viewCount.toLocaleString()} views, ${v.engagementRate.toFixed(
				2
			)}% engagement`
	)
	.join('\n')}`;

	return {
		stats,
		topVideos: top3.map((v) => ({
			title: v.title,
			views: v.viewCount,
			engagement: v.engagementRate,
		})),
	};
}

export async function researchTopic(query: string): Promise<TopicResearch> {
	const QueriesSchema = z.object({
		queries: z.array(z.string()).length(3),
	});

	const queriesRes = await openai.responses.parse({
		model: 'gpt-4o-mini',
		input: `Generate 3 YouTube search queries for: "${query}"

Focus on what's trending and popular.`,
		text: {
			format: zodTextFormat(QueriesSchema, 'queries'),
		},
	});

	const queries = queriesRes.output_parsed?.queries || [];

	const searchResults = await Promise.all(
		queries.map(async (q) => {
			try {
				const results = await searchYouTube(q, 5);
				return { query: q, results };
			} catch {
				return { query: q, results: [] };
			}
		})
	);

	const resultsText = searchResults
		.map((sr) => {
			const topVideos = sr.results
				.slice(0, 5)
				.map((v) => `  - "${v.title}" by ${v.channelName} (${v.views})`)
				.join('\n');
			return `Query: "${sr.query}"\n${topVideos || '  No results'}`;
		})
		.join('\n\n');

	const SuggestionsSchema = z.object({
		suggestions: z.string().describe('Practical video suggestions'),
	});

	const suggestionsRes = await openai.responses.parse({
		model: 'gpt-4o',
		input: `You are a YouTube strategist. Topic: "${query}"

Current trending content:

${resultsText}

Provide practical and actionable video suggestions covering:
1. Is this viable?
2. What angles would stand out?
3. Key considerations`,
		text: {
			format: zodTextFormat(SuggestionsSchema, 'suggestions'),
		},
	});

	return {
		suggestions:
			suggestionsRes.output_parsed?.suggestions ||
			'Unable to generate suggestions',
	};
}
