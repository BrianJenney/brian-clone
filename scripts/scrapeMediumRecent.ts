import { chromium, Browser, BrowserContext } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import {
	qdrantClient,
	initializeCollection,
	COLLECTIONS,
} from '../libs/qdrant';
import { generateEmbedding } from '../libs/openai';
import { chunkTextWithOverlap } from '../libs/utils/chunking';

const MEDIUM_PROFILE_URL = 'https://brianjenney.medium.com';
const DAYS_TO_SCRAPE = 7;

interface ArticleInfo {
	url: string;
	title: string;
	publishedAt: Date;
}

interface ArticleContent {
	title: string;
	text: string;
	url: string;
	publishedAt: Date;
}

/**
 * Get the date threshold for filtering articles
 */
function getDateThreshold(): Date {
	const threshold = new Date();
	threshold.setDate(threshold.getDate() - DAYS_TO_SCRAPE);
	threshold.setHours(0, 0, 0, 0);
	return threshold;
}

/**
 * Scrape the Medium profile page to find recent articles
 */
async function getRecentArticles(
	context: BrowserContext
): Promise<ArticleInfo[]> {
	const page = await context.newPage();

	console.log(`Navigating to ${MEDIUM_PROFILE_URL}...`);
	await page.goto(MEDIUM_PROFILE_URL, { waitUntil: 'domcontentloaded' });

	// Wait for Apollo state to be available
	await page.waitForFunction(() => (window as any).__APOLLO_STATE__, {
		timeout: 15000,
	});

	// Extract article info from Apollo state
	const articles = await page.evaluate(() => {
		const apollo = (window as any).__APOLLO_STATE__;
		const articles: { url: string; title: string; publishedAt: string }[] =
			[];

		for (const key of Object.keys(apollo)) {
			if (key.startsWith('Post:')) {
				const post = apollo[key];
				// Get URL from mediumUrl or uniqueSlug
				const url =
					post.mediumUrl ||
					(post.uniqueSlug
						? `https://brianjenney.medium.com/${post.uniqueSlug}`
						: null);
				const publishedAt =
					post.firstPublishedAt || post.latestPublishedAt;

				if (post.title && url && publishedAt) {
					articles.push({
						url,
						title: post.title,
						publishedAt: new Date(publishedAt).toISOString(),
					});
				}
			}
		}

		return articles;
	});

	await page.close();

	if (!articles || articles.length === 0) {
		throw new Error('No articles found on profile page');
	}

	const dateThreshold = getDateThreshold();
	console.log(
		`Filtering articles published after ${dateThreshold.toISOString()}`
	);

	// Filter to recent articles
	const recentArticles = articles
		.map((a) => ({
			...a,
			publishedAt: new Date(a.publishedAt),
		}))
		.filter((a) => a.publishedAt >= dateThreshold)
		.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

	console.log(
		`Found ${recentArticles.length} articles from the last ${DAYS_TO_SCRAPE} days`
	);

	return recentArticles;
}

/**
 * Scrape a single article's content using Apollo state
 */
async function scrapeArticle(
	context: BrowserContext,
	articleInfo: ArticleInfo
): Promise<ArticleContent | null> {
	const page = await context.newPage();

	try {
		console.log(`  Scraping: ${articleInfo.title}`);
		await page.goto(articleInfo.url, { waitUntil: 'domcontentloaded' });

		// Wait for Apollo state to be available
		await page.waitForFunction(() => (window as any).__APOLLO_STATE__, {
			timeout: 20000,
		});

		// Use a string-based evaluate to avoid TypeScript transpilation issues
		const markdown = await page.evaluate(`
			(function() {
				const apollo = window.__APOLLO_STATE__;
				if (!apollo) throw new Error('Apollo state not found');

				const postKey = Object.keys(apollo).find(k => k.startsWith('Post:'));
				if (!postKey) throw new Error('Post not found in Apollo state');

				const post = apollo[postKey];

				let paragraphRefs = [];
				if (post.content && post.content.bodyModel && post.content.bodyModel.paragraphs) {
					paragraphRefs = post.content.bodyModel.paragraphs;
				} else if (post.previewContent && post.previewContent.bodyModel && post.previewContent.bodyModel.paragraphs) {
					paragraphRefs = post.previewContent.bodyModel.paragraphs;
				} else {
					const paragraphKeys = Object.keys(apollo).filter(k => k.startsWith('Paragraph:'));
					if (paragraphKeys.length > 0) {
						paragraphRefs = paragraphKeys.map(k => ({ __ref: k }));
					}
				}

				if (paragraphRefs.length === 0) {
					throw new Error('No paragraphs found. Post keys: ' + Object.keys(post).join(', '));
				}

				const paragraphs = paragraphRefs
					.map(p => apollo[p.__ref])
					.filter(p => p && typeof p.text === 'string' && p.text.trim() && p.type !== 'IMG');

				return paragraphs.map(p => {
					switch (p.type) {
						case 'H1': return '# ' + p.text;
						case 'H2': return '## ' + p.text;
						case 'H3': return '### ' + p.text;
						case 'H4': return '#### ' + p.text;
						case 'ULI': return '- ' + p.text;
						case 'OLI': return '1. ' + p.text;
						case 'BQ': return '> ' + p.text;
						case 'PQ': return '> ' + p.text;
						case 'PRE': return '\`\`\`\\n' + p.text + '\\n\`\`\`';
						default: return p.text;
					}
				}).join('\\n\\n');
			})()
		`);

		return {
			title: articleInfo.title,
			text: `# ${articleInfo.title}\n\n${markdown}`,
			url: articleInfo.url,
			publishedAt: articleInfo.publishedAt,
		};
	} catch (error) {
		console.error(`  Failed to scrape ${articleInfo.title}:`, error);
		return null;
	} finally {
		await page.close();
	}
}

