import { qdrantClient, COLLECTIONS } from '../libs/qdrant';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Delete collections and re-upload all data fresh
 * WARNING: This will delete all existing data in the collections
 */

async function deleteCollection(collectionName: string) {
	try {
		console.log(`Deleting collection: ${collectionName}...`);
		await qdrantClient.deleteCollection(collectionName);
		console.log(`✓ Deleted ${collectionName}`);
	} catch (error: any) {
		if (error.status === 404) {
			console.log(`Collection ${collectionName} does not exist, skipping`);
		} else {
			throw error;
		}
	}
}

async function runUploadScript(scriptName: string, description: string) {
	console.log(`\n=== ${description} ===`);
	console.log(`Running: ${scriptName}`);

	try {
		const { stdout, stderr } = await execAsync(
			`npx tsx ${scriptName}`,
			{
				cwd: __dirname,
				maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
			}
		);

		if (stdout) {
			console.log(stdout);
		}
		if (stderr) {
			console.error(stderr);
		}

		console.log(`✓ Completed ${description}`);
	} catch (error: any) {
		console.error(`Error running ${scriptName}:`, error.message);
		if (error.stdout) console.log(error.stdout);
		if (error.stderr) console.error(error.stderr);
		throw error;
	}
}

async function main() {
	console.log('⚠️  WARNING: This will DELETE all existing data and re-upload fresh!\n');

	// Give user a chance to cancel (in case they run this accidentally)
	console.log('Starting in 3 seconds... (Press Ctrl+C to cancel)\n');
	await new Promise((resolve) => setTimeout(resolve, 3000));

	try {
		// Step 1: Delete existing collections
		console.log('=== Step 1: Deleting Collections ===\n');
		await deleteCollection(COLLECTIONS.ARTICLES);
		await deleteCollection(COLLECTIONS.POSTS);

		console.log('\n✓ All collections deleted\n');

		// Step 2: Re-upload Medium articles
		await runUploadScript(
			'./uploadMediumPosts.ts',
			'Uploading Medium Articles'
		);

		// Step 3: Re-upload LinkedIn posts
		await runUploadScript(
			'./uploadLinkedInPosts.ts',
			'Uploading LinkedIn Posts'
		);

		console.log('\n✅ Reset and re-upload complete!');
		console.log('\nYou can now run inspectQdrant.ts to verify the data.');
	} catch (error) {
		console.error('\n❌ Error during reset and re-upload:', error);
		process.exit(1);
	}
}

main().catch(console.error);
