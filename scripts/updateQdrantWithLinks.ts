import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { qdrantClient, COLLECTIONS } from '../libs/qdrant';

/**
 * Update existing Qdrant records with sourceUrl links
 * For Medium articles: extracts links from HTML files
 * For LinkedIn posts: extracts links from CSV
 */

// Helper to parse HTML and get canonical link
function extractLinkFromHTML(filePath: string): string | undefined {
	try {
		const html = fs.readFileSync(filePath, 'utf-8');
		const $ = cheerio.load(html);
		return $('a.p-canonical').attr('href');
	} catch (error) {
		console.error(`Error reading HTML file ${filePath}:`, error);
		return undefined;
	}
}

// Helper to parse CSV line (handles quoted fields)
function parseCSVLine(line: string): string[] {
	const fields: string[] = [];
	let currentField = '';
	let insideQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			insideQuotes = !insideQuotes;
		} else if (char === ',' && !insideQuotes) {
			fields.push(currentField.trim());
			currentField = '';
		} else {
			currentField += char;
		}
	}

	fields.push(currentField.trim());
	return fields;
}

// Build mapping of post text to link from CSV
function buildPostLinksMap(csvPath: string): Map<string, string> {
	const linksMap = new Map<string, string>();

	try {
		const csvContent = fs.readFileSync(csvPath, 'utf-8');
		const lines = csvContent.split('\n');
		let currentPostLines: string[] = [];

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];

			if (line.trim().startsWith('urn:li:activity:')) {
				if (currentPostLines.length > 0) {
					const fields = parseCSVLine(currentPostLines.join('\n'));
					const text = fields[1];
					const link = fields[14]; // link is 15th column (index 14)
					if (text && link) {
						linksMap.set(text.trim(), link.trim());
					}
				}
				currentPostLines = [line];
			} else {
				currentPostLines.push(line);
			}
		}

		// Handle last post
		if (currentPostLines.length > 0) {
			const fields = parseCSVLine(currentPostLines.join('\n'));
			const text = fields[1];
			const link = fields[14];
			if (text && link) {
				linksMap.set(text.trim(), link.trim());
			}
		}
	} catch (error) {
		console.error('Error reading CSV:', error);
	}

	return linksMap;
}

async function updateArticles() {
	console.log('\n=== Updating Articles ===');

	const postsDir = path.join(__dirname, '../data');
	const htmlFiles = fs.readdirSync(postsDir).filter((file) => file.endsWith('.html'));

	let updated = 0;
	let skipped = 0;
	let errors = 0;

	// Scroll through all points in articles collection
	let nextPageOffset: string | number | undefined = undefined;

	do {
		const scrollResult = await qdrantClient.scroll(COLLECTIONS.ARTICLES, {
			limit: 100,
			with_payload: true,
			with_vector: false,
			offset: nextPageOffset,
		});

		for (const point of scrollResult.points) {
			try {
				// Skip if already has sourceUrl
				if (point.payload?.sourceUrl) {
					skipped++;
					continue;
				}

				// Get source file name from payload
				const source = point.payload?.source as string;
				if (!source) {
					console.log(`Point ${point.id} has no source field, skipping`);
					skipped++;
					continue;
				}

				// Extract link from HTML file
				const htmlPath = path.join(postsDir, source);
				const sourceUrl = extractLinkFromHTML(htmlPath);

				if (sourceUrl) {
					// Update the point with the link
					await qdrantClient.setPayload(COLLECTIONS.ARTICLES, {
						wait: true,
						payload: {
							...point.payload,
							sourceUrl,
						},
						points: [point.id],
					});

					console.log(`✓ Updated ${source} with link: ${sourceUrl}`);
					updated++;
				} else {
					console.log(`⚠ No link found for ${source}`);
					skipped++;
				}
			} catch (error) {
				console.error(`Error updating point ${point.id}:`, error);
				errors++;
			}
		}

		const offset = scrollResult.next_page_offset;
		nextPageOffset = typeof offset === 'string' || typeof offset === 'number' ? offset : undefined;
	} while (nextPageOffset !== null && nextPageOffset !== undefined);

	console.log(`\nArticles Summary: ${updated} updated, ${skipped} skipped, ${errors} errors`);
}

async function updatePosts() {
	console.log('\n=== Updating Posts ===');

	const csvPath = path.join(__dirname, '../data/brian_posts.csv');
	const linksMap = buildPostLinksMap(csvPath);

	console.log(`Loaded ${linksMap.size} links from CSV`);

	let updated = 0;
	let skipped = 0;
	let errors = 0;
	let notFound = 0;

	// Scroll through all points in posts collection
	let nextPageOffset: string | number | undefined = undefined;

	do {
		const scrollResult = await qdrantClient.scroll(COLLECTIONS.POSTS, {
			limit: 100,
			with_payload: true,
			with_vector: false,
			offset: nextPageOffset,
		});

		for (const point of scrollResult.points) {
			try {
				// Skip if already has sourceUrl
				if (point.payload?.sourceUrl) {
					skipped++;
					continue;
				}

				const text = point.payload?.text as string;
				if (!text) {
					console.log(`Point ${point.id} has no text field, skipping`);
					skipped++;
					continue;
				}

				// Look up link in our map
				const sourceUrl = linksMap.get(text.trim());

				if (sourceUrl) {
					// Update the point with the link
					await qdrantClient.setPayload(COLLECTIONS.POSTS, {
						wait: true,
						payload: {
							...point.payload,
							sourceUrl,
						},
						points: [point.id],
					});

					console.log(`✓ Updated post with link: ${sourceUrl}`);
					updated++;
				} else {
					notFound++;
				}
			} catch (error) {
				console.error(`Error updating point ${point.id}:`, error);
				errors++;
			}
		}

		const offset = scrollResult.next_page_offset;
		nextPageOffset = typeof offset === 'string' || typeof offset === 'number' ? offset : undefined;
	} while (nextPageOffset !== null && nextPageOffset !== undefined);

	console.log(`\nPosts Summary: ${updated} updated, ${skipped} skipped, ${notFound} not found in CSV, ${errors} errors`);
}

async function main() {
	console.log('Updating Qdrant records with sourceUrl links...\n');

	try {
		await updateArticles();
		await updatePosts();

		console.log('\n✅ Update complete!');
	} catch (error) {
		console.error('Error during update:', error);
		process.exit(1);
	}
}

main().catch(console.error);
