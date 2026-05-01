const VOYAGE_EMBEDDING_MODEL = 'voyage-multimodal-3';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 25000; // 25 seconds for 3 RPM rate limit

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate text-only embedding using Voyage multimodal model
// This produces embeddings in the same vector space as image+text embeddings
export async function generateVoyageEmbedding(text: string): Promise<number[]> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		const response = await fetch(
			'https://api.voyageai.com/v1/multimodalembeddings',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${process.env.VOYAGE_API_KEY!}`,
				},
				body: JSON.stringify({
					model: VOYAGE_EMBEDDING_MODEL,
					inputs: [{ content: [{ type: 'text', text }] }],
					input_type: 'query',
				}),
			},
		);

		if (response.ok) {
			const data = await response.json();
			return data.data[0].embedding;
		}

		// Retry on rate limit
		if (response.status === 429 && attempt < MAX_RETRIES - 1) {
			const waitTime = RETRY_DELAY_MS * (attempt + 1);
			console.log(`Rate limited, waiting ${waitTime / 1000}s before retry...`);
			await sleep(waitTime);
			continue;
		}

		const error = await response.text();
		lastError = new Error(`Voyage API error: ${response.status} - ${error}`);
	}

	throw lastError || new Error('Voyage API request failed after retries');
}

// Generate multimodal embedding (image + text) using Voyage
export async function generateVoyageMultimodalEmbedding(
	imageBase64: string,
	text: string,
): Promise<number[]> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		const response = await fetch(
			'https://api.voyageai.com/v1/multimodalembeddings',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${process.env.VOYAGE_API_KEY!}`,
				},
				body: JSON.stringify({
					model: VOYAGE_EMBEDDING_MODEL,
					inputs: [
						{
							content: [
								{
									type: 'image_base64',
									image_base64: `data:image/jpeg;base64,${imageBase64}`,
								},
								{ type: 'text', text },
							],
						},
					],
					input_type: 'document',
				}),
			},
		);

		if (response.ok) {
			const data = await response.json();
			return data.data[0].embedding;
		}

		// Retry on rate limit
		if (response.status === 429 && attempt < MAX_RETRIES - 1) {
			const waitTime = RETRY_DELAY_MS * (attempt + 1);
			console.log(`Rate limited, waiting ${waitTime / 1000}s before retry...`);
			await sleep(waitTime);
			continue;
		}

		const error = await response.text();
		lastError = new Error(`Voyage API error: ${response.status} - ${error}`);
	}

	throw lastError || new Error('Voyage API request failed after retries');
}
