import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from '@/libs/anthropic';
import { CHAT_SYSTEM_PROMPT, TOOLS, type StreamEvent } from './types';
import { executeTool } from './tools';
import { chatStream } from './stream';

export type { StreamEvent };
export { chatStream };

type Message = { role: 'user' | 'assistant'; content: string };

/**
 * Non-streaming chat (server action)
 */
export async function chat(messages: Message[]): Promise<{
	success: boolean;
	response?: string;
	error?: string;
}> {
	try {
		const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
			role: m.role,
			content: m.content,
		}));

		// Tool use loop
		let response = await anthropic.messages.create({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 4096,
			system: CHAT_SYSTEM_PROMPT,
			tools: TOOLS,
			messages: anthropicMessages,
		});

		// Continue while Claude wants to use tools
		while (response.stop_reason === 'tool_use') {
			const toolUseBlocks = response.content.filter(
				(block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
			);

			// Execute all tools
			const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
				toolUseBlocks.map(async (block) => {
					const result = await executeTool(
						block.name,
						block.input as Record<string, unknown>,
					);
					return {
						type: 'tool_result' as const,
						tool_use_id: block.id,
						content: result,
					};
				}),
			);

			// Build assistant content
			const assistantContent: Anthropic.ContentBlockParam[] = [];
			for (const block of response.content) {
				if (block.type === 'text') {
					assistantContent.push({ type: 'text', text: block.text });
				} else if (block.type === 'tool_use') {
					assistantContent.push({
						type: 'tool_use',
						id: block.id,
						name: block.name,
						input: block.input as Record<string, unknown>,
					});
				}
			}

			// Add assistant message and tool results
			anthropicMessages.push({
				role: 'assistant',
				content: assistantContent,
			});

			anthropicMessages.push({
				role: 'user',
				content: toolResults,
			});

			// Continue conversation
			response = await anthropic.messages.create({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 4096,
				system: CHAT_SYSTEM_PROMPT,
				tools: TOOLS,
				messages: anthropicMessages,
			});
		}

		// Extract final text response
		const textBlock = response.content.find(
			(block): block is Anthropic.TextBlock => block.type === 'text',
		);

		return {
			success: true,
			response: textBlock?.text ?? '',
		};
	} catch (error) {
		console.error('Chat error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}
