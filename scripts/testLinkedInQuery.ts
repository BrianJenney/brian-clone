import 'dotenv/config';
import {
	queryLinkedInPosts,
	parseLinkedInQuery,
} from '../libs/linkedinQuery';

async function main() {
	const testQueries = [
		'posts about React from last month with more than 50 likes',
		'top 5 performing posts about TypeScript',
		'recent posts about career advice',
	];

	for (const query of testQueries) {
		console.log('\n' + '='.repeat(60));
		console.log(`Query: "${query}"`);
		console.log('='.repeat(60));

		try {
			// Show parsed filters
			const filters = await parseLinkedInQuery(query);
			console.log('\nParsed filters:', JSON.stringify(filters, null, 2));

			// Run the query
			const results = await queryLinkedInPosts(query);
			console.log(`\nFound ${results.length} results:`);

			for (const result of results.slice(0, 3)) {
				console.log(`\n- Score: ${result.score.toFixed(3)}`);
				console.log(`  Likes: ${result.payload?.numReactions || 'N/A'}`);
				console.log(`  Date: ${result.payload?.createdAt || 'N/A'}`);
				console.log(
					`  Text: ${String(result.payload?.text || '').slice(0, 100)}...`
				);
			}
		} catch (error) {
			console.error('Error:', error);
		}
	}
}

main().catch(console.error);
