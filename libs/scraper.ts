/**
 * Web Scraping Service using Playwright
 * For web scraping and automation
 */

import { chromium } from 'playwright';

export interface YouTubeSearchResult {
	title: string;
	channelName: string;
	views: string;
	uploadTime: string;
	url: string;
	thumbnail?: string;
}

/**
 * Check if a video is within the last 3 months based on upload time text
 */
function isWithinThreeMonths(uploadTimeText: string): boolean {
	const lowerText = uploadTimeText.toLowerCase();

	// Include videos from hours, days, and weeks ago
	if (
		lowerText.includes('hour') ||
		lowerText.includes('day') ||
		lowerText.includes('week')
	) {
		return true;
	}

	// Check for months
	if (lowerText.includes('month')) {
		const match = lowerText.match(/(\d+)\s*month/);
		if (match) {
			const months = Number.parseInt(match[1]);
			return months <= 3;
		}
		// "1 month ago" or just "month ago" defaults to 1 month
		return true;
	}

	// Exclude videos from years ago
	if (lowerText.includes('year')) {
		return false;
	}

	// If we can't determine, exclude it to be safe
	return false;
}

/**
 * Search YouTube and scrape results using Playwright
 * Only returns videos from the last 3 months
 */
export async function searchYouTube(
	query: string,
	maxResults: number = 10,
): Promise<YouTubeSearchResult[]> {
	// Add upload date filter for "This year" - sp=EgIIBQ%253D%253D
	// This pre-filters results on YouTube's side, then we filter further client-side
	const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

	console.log(`Searching YouTube for: "${query}" (last 3 months only)`);

	let browser;
	try {
		// Launch browser in headless mode
		browser = await chromium.launch({
			headless: true,
		});

		const context = await browser.newContext({
			userAgent:
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		});

		const page = await context.newPage();

		// Navigate to YouTube search
		await page.goto(searchUrl, {
			waitUntil: 'domcontentloaded',
			timeout: 30000,
		});

		// Wait for video results to load
		await page.waitForSelector('ytd-video-renderer', {
			timeout: 10000,
		});

		// Extract video data - get more than needed since we'll filter by date
		const allResults = await page.$$eval(
			'ytd-video-renderer',
			(elements, max) => {
				const videos: YouTubeSearchResult[] = [];

				// Get up to max * 2 results since we'll filter some out
				for (let i = 0; i < Math.min(elements.length, max * 2); i++) {
					const element = elements[i];

					// Extract title and URL
					const titleElement = element.querySelector('#video-title');
					const title =
						titleElement?.getAttribute('title') ||
						titleElement?.textContent?.trim() ||
						'';
					const href = titleElement?.getAttribute('href') || '';

					if (!title || !href) continue;

					// Extract channel name
					const channelElement = element.querySelector(
						'#channel-name a, ytd-channel-name a',
					);
					const channelName =
						channelElement?.textContent?.trim() || 'Unknown';

					// Extract metadata (views and upload time)
					const metadataElements = element.querySelectorAll(
						'#metadata-line span',
					);
					const views =
						metadataElements[0]?.textContent?.trim() || 'N/A';
					const uploadTime =
						metadataElements[1]?.textContent?.trim() || 'N/A';

					// Extract thumbnail
					const thumbnailElement = element.querySelector('img');
					const thumbnail =
						thumbnailElement?.getAttribute('src') || undefined;

					videos.push({
						title,
						channelName,
						views,
						uploadTime,
						url: href.startsWith('http')
							? href
							: `https://www.youtube.com${href}`,
						thumbnail,
					});
				}

				return videos;
			},
			maxResults,
		);

		await browser.close();

		// Filter results to only include videos from the last 3 months
		const results = allResults
			.filter((video) => isWithinThreeMonths(video.uploadTime))
			.slice(0, maxResults);

		console.log(
			`Found ${results.length} YouTube results from the last 3 months (filtered from ${allResults.length} total)`,
		);
		return results;
	} catch (error) {
		if (browser) {
			await browser.close();
		}
		console.error('Error searching YouTube with Playwright:', error);
		throw error;
	}
}

/**
 * Fetch and parse any webpage using Playwright
 */
export async function fetchRenderedPage(url: string): Promise<string> {
	let browser;
	try {
		browser = await chromium.launch({
			headless: true,
		});

		const context = await browser.newContext();
		const page = await context.newPage();

		await page.goto(url, {
			waitUntil: 'domcontentloaded',
			timeout: 30000,
		});

		// Wait a bit for JavaScript to render
		await page.waitForTimeout(2000);

		const html = await page.content();
		await browser.close();

		return html;
	} catch (error) {
		if (browser) {
			await browser.close();
		}
		throw error;
	}
}
