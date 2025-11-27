import { tool } from 'ai';
import { GeneratePostToolSchema } from '@/libs/schemas';
import { airtableClient } from '@/libs/airtable';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { qdrantClient } from '@/libs/qdrant';
import { generateEmbedding } from '@/libs/openai';
import { getCollectionName } from '@/libs/utils';

/**
 * Generate Post from Template Tool
 * Takes an Airtable template and matches it with writing samples to create engaging posts
 */
export const generatePostFromTemplateTool = tool({
	description:
		"Generate an engaging post by combining an Airtable template with Brian's writing style from past work. Searches for relevant writing samples and creates content that matches his authentic voice.",
	inputSchema: GeneratePostToolSchema,
	execute: async (args: {
		templateId: string;
		topic?: string;
		style?: string;
	}) => {
		const { templateId, topic, style } = args;

		try {
			const tableName =
				process.env.AIRTABLE_TABLE_NAME || 'Content Templates';

			const template = await airtableClient.getRecord(
				tableName,
				templateId
			);

			if (!template) {
				return 'Template not found in Airtable.';
			}

			const templateContent = template.fields.Content || '';
			const templateTopic =
				topic || template.fields.Topic || template.fields.Title || '';
			const templateStyle = style || template.fields.Style || 'engaging';

			const searchQuery = `${templateTopic} ${templateContent}`;
			const queryEmbedding = await generateEmbedding(searchQuery);

			const collectionsToSearch: Array<'article' | 'post'> = [
				'article',
				'post',
			];

			const searchPromises = collectionsToSearch.map(
				async (contentType) => {
					const collectionName = getCollectionName(contentType);
					try {
						const results = await qdrantClient.search(
							collectionName,
							{
								vector: queryEmbedding,
								limit: 3,
								with_payload: true,
							}
						);

						return results.map((r) => ({
							score: r.score,
							text: r.payload?.text,
							contentType,
							metadata: r.payload,
						}));
					} catch (error) {
						console.warn(
							`Error searching ${collectionName}:`,
							error
						);
						return [];
					}
				}
			);

			const allResults = await Promise.all(searchPromises);
			const flatResults = allResults.flat();
			flatResults.sort((a, b) => b.score - a.score);

			const topWritingSamples = flatResults.slice(0, 5);

			const writingSamplesText = topWritingSamples
				.map((sample, i) => {
					return `Example ${i + 1}:\n${sample.text}`;
				})
				.join('\n\n---\n\n');

			const prompt = `You are writing content for Brian. You have access to his previous writing samples and a content template from Airtable.

TEMPLATE:
${JSON.stringify(template.fields, null, 2)}

TOPIC: ${templateTopic}
STYLE: ${templateStyle}

BRIAN'S WRITING SAMPLES (for style reference):
${writingSamplesText}

Your task:
1. Study Brian's writing style from the samples above - note his tone, vocabulary, sentence structure, and voice
2. Use the template as a structural guide
3. Create an engaging post on the topic "${templateTopic}" that sounds authentically like Brian
4. Match the requested style: ${templateStyle}
5. Keep it concise, engaging, and true to Brian's voice

Generate the post:`;

			const { text } = await generateText({
				model: openai('gpt-4o'),
				prompt,
			});

			return `Generated Post:

${text}

---

Template Used: ${template.id}
Topic: ${templateTopic}
Style: ${templateStyle}
Writing Samples Referenced: ${topWritingSamples.length}`;
		} catch (error) {
			console.error('Error generating post:', error);
			return `Error generating post: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`;
		}
	},
});
