/**
 * YouTube API Service
 * Fetches channel data and video statistics from YouTube
 */

export type YouTubeVideo = {
	id: string;
	title: string;
	description: string;
	publishedAt: string;
	url: string;
	thumbnailUrl: string;
	viewCount: number;
	likeCount: number;
	commentCount: number;
	engagementRate: number;
};

export type YouTubeChannelStats = {
	channelId: string;
	subscriberCount: number;
	totalViews: number;
	videoCount: number;
};

/**
 * Fetch the last N videos from a YouTube channel
 */
export async function fetchChannelVideos(
	channelId: string,
	maxResults: number = 12,
	apiKey?: string
): Promise<YouTubeVideo[]> {
	const key = apiKey || process.env.YOUTUBE_API_KEY;

	if (!key) {
		throw new Error('YouTube API key is required');
	}

	try {
		// Step 1: Get the uploads playlist ID
		const channelResponse = await fetch(
			`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&id=${channelId}&key=${key}`
		);

		if (!channelResponse.ok) {
			throw new Error(
				`Failed to fetch channel: ${channelResponse.statusText}`
			);
		}

		const channelData = await channelResponse.json();
		const uploadsPlaylistId =
			channelData.items[0]?.contentDetails?.relatedPlaylists?.uploads;

		if (!uploadsPlaylistId) {
			throw new Error('Could not find uploads playlist');
		}

		// Step 2: Get videos from uploads playlist
		const playlistResponse = await fetch(
			`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${key}`
		);

		if (!playlistResponse.ok) {
			throw new Error(
				`Failed to fetch playlist: ${playlistResponse.statusText}`
			);
		}

		const playlistData = await playlistResponse.json();
		const videoIds = playlistData.items
			.map((item: any) => item.snippet?.resourceId?.videoId)
			.filter(Boolean);

		if (videoIds.length === 0) {
			return [];
		}

		// Step 3: Get detailed statistics for each video
		const videosResponse = await fetch(
			`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(
				','
			)}&key=${key}`
		);

		if (!videosResponse.ok) {
			throw new Error(
				`Failed to fetch video details: ${videosResponse.statusText}`
			);
		}

		const videosData = await videosResponse.json();

		// Step 4: Transform to our format
		return videosData.items.map((video: any) => {
			const views = Number.parseInt(video.statistics.viewCount || '0');
			const likes = Number.parseInt(video.statistics.likeCount || '0');
			const comments = Number.parseInt(
				video.statistics.commentCount || '0'
			);

			// Calculate engagement rate: (likes + comments) / views * 100
			const engagementRate =
				views > 0 ? ((likes + comments) / views) * 100 : 0;

			return {
				id: video.id,
				title: video.snippet.title,
				description: video.snippet.description,
				publishedAt: video.snippet.publishedAt,
				url: `https://www.youtube.com/watch?v=${video.id}`,
				thumbnailUrl:
					video.snippet.thumbnails?.high?.url ||
					video.snippet.thumbnails?.default?.url,
				viewCount: views,
				likeCount: likes,
				commentCount: comments,
				engagementRate,
			};
		});
	} catch (error) {
		console.error('Error fetching YouTube videos:', error);
		throw error;
	}
}

/**
 * Get channel statistics
 */
export async function fetchChannelStats(
	channelId: string,
	apiKey?: string
): Promise<YouTubeChannelStats> {
	const key = apiKey || process.env.YOUTUBE_API_KEY;

	if (!key) {
		throw new Error('YouTube API key is required');
	}

	const response = await fetch(
		`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${key}`
	);

	if (!response.ok) {
		throw new Error(
			`Failed to fetch channel stats: ${response.statusText}`
		);
	}

	const data = await response.json();
	const stats = data.items[0]?.statistics;

	return {
		channelId,
		subscriberCount: Number.parseInt(stats?.subscriberCount || '0'),
		totalViews: Number.parseInt(stats?.viewCount || '0'),
		videoCount: Number.parseInt(stats?.videoCount || '0'),
	};
}
