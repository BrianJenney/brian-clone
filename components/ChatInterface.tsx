'use client';

import { useChat, Chat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useRef, useEffect, useState } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatInterface() {
	const { messages, sendMessage, status, error } = useChat({
		transport: new DefaultChatTransport({
			api: '/api/chat',
		}),
	});

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
		// Auto-resize textarea
		e.target.style.height = 'auto';
		e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Sync voice transcript with input
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

	return (
		<div className='flex flex-col h-[calc(100vh-300px)] min-h-[400px] max-h-[600px] space-y-4'>
			<h2 className='text-xl sm:text-2xl font-bold text-white'>
				AI Writing Assistant
			</h2>

			{/* Messages Container */}
			<div className='flex-1 overflow-y-auto border border-gray-700 rounded-lg p-4 space-y-4 bg-gray-800'>
				{messages.length === 0 && (
					<div className='text-center text-gray-400 py-8'>
						<p className='text-lg mb-2'>
							Welcome! I'm your AI writing assistant.
						</p>
						<p className='text-sm'>
							I can help you write transcripts, articles, and
							posts in your style.
						</p>
						<div className='mt-4 text-left max-w-md mx-auto space-y-2'>
							<p className='font-medium'>Try asking me to:</p>
							<ul className='list-disc list-inside space-y-1 text-gray-400'>
								<li>Search through your existing content</li>
								<li>Generate a new article about a topic</li>
								<li>Write a post in your style</li>
								<li>
									Upload new content to the knowledge base
								</li>
							</ul>
						</div>
					</div>
				)}

				{messages.map((message, index) => (
					<div
						key={index}
						className={`flex ${
							message.role === 'user'
								? 'justify-end'
								: 'justify-start'
						}`}
					>
						<div
							className={`max-w-[80%] rounded-lg px-4 py-2 ${
								message.role === 'user'
									? 'bg-blue-600 text-white'
									: 'bg-gray-700 text-white'
							}`}
						>
							{/* Role Label */}
							<div className='text-xs font-medium mb-1 opacity-75'>
								{message.role === 'user' ? 'You' : 'Assistant'}
							</div>

							{/* Message Content */}
							<div className='text-sm'>
								{message.parts.map((part, partIndex) => {
									if (part.type === 'tool-result') {
										return (
											<div
												key={`${message.id}-tool-result-${partIndex}`}
											>
												{part.toolCallId}
											</div>
										);
									}
									if (part.type === 'dynamic-tool') {
										return (
											<div
												key={`${message.id}-tool-${partIndex}`}
											>
												{part.toolName}
											</div>
										);
									}
									if (part.type === 'text') {
										return (
											<div
												key={`${message.id}-text-${partIndex}`}
											>
												{message.role ===
												'assistant' ? (
													<ReactMarkdown
														remarkPlugins={[
															remarkGfm,
														]}
														className='prose prose-invert prose-sm max-w-none'
														components={{
															h1: ({
																node,
																...props
															}) => (
																<h1
																	className='text-xl font-bold mt-4 mb-2'
																	{...props}
																/>
															),
															h2: ({
																node,
																...props
															}) => (
																<h2
																	className='text-lg font-bold mt-3 mb-2'
																	{...props}
																/>
															),
															h3: ({
																node,
																...props
															}) => (
																<h3
																	className='text-base font-bold mt-2 mb-1'
																	{...props}
																/>
															),
															p: ({
																node,
																...props
															}) => (
																<p
																	className='mb-2 last:mb-0'
																	{...props}
																/>
															),
															ul: ({
																node,
																...props
															}) => (
																<ul
																	className='list-disc list-inside mb-2 space-y-1'
																	{...props}
																/>
															),
															ol: ({
																node,
																...props
															}) => (
																<ol
																	className='list-decimal list-inside mb-2 space-y-1'
																	{...props}
																/>
															),
															li: ({
																node,
																...props
															}) => (
																<li
																	className='ml-4'
																	{...props}
																/>
															),
															code: ({
																node,
																inline,
																...props
															}) =>
																inline ? (
																	<code
																		className='bg-gray-800 px-1 py-0.5 rounded text-blue-300'
																		{...props}
																	/>
																) : (
																	<code
																		className='block bg-gray-800 p-2 rounded my-2 overflow-x-auto'
																		{...props}
																	/>
																),
															blockquote: ({
																node,
																...props
															}) => (
																<blockquote
																	className='border-l-4 border-gray-500 pl-4 my-2 italic'
																	{...props}
																/>
															),
															a: ({
																node,
																...props
															}) => (
																<a
																	className='text-blue-400 hover:underline'
																	{...props}
																/>
															),
														}}
													>
														{part.text}
													</ReactMarkdown>
												) : (
													<div className='whitespace-pre-wrap'>
														{part.text}
													</div>
												)}
											</div>
										);
									}
									return null;
								})}
							</div>
						</div>
					</div>
				))}

				<div ref={messagesEndRef} />
			</div>

			{/* Error Messages */}
			{error && (
				<div className='p-3 rounded-md bg-red-900 text-red-200 text-sm'>
					Error: {error.message}
				</div>
			)}
			{voiceError && (
				<div className='p-3 rounded-md bg-yellow-900 text-yellow-200 text-sm'>
					{voiceError}
				</div>
			)}

			{/* Voice Status Indicator */}
			{isListening && (
				<div className='flex items-center gap-2 p-3 rounded-md bg-blue-900/50 text-blue-200 text-sm animate-pulse'>
					<div className='w-2 h-2 bg-red-500 rounded-full animate-pulse' />
					<span>Listening...</span>
				</div>
			)}

			{/* Input Form */}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (input.trim()) {
						sendMessage({ text: input });
						setInput('');
						resetTranscript();
					}
				}}
				className='flex gap-2'
			>
				<div className='flex-1 flex gap-2'>
					<textarea
						value={input}
						onChange={handleInputChange}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								if (input.trim()) {
									sendMessage({ text: input });
									setInput('');
									resetTranscript();
									// Reset textarea height
									e.currentTarget.style.height = 'auto';
								}
							}
						}}
						placeholder='Type or use voice... (Shift+Enter for new line)'
						rows={1}
						className='flex-1 px-4 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400 resize-none overflow-y-auto max-h-32'
					/>
					{isSupported && (
						<button
							type='button'
							onClick={handleVoiceToggle}
							className={`p-2 rounded-md transition-all ${
								isListening
									? 'bg-red-600 hover:bg-red-700 animate-pulse'
									: 'bg-gray-600 hover:bg-gray-500'
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
								className='w-6 h-6'
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
					disabled={!input.trim() || status === 'streaming'}
					className='px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors'
				>
					Send
				</button>
			</form>
		</div>
	);
}
