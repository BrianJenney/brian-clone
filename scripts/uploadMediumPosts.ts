import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import {
	qdrantClient,
	initializeCollection,
	COLLECTIONS,
} from '../libs/qdrant';
import { generateEmbedding } from '../libs/openai';
import { chunkTextWithOverlap } from '../libs/utils/chunking';

function parseHTMLFile(filePath: string): { text: string; title: string; sourceUrl?: string } {
	const html = fs.readFileSync(filePath, 'utf-8');
	const $ = cheerio.load(html);

	const title = $('h1.p-name').text().trim();
	const canonicalLink = $('a.p-canonical').attr('href');
	const bodySection = $('section[data-field="body"]');
	let content = '';

	bodySection.find('p, h1, h2, h3, h4').each((_, element) => {
		const text = $(element).text().trim();
		if (text) {
			content += text + '\n\n';
		}
	});

	return {
		text: `${title}\n\n${content}`.trim(),
		title,
		sourceUrl: canonicalLink,
	};
}

async function uploadArticle(
	text: string,
	fileName: string,
	metadata?: { title?: string; sourceUrl?: string }
): Promise<boolean> {
	try {
		await initializeCollection(COLLECTIONS.ARTICLES);

		const chunks = chunkTextWithOverlap(text, 1500);
		const baseId = uuidv4();

		console.log(`Creating ${chunks.length} chunk(s)`);

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
							source: fileName,
							uploadedAt: new Date().toISOString(),
							...(metadata?.title && { title: metadata.title }),
							...(metadata?.sourceUrl && { sourceUrl: metadata.sourceUrl }),
						},
					},
				],
			});
		}

		return true;
	} catch (error) {
		console.error('Upload error:', error);
		return false;
	}
}

async function main() {
	const postsDir = path.join(__dirname, '../data');
	const files = fs
		.readdirSync(postsDir)
		.filter((file) => file.endsWith('.html'));

	console.log(`Found ${files.length} HTML files to process`);

	let successCount = 0;
	let failCount = 0;

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const filePath = path.join(postsDir, file);

		try {
			console.log(`[${i + 1}/${files.length}] Processing: ${file}`);

			const parsed = parseHTMLFile(filePath);

			if (parsed.text.length < 500) {
				console.log(`Skipped (too short: ${parsed.text.length} chars)`);
				continue;
			}

			const success = await uploadArticle(parsed.text, file, {
				title: parsed.title,
				sourceUrl: parsed.sourceUrl,
			});

			if (success) {
				successCount++;
				console.log(
					`Uploaded successfully (${parsed.text.length} chars)${parsed.sourceUrl ? ` - ${parsed.sourceUrl}` : ''}`
				);
			} else {
				failCount++;
				console.log(`Upload failed`);
			}
		} catch (error) {
			failCount++;
			console.error(`Error processing file:`, error);
		}
	}

	console.log('Upload complete');
	console.log(`Successful: ${successCount}`);
	console.log(`Failed: ${failCount}`);
	console.log(`Total processed: ${successCount + failCount}/${files.length}`);
}

main().catch(console.error);
