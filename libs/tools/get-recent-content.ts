import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { fetchChannelVideos } from '@/libs/youtube';

const BRIAN_CHANNEL_ID = 'UC1LJVKQ0hp7sKyfAbKoDHMw';
const MEDIUM_USERNAME = process.env.MEDIUM_USERNAME || 'brianjenney';

type RecentContent = {
	linkedin: Array<{
		text: string;
		publishedAt: string;
		impressions?: number;
		reactions?: number;
	}>;
	youtube: Array<{
		title: string;
		publishedAt: string;
		views: number;
		url: string;
	}>;
	medium: Array<{
		title: string;
		publishedAt: string;
		url: string;
	}>;
};

async function fetchLinkedInPosts(): Promise<RecentContent['linkedin']> {
	const apiKey = process.env.AUTHOREDUP_API_KEY;
	if (!apiKey) {
		console.log('AUTHOREDUP_API_KEY not configured');
		return [];
	}

	try {
		const now = new Date();
		const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const formatDate = (d: Date) => d.toISOString().split('.')[0] + 'Z';

		const url = new URL('https://api.authoredup.com/external/api/v1/posts');
		url.searchParams.set('from-date', formatDate(sevenDaysAgo));
		url.searchParams.set('to-date', formatDate(now));

		const response = await fetch(url.toString(), {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) return [];

		const data = await response.json();
		const posts = data.items || [];

		return posts.slice(0, 3).map((post: any) => ({
			text:
				post.text?.slice(0, 200) +
				(post.text?.length > 200 ? '...' : ''),
			publishedAt: post.post_published_at,
			impressions: post.impression_count,
			reactions: post.reaction_count,
		}));
	} catch (error) {
		console.error('Error fetching LinkedIn posts:', error);
		return [];
	}
}

async function fetchYouTubeVideos(): Promise<RecentContent['youtube']> {
	try {
		const videos = await fetchChannelVideos(BRIAN_CHANNEL_ID, 3);
		return videos.map((v) => ({
			title: v.title,
			publishedAt: v.publishedAt,
			views: v.viewCount,
			url: v.url,
		}));
	} catch (error) {
		console.error('Error fetching YouTube videos:', error);
		return [];
	}
}

async function fetchMediumPosts(): Promise<RecentContent['medium']> {
	try {
		const rssUrl = `https://medium.com/feed/@${MEDIUM_USERNAME}`;
		const response = await fetch(rssUrl);
		if (!response.ok) return [];

		const xml = await response.text();

		// Simple XML parsing for RSS items
		const items: RecentContent['medium'] = [];
		const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

		for (const item of itemMatches.slice(0, 3)) {
			const title =
				item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
				item.match(/<title>(.*?)<\/title>/)?.[1] ||
				'';
			const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
			const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

			if (title && link) {
				items.push({
					title,
					url: link,
					publishedAt: pubDate,
				});
			}
		}

		return items;
	} catch (error) {
		console.error('Error fetching Medium posts:', error);
		return [];
	}
}

function formatRelativeDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffDays = Math.floor(
		(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
	);

	if (diffDays === 0) return 'today';
	if (diffDays === 1) return 'yesterday';
	if (diffDays < 7) return `${diffDays} days ago`;
	if (diffDays < 30)
		return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get Recent Content Tool
 * Fetches recent content from LinkedIn, Medium, and YouTube APIs
 * Returns a brief summary for quick suggestions
 */
export const getRecentContentTool = tool(
	async (): Promise<string> => {
		const [linkedin, youtube, medium] = await Promise.all([
			fetchLinkedInPosts(),
			fetchYouTubeVideos(),
			fetchMediumPosts(),
		]);

		const summary: string[] = [];

		// Brief status for each platform
		if (linkedin.length > 0) {
			const last = linkedin[0];
			summary.push(`LinkedIn: last post ${formatRelativeDate(last.publishedAt)}${last.impressions ? ` (${last.impressions.toLocaleString()} impressions)` : ''}`);
		} else {
			summary.push('LinkedIn: no recent posts');
		}

		if (youtube.length > 0) {
			const last = youtube[0];
			summary.push(`YouTube: "${last.title}" posted ${formatRelativeDate(last.publishedAt)} (${last.views.toLocaleString()} views)`);
		} else {
			summary.push('YouTube: no recent videos');
		}

		if (medium.length > 0) {
			const last = medium[0];
			summary.push(`Medium: "${last.title}" posted ${formatRelativeDate(last.publishedAt)}`);
		} else {
			summary.push('Medium: no recent articles');
		}

		return summary.join('\n');
	},
	{
		name: 'getRecentContentTool',
		description:
			'Fetch recent content activity from LinkedIn (last 3 posts), YouTube (last 3 videos), and Medium (last 3 articles) to suggest what to work on next.',
		schema: z.object({}),
	},
);
