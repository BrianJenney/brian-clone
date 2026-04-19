import {
	fetchChannelVideos,
	fetchChannelStats,
	resolveChannelId,
	type YouTubeVideo,
	type YouTubeChannelStats,
} from '@/libs/youtube';

export type YouTubeChannelData = {
	stats: YouTubeChannelStats;
	recentVideos: YouTubeVideo[];
	topPerformers: YouTubeVideo[];
	analysis: {
		averageViews: number;
		averageEngagement: number;
		totalVideos: number;
		trends: {
			viewsDistribution: string;
			engagementInsights: string;
		};
	};
};

const DEFAULT_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

export async function getYouTubeChannel(
	channelIdOrHandle?: string,
	maxVideos: number = 12
): Promise<YouTubeChannelData> {
	const input = channelIdOrHandle || DEFAULT_CHANNEL_ID;

	if (!input) {
		throw new Error(
			'YouTube channel ID or handle is required. Set YOUTUBE_CHANNEL_ID env var or pass channelId parameter.'
		);
	}

	// Resolve handle to channel ID if needed
	const id = await resolveChannelId(input);

	// Fetch channel stats and videos in parallel
	const [stats, videos] = await Promise.all([
		fetchChannelStats(id),
		fetchChannelVideos(id, maxVideos),
	]);

	// Calculate analytics
	const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
	const totalEngagement = videos.reduce((sum, v) => sum + v.engagementRate, 0);
	const averageViews = videos.length > 0 ? totalViews / videos.length : 0;
	const averageEngagement =
		videos.length > 0 ? totalEngagement / videos.length : 0;

	// Sort by views to get top performers
	const sortedByViews = [...videos].sort((a, b) => b.viewCount - a.viewCount);
	const topPerformers = sortedByViews.slice(0, 3);

	// Calculate views distribution
	const highThreshold = averageViews * 1.5;
	const lowThreshold = averageViews * 0.5;
	const high = videos.filter((v) => v.viewCount >= highThreshold).length;
	const low = videos.filter((v) => v.viewCount <= lowThreshold).length;
	const medium = videos.length - high - low;

	// Engagement insights
	const aboveAverageEngagement = videos.filter(
		(v) => v.engagementRate > averageEngagement
	).length;

	return {
		stats,
		recentVideos: videos,
		topPerformers,
		analysis: {
			averageViews: Math.round(averageViews),
			averageEngagement: Math.round(averageEngagement * 100) / 100,
			totalVideos: videos.length,
			trends: {
				viewsDistribution: `High: ${high}, Medium: ${medium}, Low: ${low}`,
				engagementInsights: `${aboveAverageEngagement} of ${videos.length} videos have above-average engagement`,
			},
		},
	};
}
