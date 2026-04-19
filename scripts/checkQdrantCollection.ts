import 'dotenv/config';
import { qdrantClient, COLLECTIONS } from '../libs/qdrant';

async function main() {
	// Get collection info
	const info = await qdrantClient.getCollection(COLLECTIONS.POSTS);
	console.log('Collection info:', JSON.stringify(info, null, 2));

	// Get a sample point to see the payload structure
	const sample = await qdrantClient.scroll(COLLECTIONS.POSTS, {
		limit: 1,
		with_payload: true,
	});
	console.log('\nSample point payload:', JSON.stringify(sample.points[0]?.payload, null, 2));
}

main().catch(console.error);
