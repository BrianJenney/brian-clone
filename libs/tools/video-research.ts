import { tool } from 'ai';
import { z } from 'zod';
import { analyzeChannel, researchTopic } from '../videoResearch';

const BRIAN_CHANNEL_ID = 'UC1LJVKQ0hp7sKyfAbKoDHMw';

export const analyzeChannelTool = tool({
	description:
		"Analyze Brian's YouTube channel recent video performance and get stats on what's working. Returns average views, engagement rates, and top performing videos.",
	inputSchema: z.object({
		maxVideos: z
			.number()
			.optional()
			.describe('Number of recent videos to analyze (default: 10)'),
	}),
	execute: async (args: { maxVideos?: number }) => {
		try {
			const result = await analyzeChannel(
				BRIAN_CHANNEL_ID,
				args.maxVideos || 10
			);
			return result.stats;
		} catch (error) {
			console.error('Error analyzing channel:', error);
			return 'Unable to analyze channel at this time.';
		}
	},
});

export const researchTopicTool = tool({
	description:
		"Research a YouTube video topic to see what's trending and get strategic suggestions. Use this when evaluating video ideas or looking for content opportunities.",
	inputSchema: z.object({
		topic: z.string().describe('The video topic or idea to research'),
	}),
	execute: async (args: { topic: string }) => {
		try {
			const result = await researchTopic(args.topic);
			return result.suggestions;
		} catch (error) {
			console.error('Error researching topic:', error);
			return 'Unable to research topics at this time.';
		}
	},
});
