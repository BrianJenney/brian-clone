import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from '@/libs/anthropic';
import { CHAT_SYSTEM_PROMPT, TOOLS, type StreamEvent } from './types';
import { executeTool } from './tools';

type Message = { role: 'user' | 'assistant'; content: string };

/**
 * Streaming chat with native Claude tool-calling
 */
export async function* chatStream(
	messages: Message[],
): AsyncGenerator<StreamEvent> {
	try {
		// Convert to Anthropic message format
		const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
			role: m.role,
			content: m.content,
		}));

		// Tool use loop - continue until Claude stops using tools
		let continueLoop = true;

		while (continueLoop) {
			continueLoop = false;

			const stream = anthropic.messages.stream({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 4096,
				system: CHAT_SYSTEM_PROMPT,
				tools: TOOLS,
				messages: anthropicMessages,
			});

			let currentToolUse: {
				id: string;
				name: string;
				inputJson: string;
			} | null = null;

			const toolUseBlocks: Array<{
				type: 'tool_use';
				id: string;
				name: string;
				input: Record<string, unknown>;
			}> = [];
			const toolResults: Anthropic.ToolResultBlockParam[] = [];

			for await (const event of stream) {
				// Handle different event types
				if (event.type === 'content_block_start') {
					if (event.content_block.type === 'tool_use') {
						currentToolUse = {
							id: event.content_block.id,
							name: event.content_block.name,
							inputJson: '',
						};
						yield {
							type: 'progress',
							message: `using ${event.content_block.name}`,
						};
					}
				}

				if (event.type === 'content_block_delta') {
					if (event.delta.type === 'text_delta') {
						yield { type: 'text', content: event.delta.text };
					}

					if (
						event.delta.type === 'input_json_delta' &&
						currentToolUse
					) {
						currentToolUse.inputJson += event.delta.partial_json;
					}
				}

				if (event.type === 'content_block_stop' && currentToolUse) {
					// Parse the tool input and execute
					let input: Record<string, unknown> = {};
					try {
						if (currentToolUse.inputJson) {
							input = JSON.parse(currentToolUse.inputJson);
						}
					} catch {
						// Empty input is fine for some tools
					}

					yield {
						type: 'tool_use',
						name: currentToolUse.name,
						input,
					};

					// Execute the tool
					const result = await executeTool(currentToolUse.name, input);

					yield {
						type: 'tool_result',
						name: currentToolUse.name,
						result:
							result.length > 200
								? result.slice(0, 200) + '...'
								: result,
					};

					// Store for message continuation
					toolUseBlocks.push({
						type: 'tool_use',
						id: currentToolUse.id,
						name: currentToolUse.name,
						input,
					});

					toolResults.push({
						type: 'tool_result',
						tool_use_id: currentToolUse.id,
						content: result,
					});

					currentToolUse = null;
				}

				if (event.type === 'message_stop') {
					// If we had tool uses, add them to messages and continue
					if (toolUseBlocks.length > 0) {
						// Build assistant content from the final message
						const finalMessage = await stream.finalMessage();
						const assistantContent: Anthropic.ContentBlockParam[] = [];

						for (const block of finalMessage.content) {
							if (block.type === 'text' && block.text) {
								assistantContent.push({
									type: 'text',
									text: block.text,
								});
							} else if (block.type === 'tool_use') {
								assistantContent.push({
									type: 'tool_use',
									id: block.id,
									name: block.name,
									input: block.input as Record<string, unknown>,
								});
							}
						}

						anthropicMessages.push({
							role: 'assistant',
							content: assistantContent,
						});

						// Add tool results
						anthropicMessages.push({
							role: 'user',
							content: toolResults,
						});

						// Continue the loop to get Claude's response to tool results
						continueLoop = true;
					}
				}
			}
		}

		yield { type: 'done' };
	} catch (error) {
		console.error('Chat stream error:', error);
		yield {
			type: 'error',
			message: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}