/**
 * Upload article to Qdrant
 */
async function uploadArticle(article: ArticleContent): Promise<boolean> {
	try {
		await initializeCollection(COLLECTIONS.ARTICLES);

		const chunks = chunkTextWithOverlap(article.text, 1500);
		const baseId = uuidv4();

		console.log(
			`  Uploading ${chunks.length} chunk(s) for: ${article.title}`
		);

		for (const chunk of chunks) {
			const embedding = await generateEmbedding(chunk.text);
			const chunkId = uuidv4();

			await qdrantClient.upsert(COLLECTIONS.ARTICLES, {
				wait: true,
				points: [
					{
						id: chunkId,
						vector: embedding,
						payload: {
							text: chunk.text,
							contentType: 'article',
							baseId,
							chunkIndex: chunk.index,
							totalChunks: chunk.totalChunks,
							source: 'medium-scraper',
							title: article.title,
							sourceUrl: article.url,
							publishedAt: article.publishedAt.toISOString(),
							uploadedAt: new Date().toISOString(),
						},
					},
				],
			});
		}

		return true;
	} catch (error) {
		console.error(`  Upload error for ${article.title}:`, error);
		return false;
	}
}

/**
 * Process articles concurrently with a concurrency limit
 */
async function processArticlesConcurrently(
	context: BrowserContext,
	articles: ArticleInfo[],
	concurrencyLimit: number = 3
): Promise<{ success: number; failed: number }> {
	let success = 0;
	let failed = 0;

	// Process in batches
	for (let i = 0; i < articles.length; i += concurrencyLimit) {
		const batch = articles.slice(i, i + concurrencyLimit);
		console.log(
			`\nProcessing batch ${
				Math.floor(i / concurrencyLimit) + 1
			}/${Math.ceil(articles.length / concurrencyLimit)}`
		);

		const results = await Promise.all(
			batch.map(async (articleInfo) => {
				const content = await scrapeArticle(context, articleInfo);
				if (content) {
					console.log(JSON.stringify(content, null, 2));
					return true;
					const uploaded = await uploadArticle(content);
					return uploaded;
				}
				return false;
			})
		);

		results.forEach((result) => {
			if (result) success++;
			else failed++;
		});
	}

	return { success, failed };
}

async function main() {
	console.log('='.repeat(60));
	console.log('Medium Article Scraper');
	console.log(`Looking for articles from the last ${DAYS_TO_SCRAPE} days`);
	console.log('='.repeat(60));

	const browser = await chromium.launch({
		headless: true,
		args: [
			'--disable-blink-features=AutomationControlled',
			'--no-sandbox',
		],
	});

	// Try to use auth.json if it exists for better access
	let context: BrowserContext;
	try {
		context = await browser.newContext({
			storageState: 'auth.json',
			userAgent:
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			viewport: { width: 1920, height: 1080 },
		});
		console.log('Using saved authentication state');
	} catch {
		context = await browser.newContext({
			userAgent:
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			viewport: { width: 1920, height: 1080 },
		});
		console.log('No auth.json found, proceeding without authentication');
	}

	try {
		// Step 1: Get recent articles from profile
		const recentArticles = await getRecentArticles(context);

		if (recentArticles.length === 0) {
			console.log('No articles found in the specified date range');
			return;
		}

		console.log('\nArticles to process:');
		recentArticles.forEach((a, i) => {
			console.log(
				`  ${i + 1}. ${a.title} (${a.publishedAt.toLocaleDateString()})`
			);
		});

		// Step 2: Scrape and upload articles concurrently
		console.log('\nStarting concurrent scraping and upload...');
		const { success, failed } = await processArticlesConcurrently(
			context,
			recentArticles,
			3 // Process 3 articles at a time
		);

		// Summary
		console.log('\n' + '='.repeat(60));
		console.log('Summary');
		console.log('='.repeat(60));
		console.log(`Total articles found: ${recentArticles.length}`);
		console.log(`Successfully uploaded: ${success}`);
		console.log(`Failed: ${failed}`);
	} finally {
		await browser.close();
	}
}

main().catch(console.error);
