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

type ToolInput = Record<string, unknown>;

/**
 * Execute a tool by name with given input
 */
export async function executeTool(
	name: string,
	input: ToolInput,
): Promise<string> {
	try {
		switch (name) {
			case 'searchWritingSamples':
				return await searchWritingSamplesTool.invoke({
					query: String(input.query || ''),
				});

			case 'searchLinkedInPosts':
				return await searchLinkedInPostsTool.invoke({
					query: String(input.query || ''),
				});

			case 'getBusinessContext':
				return await getBusinessContextTool.invoke({});

			case 'getRecentContent':
				return await getRecentContentTool.invoke({});

			case 'searchResources':
				return await searchResourcesTool.invoke({
					query: String(input.query || ''),
				});

			case 'analyzeChannel':
				return await analyzeChannelTool.invoke({
					maxVideos: Number(input.maxVideos) || 10,
				});

			case 'researchTopic':
				return await researchTopicTool.invoke({
					topic: String(input.topic || ''),
				});

			case 'excalidrawer':
				return await excalidrawerTool.invoke({
					request: String(input.request || ''),
				});

			default:
				return `Unknown tool: ${name}`;
		}
	} catch (error) {
		console.error(`Error executing tool ${name}:`, error);
		return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}
