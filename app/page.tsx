'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import UploadForm from '@/components/UploadForm';
import SearchDeleteUI from '@/components/SearchDeleteUI';

type Tab = 'upload' | 'search';

export default function Home() {
	const [activeTab, setActiveTab] = useState<Tab>('search');
	const router = useRouter();

	const handleLogout = async () => {
		await fetch('/api/auth/logout', { method: 'POST' });
		router.push('/login');
		router.refresh();
	};

	return (
		<main className='h-screen flex flex-col p-2 sm:p-4 bg-[#0d0d0d]'>
			<div className='max-w-6xl mx-auto w-full flex flex-col flex-1 min-h-0'>
				<div className='flex justify-end mb-1 sm:mb-2 shrink-0'>
					<button
						onClick={handleLogout}
						className='text-sm text-[#8b8b8b] hover:text-white transition-colors'
					>
						Sign Out
					</button>
				</div>

				<div className='bg-[#1a1a1a] rounded-lg shadow-xl border border-[#2f2f2f] p-3 sm:p-4 flex flex-col flex-1 min-h-0'>
					{/* Tab Navigation */}
					<div className='flex overflow-x-auto border-b border-[#2f2f2f] mb-3 sm:mb-4 -mx-3 sm:-mx-4 px-3 sm:px-4 shrink-0'>
						<button
							onClick={() => setActiveTab('search')}
							className={`px-4 sm:px-6 py-3 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
								activeTab === 'search'
									? 'border-b-2 border-white text-white'
									: 'text-[#8b8b8b] hover:text-white'
							}`}
						>
							Search
						</button>
						<button
							onClick={() => setActiveTab('upload')}
							className={`px-4 sm:px-6 py-3 font-medium transition-colors whitespace-nowrap text-sm sm:text-base ${
								activeTab === 'upload'
									? 'border-b-2 border-white text-white'
									: 'text-[#8b8b8b] hover:text-white'
							}`}
						>
							Upload
						</button>
					</div>

					{/* Tab Content */}
					<div className='flex-1 min-h-0 flex flex-col'>
						{activeTab === 'search' && <SearchDeleteUI />}
						{activeTab === 'upload' && <UploadForm />}
					</div>
				</div>
			</div>
		</main>
	);
}
