import 'dotenv/config';
import { qdrantClient, COLLECTIONS } from '../libs/qdrant';

async function main() {
	console.log('Recreating payload indexes for brian-posts collection...');

	// Delete existing createdAt index first
	try {
		await qdrantClient.deletePayloadIndex(COLLECTIONS.POSTS, 'createdAt');
		console.log('✓ Deleted old createdAt index');
	} catch (e) {
		console.log('No existing createdAt index to delete');
	}

	// Index createdAt as datetime for range filtering
	await qdrantClient.createPayloadIndex(COLLECTIONS.POSTS, {
		field_name: 'createdAt',
		field_schema: 'datetime',
	});
	console.log('✓ Created datetime index on createdAt');

	// Index numReactions for likes filtering (if not exists)
	try {
		await qdrantClient.createPayloadIndex(COLLECTIONS.POSTS, {
			field_name: 'numReactions',
			field_schema: 'integer',
		});
		console.log('✓ Created index on numReactions');
	} catch (e) {
		console.log('numReactions index already exists');
	}

	// Verify
	const info = await qdrantClient.getCollection(COLLECTIONS.POSTS);
	console.log('\nPayload schema:', JSON.stringify(info.payload_schema, null, 2));
}

main().catch(console.error);
