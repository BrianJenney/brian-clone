import { tool } from '@langchain/core/tools';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { z } from 'zod';

const api = SpotifyApi.withClientCredentials(
	process.env.SPOTIFY_CLIENT_ID!,
	process.env.SPOTIFY_CLIENT_SECRET!,
);

export const spotifySearchTool = tool(
	async (args: { query: string }) => {
		const items = await api.search('Develop Yourself', ['show', 'episode']);

		return items.shows.items
			.map((item) => ({
				description: item.description,
				publisher: item.publisher,
			}))
			.slice(0, 10)
			.join('\n\n');
	},
	{
		name: 'spotifySearchTool',
		description: 'Get information about my podcast Develop Yourself',
		schema: z.object({
			query: z.string().describe('The query to search for'),
		}),
	},
);
