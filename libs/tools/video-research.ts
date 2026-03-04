import { tool } from 'ai';
import { z } from 'zod';
import { analyzeChannel, researchTopic } from '../videoResearch';

const BRIAN_CHANNEL_ID = 'UC1LJVKQ0hp7sKyfAbKoDHMw';

export const analyzeChannelTool = tool({
	description:
		'PRIMARY channel context tool. Use this first for any request about video ideas, what to post next, top/high performers, channel performance, titles/thumbnails based on past results, or prioritizing options. Returns recent-channel performance stats, including average views, engagement rates, and top-performing videos.',
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
				args.maxVideos || 10,
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
		"Topic trend tool. Use this after channel analysis when comparing or validating specific video ideas, angles, or hooks. Use this alone only when the user asks purely for trend research with no request to consider Brian's channel history.",
	inputSchema: z.object({
		topic: z.string().describe('The video topic or idea to research'),
	}),

	execute: async (args: { topic: string }) => {
		try {
			const channelAnalysis = await analyzeChannel(BRIAN_CHANNEL_ID, 10);
			const result = await researchTopic(args.topic);
			return `Channel analysis: ${channelAnalysis.stats}\nTopic research: ${result.suggestions}`;
		} catch (error) {
			console.error('Error researching topic:', error);
			return 'Unable to research topics at this time.';
		}
	},
});
