import { getYouTubeChannel, type YouTubeChannelData } from './getYouTubeChannel';

export const COMPETITORS = {
	owainlewis: {
		name: 'Owain Lewis',
		handle: '@owainlewis',
	},
	whatsai: {
		name: 'Louis-François Bouchard',
		handle: '@WhatsAI',
	},
} as const;

export type CompetitorKey = keyof typeof COMPETITORS;

export type CompetitorAnalysis = {
	competitor: {
		key: CompetitorKey;
		name: string;
		handle: string;
	};
	data: YouTubeChannelData;
};

export async function getCompetitorChannel(
	competitor: CompetitorKey,
	maxVideos: number = 12
): Promise<CompetitorAnalysis> {
	const info = COMPETITORS[competitor];
	const data = await getYouTubeChannel(info.handle, maxVideos);

	return {
		competitor: {
			key: competitor,
			name: info.name,
			handle: info.handle,
		},
		data,
	};
}

export async function getAllCompetitors(
	maxVideos: number = 6
): Promise<CompetitorAnalysis[]> {
	const results = await Promise.all(
		(Object.keys(COMPETITORS) as CompetitorKey[]).map((key) =>
			getCompetitorChannel(key, maxVideos)
		)
	);
	return results;
}
