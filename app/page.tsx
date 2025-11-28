'use client';
import { useState } from 'react';
import UploadForm from '@/components/UploadForm';
import SearchDeleteUI from '@/components/SearchDeleteUI';
import ChatInterface from '@/components/ChatInterface';

type Tab = 'upload' | 'search' | 'chat';

export default function Home() {
	const [activeTab, setActiveTab] = useState<Tab>('chat');

	return (
		<main className='min-h-screen p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'>
			<div className='max-w-6xl mx-auto'>
				<h1 className='text-2xl sm:text-4xl font-bold text-center mb-2 text-white'>
					Brian's AI Writing Assistant
				</h1>
				<p className='text-center text-gray-300 mb-4 sm:mb-8 text-sm sm:text-base'>
					AI-powered content creation, search, and management
				</p>

				<div className='bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4 sm:p-6'>
					{/* Tab Navigation */}
					<div className='flex overflow-x-auto border-b border-gray-700 mb-6 -mx-4 sm:mx-0 px-4 sm:px-0'>
						<button
							onClick={() => setActiveTab('chat')}
							className={`px-4 sm:px-6 py-3 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
								activeTab === 'chat'
									? 'border-b-2 border-blue-500 text-blue-400'
									: 'text-gray-400 hover:text-gray-200'
							}`}
						>
							Chat
						</button>

						<button
							onClick={() => setActiveTab('upload')}
							className={`px-4 sm:px-6 py-3 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
								activeTab === 'upload'
									? 'border-b-2 border-blue-500 text-blue-400'
									: 'text-gray-400 hover:text-gray-200'
							}`}
						>
							Upload
						</button>
						<button
							onClick={() => setActiveTab('search')}
							className={`px-4 sm:px-6 py-3 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
								activeTab === 'search'
									? 'border-b-2 border-blue-500 text-blue-400'
									: 'text-gray-400 hover:text-gray-200'
							}`}
						>
							Search
						</button>
					</div>

					{/* Tab Content */}
					<div className='mt-6'>
						{activeTab === 'chat' && <ChatInterface />}
						{activeTab === 'upload' && <UploadForm />}
						{activeTab === 'search' && <SearchDeleteUI />}
					</div>
				</div>
			</div>
		</main>
	);
}
