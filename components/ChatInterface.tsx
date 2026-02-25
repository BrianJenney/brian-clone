'use client';

import { useRef, useEffect, useState } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { StlyedMarkdown } from '@/components/ReactMarkdown';
import remarkGfm from 'remark-gfm';
import { generateContent } from '@/app/actions/generate-content';
import { getToolDisplayName } from '@/libs/tools/config';

type ChatMode = 'standard' | 'contentGen';

type Message = {
	role: 'user' | 'assistant';
	content: string;
};

export default function ChatInterface() {
	const [chatMode, setChatMode] = useState<ChatMode>('standard');
	const [useAgentRouter, setUseAgentRouter] = useState(true);
	const [generatedPosts, setGeneratedPosts] = useState<string[]>([]);
	const [generatedPostsSources, setGeneratedPostsSources] = useState<
		string[]
	>([]);
	const [isGenerating, setIsGenerating] = useState(false);
	const [generationError, setGenerationError] = useState<string | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [currentTool, setCurrentTool] = useState<string | null>(null);

	const [input, setInput] = useState('');
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const {
		isListening,
		transcript,
		isSupported,
		error: voiceError,
		startListening,
		stopListening,
		resetTranscript,
	} = useVoiceInput();

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
		e.target.style.height = 'auto';
		e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	useEffect(() => {
		if (transcript) {
			setInput(transcript);
		}
	}, [transcript]);

	const handleVoiceToggle = () => {
		if (isListening) {
			stopListening();
		} else {
			startListening();
		}
	};

	const handleGenerateContent = async () => {
		try {
			setIsGenerating(true);
			setGenerationError(null);
			setGeneratedPosts([]);
			setGeneratedPostsSources([]);

			const result = await generateContent(
				messages.map((message) => ({
					role: message.role,
					content: message.content,
				})),
			);

			if (result.success && 'options' in result && result.options) {
				setGeneratedPosts(result.options);
				setGeneratedPostsSources(result.sources);
			} else {
				throw new Error(
					'message' in result && result.message
						? result.message
						: 'Failed to generate posts',
				);
			}
		} catch (error) {
			console.error('Content generation error:', error);
			setGenerationError(
				error instanceof Error ? error.message : 'Unknown error',
			);
		} finally {
			setIsGenerating(false);
		}
	};

	const handleChatMessage = async (message: string) => {
		try {
			setIsLoading(true);
			setError(null);
			setCurrentTool(null);

			const userMessage: Message = { role: 'user', content: message };
			setMessages((prev) => [...prev, userMessage]);

			const assistantMessage: Message = {
				role: 'assistant',
				content: '',
			};
			setMessages((prev) => [...prev, assistantMessage]);

			const endpoint = useAgentRouter ? '/api/chat-agents' : '/api/chat';
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: [...messages, userMessage],
				}),
			});

			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) {
				throw new Error('No response body');
			}

			let accumulatedContent = '';
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				buffer += chunk;

				if (useAgentRouter) {
					// New agent router format: JSON lines with {type, message/content}
					const lines = buffer.split('\n');
					buffer = lines.pop() || ''; // Keep incomplete line in buffer

					for (const line of lines) {
						if (!line.trim()) continue;

						try {
							const data = JSON.parse(line);

							if (data.type === 'progress') {
								setCurrentTool(data.message);
							} else if (data.type === 'text') {
								accumulatedContent += data.content;
								setCurrentTool(null);

								setMessages((prev) => {
									const newMessages = [...prev];
									const lastMessage =
										newMessages[newMessages.length - 1];
									if (lastMessage.role === 'assistant') {
										lastMessage.content =
											accumulatedContent;
									}
									return newMessages;
								});
							} else if (data.type === 'error') {
								setError(data.message);
							}
						} catch (e) {
							// Ignore parse errors for incomplete JSON
						}
					}
				} else {
					const lines = buffer.split('\n');
					for (const line of lines) {
						console.log('line', line);
						if (line.startsWith('9:')) {
							try {
								const toolCall = JSON.parse(line.slice(2));
								const toolName = toolCall.toolName || '';
								setCurrentTool(getToolDisplayName(toolName));
							} catch (e) {
								// Ignore parse errors
							}
						} else if (
							line.startsWith('a:') ||
							line.startsWith('0:')
						) {
							setCurrentTool(null);
						}
					}

					accumulatedContent += chunk;

					setMessages((prev) => {
						const newMessages = [...prev];
						const lastMessage = newMessages[newMessages.length - 1];
						if (lastMessage.role === 'assistant') {
							lastMessage.content = accumulatedContent;
						}
						return newMessages;
					});
				}
			}
		} catch (error) {
			console.error('Chat error:', error);
			setError(error instanceof Error ? error.message : 'Unknown error');
		} finally {
			setIsLoading(false);
			setCurrentTool(null);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;

		if (chatMode === 'contentGen') {
			handleGenerateContent();
		} else {
			handleChatMessage(input);
		}

		setInput('');
		resetTranscript();
	};

	return (
		<div className='flex flex-1 min-h-0 gap-2 sm:gap-3'>
			{/* Left Sidebar - Options/Toggles */}
			<div className='flex flex-col gap-2 sm:gap-3 shrink-0'>
				<div className='flex flex-col gap-1.5 sm:gap-2 bg-[#1a1a1a] p-1.5 sm:p-2 rounded-lg border border-[#2f2f2f]'>
					<button
						onClick={() => setChatMode('standard')}
						className={`px-2 sm:px-3 py-1.5 text-sm sm:text-base rounded transition-colors whitespace-nowrap ${
							chatMode === 'standard'
								? 'bg-white text-black font-bold'
								: 'text-[#8b8b8b] hover:text-white hover:bg-[#2f2f2f]'
						}`}
						title='Standard chat with AI tools'
					>
						Standard
					</button>

					<button
						onClick={() => setChatMode('contentGen')}
						className={`px-2 sm:px-3 py-1.5 text-sm sm:text-base rounded transition-colors whitespace-nowrap ${
							chatMode === 'contentGen'
								? 'bg-white text-black font-bold'
								: 'text-[#8b8b8b] hover:text-white hover:bg-[#2f2f2f]'
						}`}
						title='Generate 3 posts from templates'
					>
						Content Gen
					</button>
				</div>

				{/* Agent Router Toggle - Only show in standard mode */}
				{chatMode === 'standard' && (
					<div className='flex flex-col gap-1.5 bg-[#1a1a1a] p-2 rounded-lg border border-[#2f2f2f]'>
						<label className='flex items-center gap-2 cursor-pointer'>
							<input
								type='checkbox'
								checked={useAgentRouter}
								onChange={(e) =>
									setUseAgentRouter(e.target.checked)
								}
								className='w-4 h-4 text-white bg-[#1a1a1a] border-[#444444] rounded focus:ring-0 focus:ring-offset-0'
							/>
							<span className='text-xs sm:text-sm text-[#8b8b8b]'>
								Use Agent Router
							</span>
						</label>
					</div>
				)}
			</div>

			{/* Right Side - Chat Content */}
			<div className='flex flex-col flex-1 min-w-0 space-y-3 sm:space-y-4'>
				{/* Messages Container */}
				<div className='flex-1 overflow-y-auto border border-[#2f2f2f] rounded-lg p-2 sm:p-4 space-y-3 sm:space-y-4 bg-[#1a1a1a]'>
					{chatMode === 'contentGen' &&
						generatedPosts.length === 0 &&
						!isGenerating && (
							<div className='text-center text-[#8b8b8b] py-4 sm:py-8 px-2'>
								<p className='text-base sm:text-lg mb-2'>
									Content Generation Mode
								</p>
								<p className='text-base sm:text-sm'>
									Generate 3 unique posts based on Airtable
									templates and your writing style.
								</p>
								<div className='mt-3 sm:mt-4 text-left max-w-md mx-auto space-y-2'>
									<p className='font-medium text-sm'>
										Example prompts:
									</p>
									<ul className='list-disc list-inside space-y-1 text-[#8b8b8b] text-base sm:text-sm'>
										<li>
											Create posts about career
											transitions
										</li>
										<li>
											Write about learning React in 2025
										</li>
										<li>
											Generate content on remote work
											trends
										</li>
										<li>
											Posts about software engineering
											career advice
										</li>
									</ul>
								</div>
							</div>
						)}

					{chatMode !== 'contentGen' && messages.length === 0 && (
						<div className='text-center text-[#8b8b8b] py-4 sm:py-8 px-2'>
							<p className='text-base sm:text-lg mb-2'>
								Welcome! I'm your AI writing assistant.
							</p>
							<p className='text-base sm:text-sm'>
								I can help you write transcripts, articles, and
								posts in your style.
							</p>
							<div className='mt-3 sm:mt-4 text-left max-w-md mx-auto space-y-2'>
								<p className='font-medium'>Try asking me to:</p>
								<ul className='list-disc list-inside space-y-1 text-[#8b8b8b]'>
									<li>
										Search through your existing content
									</li>
									<li>
										Generate a new article about a topic
									</li>
									<li>Write a post in your style</li>
									<li>
										Upload new content to the knowledge base
									</li>
								</ul>
							</div>
						</div>
					)}

					{/* Generated Posts Display */}
					{chatMode === 'contentGen' && generatedPosts.length > 0 && (
						<div className='space-y-3 sm:space-y-4'>
							<div className='bg-[#1a1a1a] border border-[#2f2f2f] rounded-lg p-3 sm:p-4'>
								<h3 className='text-white font-bold mb-1 sm:mb-2 flex items-center gap-2 text-sm sm:text-base'>
									<svg
										className='w-4 h-4 sm:w-5 sm:h-5'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M5 13l4 4L19 7'
										/>
									</svg>
									Generated 3 Posts
								</h3>
								<p className='text-[#8b8b8b] text-base sm:text-sm'>
									Click any post to copy it to your clipboard
								</p>
							</div>

							{generatedPosts.map((post, index) => (
								<div
									key={index}
									onClick={() => {
										navigator.clipboard.writeText(post);
									}}
									className='bg-[#1a1a1a] rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-[#2f2f2f] transition-colors border border-[#2f2f2f]'
								>
									<div className='flex justify-between items-start mb-2'>
										<h4 className='text-white font-bold text-sm sm:text-base'>
											Post {index + 1}
										</h4>
										<button
											onClick={(e) => {
												e.stopPropagation();
												navigator.clipboard.writeText(
													post,
												);
											}}
											className='text-[#8b8b8b] hover:text-white transition-colors p-1'
											title='Copy to clipboard'
										>
											<svg
												className='w-4 h-4 sm:w-5 sm:h-5'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
												/>
											</svg>
										</button>
									</div>
									<div className='text-white whitespace-pre-wrap text-base sm:text-sm'>
										{post}
									</div>
								</div>
							))}
							<div className='text-[#8b8b8b] text-base sm:text-sm break-all'>
								Sources:{' '}
								{generatedPostsSources
									?.map((source: string) => (
										<a
											key={source}
											href={source}
											target='_blank'
											rel='noopener noreferrer'
											className='text-blue-400 hover:underline'
										>
											{source}
										</a>
									))
									?.join(', ')}
							</div>
						</div>
					)}

					{chatMode !== 'contentGen' &&
						messages
							.filter((msg) => msg.role === 'user' || msg.content)
							.map((message, index) => (
								<div
									key={index}
									className={`flex ${
										message.role === 'user'
											? 'justify-end'
											: 'justify-start'
									}`}
								>
									<div
										className={`max-w-[90%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 ${
											message.role === 'user'
												? 'bg-blue-600 text-white'
												: 'bg-[#2f2f2f] text-white'
										}`}
									>
										{/* Role Label */}
										<div className='text-base font-medium mb-1 opacity-75'>
											{message.role === 'user'
												? 'You'
												: 'Assistant'}
										</div>

										{/* Message Content */}
										<div className='text-base'>
											{message.role === 'assistant' ? (
												<StlyedMarkdown
													content={message.content}
												/>
											) : (
												<div className='whitespace-pre-wrap'>
													{message.content}
												</div>
											)}
										</div>
									</div>
								</div>
							))}

					{/* Loading indicator for standard mode - only show when no content yet */}
					{chatMode === 'standard' &&
						isLoading &&
						messages.length > 0 &&
						messages[messages.length - 1].role === 'assistant' &&
						!messages[messages.length - 1].content && (
							<div className='flex justify-start'>
								<div className='max-w-[90%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-3 bg-[#2f2f2f] text-white'>
									<div className='text-base font-medium mb-1 opacity-75'>
										Assistant
									</div>
									<div className='flex items-center gap-2 text-sm text-[#c5c5d2]'>
										<div className='w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin' />
										<span className='capitalize'>
											{currentTool || 'Thinking...'}
										</span>
									</div>
								</div>
							</div>
						)}

					<div ref={messagesEndRef} />
				</div>

				{/* Error Messages */}
				{error && (
					<div className='p-3 rounded-md bg-red-900 text-red-200 text-sm'>
						Error: {error}
					</div>
				)}
				{voiceError && (
					<div className='p-3 rounded-md bg-yellow-900 text-yellow-200 text-sm'>
						{voiceError}
					</div>
				)}
				{generationError && (
					<div className='p-3 rounded-md bg-red-900 text-red-200 text-sm'>
						Content Generation Error: {generationError}
					</div>
				)}

				{/* Loading States */}
				{isGenerating && (
					<div className='flex items-center gap-2 p-3 rounded-md bg-purple-900/50 text-purple-200 text-sm'>
						<div className='w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin' />
						<span>Generating 3 posts from templates...</span>
					</div>
				)}
				{isListening && (
					<div className='flex items-center gap-2 p-3 rounded-md bg-blue-900/50 text-blue-200 text-sm animate-pulse'>
						<div className='w-2 h-2 bg-red-500 rounded-full animate-pulse' />
						<span>Listening...</span>
					</div>
				)}

				{/* Input Form */}
				<form onSubmit={handleSubmit} className='flex gap-1.5 sm:gap-2'>
					<div className='flex-1 flex gap-1.5 sm:gap-2'>
						<textarea
							value={input}
							onChange={handleInputChange}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									if (input.trim()) {
										handleSubmit(e as any);
										// Reset textarea height
										e.currentTarget.style.height = 'auto';
									}
								}
							}}
							placeholder='Type a message...'
							rows={1}
							className='flex-1 px-3 sm:px-4 py-2.5 text-sm sm:text-base border border-[#444444] rounded-lg shadow-sm focus:ring-0 focus:border-[#444444] bg-[#2f2f2f] text-white placeholder-[#8b8b8b] resize-none overflow-y-auto max-h-32'
						/>
						{isSupported && (
							<button
								type='button'
								onClick={handleVoiceToggle}
								className={`p-2.5 rounded-lg transition-all shrink-0 ${
									isListening
										? 'bg-red-600 hover:bg-red-700 animate-pulse'
										: 'bg-[#2f2f2f] hover:bg-[#565869] border border-[#444444]'
								} text-white`}
								title={
									isListening
										? 'Stop recording'
										: 'Start recording'
								}
							>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									strokeWidth={1.5}
									stroke='currentColor'
									className='w-5 h-5 sm:w-6 sm:h-6'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d={
											isListening
												? 'M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z'
												: 'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z'
										}
									/>
								</svg>
							</button>
						)}
					</div>
					<button
						type='submit'
						disabled={!input.trim() || isLoading || isGenerating}
						className='px-3 sm:px-6 py-2.5 shrink-0 text-sm sm:text-base bg-white hover:bg-[#e0e0e0] disabled:bg-[#2f2f2f] disabled:text-[#8b8b8b] disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors hover:pointer'
					>
						{chatMode === 'contentGen' ? 'Generate' : 'Send'}
					</button>
				</form>
			</div>
		</div>
	);
}
