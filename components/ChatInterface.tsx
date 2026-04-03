'use client';

import { useRef, useEffect, useState } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { StlyedMarkdown } from '@/components/ReactMarkdown';

type Message = {
	role: 'user' | 'assistant';
	content: string;
};

export default function ChatInterface() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [currentTool, setCurrentTool] = useState<string | null>(null);
	const [reasoning, setReasoning] = useState<string | null>(null);
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

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	useEffect(() => {
		if (transcript) setInput(transcript);
	}, [transcript]);

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
		e.target.style.height = 'auto';
		e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
	};

	const handleVoiceToggle = () => {
		if (isListening) stopListening();
		else startListening();
	};

	const handleChatMessage = async (message: string) => {
		try {
			setIsLoading(true);
			setError(null);
			setCurrentTool(null);
			setReasoning(null);

			const userMessage: Message = { role: 'user', content: message };
			const assistantMessage: Message = {
				role: 'assistant',
				content: '',
			};

			setMessages((prev) => [...prev, userMessage, assistantMessage]);

			// Limit to last 10 messages for API call
			const recentMessages = [...messages, userMessage].slice(-10);

			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages: recentMessages }),
			});

			const contentType = response.headers.get('content-type') ?? '';

			if (!response.ok) {
				let message = `Request failed (${response.status})`;
				try {
					if (contentType.includes('application/json')) {
						const errorData = await response.json();
						message = errorData?.message ?? errorData?.error ?? message;
					} else {
						const errorText = await response.text();
						if (errorText) message = errorText;
					}
				} catch {
					// keep fallback message
				}
				throw new Error(message);
			}

			// Backward-compatible path for non-streaming API responses.
			if (!response.body || contentType.includes('application/json')) {
				const payload = await response.json();
				if (payload?.type === 'error') {
					setError(payload.message ?? 'Unknown error');
					return;
				}

				if (payload?.success === false) {
					setError(payload.error ?? 'Unknown error');
					return;
				}

				const finalText =
					typeof payload?.response === 'string'
						? payload.response
						: typeof payload?.interruptPayload?.message === 'string'
							? payload.interruptPayload.message
							: '';

				setMessages((prev) => {
					const next = [...prev];
					const last = next[next.length - 1];
					if (last?.role === 'assistant') last.content = finalText;
					return next;
				});
				return;
			}

			const reader = response.body.getReader();

			const decoder = new TextDecoder();
			let accumulatedContent = '';
			let accumulatedReasoning = '';
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const data = JSON.parse(line);

						if (data.type === 'progress') {
							setCurrentTool(data.message);
							setReasoning(null);
						} else if (data.type === 'reasoning') {
							accumulatedReasoning += data.content;
							setReasoning(accumulatedReasoning);
						} else if (data.type === 'text') {
							accumulatedContent += data.content;
							setCurrentTool(null);
							setReasoning(null);
							setMessages((prev) => {
								const next = [...prev];
								const last = next[next.length - 1];
								if (last.role === 'assistant')
									last.content = accumulatedContent;
								return next;
							});
						} else if (data.type === 'interrupt') {
							// Handle typeform approval interrupt
							const payload = data.payload;
							if (payload?.type === 'typeform_approval') {
								setMessages((prev) => {
									const next = [...prev];
									const last = next[next.length - 1];
									if (last.role === 'assistant') {
										last.content = `**Form Preview**\n\n${payload.message}\n\n\`\`\`json\n${JSON.stringify(payload.formDesign, null, 2)}\n\`\`\``;
									}
									return next;
								});
							}
						} else if (data.type === 'error') {
							setError(data.message);
						} else if (data.type === 'done') {
							setReasoning(null);
						}
					} catch {
						// ignore incomplete JSON lines
					}
				}
			}
		} catch (error) {
			console.error('Chat error:', error);
			setError(error instanceof Error ? error.message : 'Unknown error');
		} finally {
			setIsLoading(false);
			setCurrentTool(null);
			setReasoning(null);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;

		handleChatMessage(input);
		setInput('');
		resetTranscript();
	};

	const handleClearChat = () => {
		setMessages([]);
		setError(null);
		setCurrentTool(null);
		setReasoning(null);
		setInput('');
		resetTranscript();
	};

	return (
		<div className='flex flex-1 min-h-0 gap-2 sm:gap-3'>
			<div className='flex flex-col flex-1 min-w-0 space-y-3 sm:space-y-4'>
				{/* Messages Container */}
				<div className='flex-1 overflow-y-auto border border-[#2f2f2f] rounded-lg p-2 sm:p-4 space-y-3 sm:space-y-4 bg-[#1a1a1a]'>
					{messages.length === 0 && !isLoading && (
						<div className='flex flex-col items-center justify-center py-8 space-y-4'>
							<p className='text-[#8b8b8b] text-sm'>
								Ready to help with content, strategy, or research.
							</p>
							<button
								type='button'
								onClick={() => handleChatMessage('What should I work on today?')}
								className='px-4 py-2 text-sm bg-[#2f2f2f] hover:bg-[#3f3f3f] text-[#c5c5d2] rounded-lg border border-[#444] transition-colors'
							>
								Check recent activity
							</button>
						</div>
					)}
					{messages.length === 0 && isLoading && (
						<div className='flex justify-center items-center py-8'>
							<div className='flex items-center gap-3 text-[#8b8b8b]'>
								<div className='w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin' />
								<span>Checking recent activity...</span>
							</div>
						</div>
					)}

					{/* Chat Messages */}
					{messages
						.filter((msg) => msg.role === 'user' || msg.content)
						.map((message, index) => (
							<div
								key={index}
								className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
							>
								<div
									className={`max-w-[90%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 ${
										message.role === 'user'
											? 'bg-blue-600 text-white'
											: 'bg-[#2f2f2f] text-white'
									}`}
								>
									<div className='text-base font-medium mb-1 opacity-75'>
										{message.role === 'user'
											? 'You'
											: 'Assistant'}
									</div>
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

					{/* Loading indicator — only while no content has arrived yet */}
					{isLoading &&
						messages.length > 0 &&
						messages[messages.length - 1].role === 'assistant' &&
						!messages[messages.length - 1].content && (
							<div className='flex justify-start'>
								<div className='max-w-[90%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-3 bg-[#2f2f2f] text-white'>
									<div className='text-base font-medium mb-1 opacity-75'>
										Assistant
									</div>
									<div className='animate-pulse'>
									<div className='flex items-center gap-2 text-sm text-[#a0a0b0]'>
										<div className='w-2 h-2 bg-blue-400 rounded-full animate-ping' />
										<span>{reasoning ? 'thinking' : currentTool || 'thinking'}</span>
									</div>
									{reasoning && (
										<div className='text-sm text-[#808090] italic pl-4 mt-1 line-clamp-2'>
											{reasoning.slice(-100)}
										</div>
									)}
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

				{/* Listening State */}
				{isListening && (
					<div className='flex items-center gap-2 p-3 rounded-md bg-blue-900/50 text-blue-200 text-sm animate-pulse'>
						<div className='w-2 h-2 bg-red-500 rounded-full animate-pulse' />
						<span>Listening...</span>
					</div>
				)}

				{/* Input Form */}
				<form onSubmit={handleSubmit} className='flex gap-1.5 sm:gap-2'>
					{messages.length > 0 && (
						<button
							type='button'
							onClick={handleClearChat}
							className='px-3 py-2.5 shrink-0 text-sm bg-[#2f2f2f] hover:bg-[#3f3f3f] text-[#c5c5d2] rounded-lg border border-[#444] transition-colors'
							title='Clear chat'
						>
							Clear
						</button>
					)}
					<div className='flex-1 flex gap-1.5 sm:gap-2'>
						<textarea
							value={input}
							onChange={handleInputChange}
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									if (input.trim()) {
										handleSubmit(e as any);
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
						disabled={!input.trim() || isLoading}
						className='px-3 sm:px-6 py-2.5 shrink-0 text-sm sm:text-base bg-white hover:bg-[#e0e0e0] disabled:bg-[#2f2f2f] disabled:text-[#8b8b8b] disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors hover:pointer'
					>
						Send
					</button>
				</form>
			</div>
		</div>
	);
}
