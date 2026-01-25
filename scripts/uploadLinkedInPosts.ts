import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { qdrantClient, COLLECTIONS } from '../libs/qdrant';
import { generateEmbedding } from '../libs/openai';

type LinkedInPostMetadata = {
	urn?: string;
	type?: string;
	firstName?: string;
	lastName?: string;
	numImpressions?: number;
	numViews?: number;
	numReactions?: number;
	numComments?: number;
	numShares?: number;
	numVotes?: number;
	numEngagementRate?: number;
	hashtags?: string;
	createdAt?: string;
	link?: string;
};

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

function parseCSV(
	csvContent: string
): Array<{ text: string; metadata: LinkedInPostMetadata }> {
	const lines = csvContent.split('\n');
	const posts: Array<{ text: string; metadata: LinkedInPostMetadata }> = [];
	let currentPostLines: string[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];

		if (line.trim().startsWith('urn:li:activity:')) {
			if (currentPostLines.length > 0) {
				const post = parsePost(currentPostLines.join('\n'));
				if (post) posts.push(post);
			}
			currentPostLines = [line];
		} else {
			currentPostLines.push(line);
		}
	}

	if (currentPostLines.length > 0) {
		const post = parsePost(currentPostLines.join('\n'));
		console.log({ post });
		if (post) posts.push(post);
	}

	return posts;
}

function parsePost(
	postBlock: string
): { text: string; metadata: LinkedInPostMetadata } | null {
	const fields = parseCSVLine(postBlock);
	if (fields.length < 2) return null;

	const [
		urn,
		text,
		type,
		firstName,
		lastName,
		numImpressions,
		numViews,
		numReactions,
		numComments,
		numShares,
		numVotes,
		numEngagementRate,
		hashtags,
		createdAt,
		link,
	] = fields;

	if (!text || text.length < 10) return null;

	return {
		text,
		metadata: {
			urn: urn || undefined,
			type: type || undefined,
			firstName: firstName || undefined,
			lastName: lastName || undefined,
			numImpressions: numImpressions
				? parseInt(numImpressions)
				: undefined,
			numViews: numViews ? parseInt(numViews) : undefined,
			numReactions: numReactions ? parseInt(numReactions) : undefined,
			numComments: numComments ? parseInt(numComments) : undefined,
			numShares: numShares ? parseInt(numShares) : undefined,
			numVotes: numVotes ? parseInt(numVotes) : undefined,
			numEngagementRate: numEngagementRate
				? parseFloat(numEngagementRate)
				: undefined,
			hashtags: hashtags || undefined,
			createdAt: createdAt || undefined,
			link: link || undefined,
		},
	};
}

async function uploadPost(
	text: string,
	metadata: LinkedInPostMetadata
): Promise<boolean> {
	try {
		const id = uuidv4();
		const embedding = await generateEmbedding(text);

		// Rename 'link' to 'sourceUrl' for consistency
		const { link, ...restMetadata } = metadata;

		await qdrantClient.upsert(COLLECTIONS.POSTS, {
			wait: true,
			points: [
				{
					id,
					vector: embedding,
					payload: {
						text,
						contentType: 'post',
						...restMetadata,
						...(link && { sourceUrl: link }),
						uploadedAt: new Date().toISOString(),
					},
				},
			],
		});

		return true;
	} catch (error) {
		console.error('Upload error:', error);
		return false;
	}
}

async function main() {
	const csvPath =
		process.argv[2] || path.join(__dirname, '../data/brian_posts.csv');

	if (!fs.existsSync(csvPath)) {
		console.error('CSV file not found:', csvPath);
		process.exit(1);
	}

	const csvContent = fs.readFileSync(csvPath, 'utf-8');
	const posts = parseCSV(csvContent);

	console.log(`Found ${posts.length} posts to upload`);

	if (posts.length === 0) {
		console.log('No valid posts found');
		process.exit(0);
	}

	let successCount = 0;
	let failCount = 0;

	for (let i = 0; i < posts.length; i++) {
		const post = posts[i];

		try {
			console.log(`[${i + 1}/${posts.length}] Uploading post`);

			const success = await uploadPost(post.text, post.metadata);

			if (success) {
				successCount++;
			} else {
				failCount++;
			}

			await new Promise((resolve) => setTimeout(resolve, 500));
		} catch (error) {
			failCount++;
			console.error('Error processing post:', error);
		}
	}

	console.log('Upload complete');
	console.log(`Successful: ${successCount}`);
	console.log(`Failed: ${failCount}`);
	console.log(`Total: ${successCount + failCount}/${posts.length}`);
}

main().catch(console.error);
