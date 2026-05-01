'use client';

import { useState } from 'react';

type ThumbnailRef = {
	video_id: string;
	title: string;
	channel: string;
	thumbnail_url: string;
	performance_score: number;
	view_count: number;
	composition: string;
	color_mood: string;
	style_tags: string[];
};

type AnalysisResult = {
	concept: string;
	pattern_summary: string;
	directions: Array<{
		name: string;
		description: string;
		key_elements: string[];
	}>;
	references: ThumbnailRef[];
};

function Spinner() {
	return (
		<svg className='animate-spin h-5 w-5' viewBox='0 0 24 24'>
			<circle
				className='opacity-25'
				cx='12'
				cy='12'
				r='10'
				stroke='currentColor'
				strokeWidth='4'
				fill='none'
			/>
			<path
				className='opacity-75'
				fill='currentColor'
				d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
			/>
		</svg>
	);
}

export default function ThumbnailsPage() {
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<AnalysisResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const search = async () => {
		if (!query.trim()) return;
		setLoading(true);
		setError(null);
		try {
			const res = await fetch('/api/thumbnails/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ concept: query, limit: 20 }),
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || `Request failed: ${res.status}`);
			}
			const data = await res.json();
			setResults(data);
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : 'Search failed');
		}
		setLoading(false);
	};

	return (
		<div className='p-8 max-w-6xl mx-auto'>
			<h1 className='text-2xl font-bold mb-4'>Thumbnail Search</h1>

			<div className='flex gap-2 mb-6'>
				<input
					type='text'
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder='e.g., coding tutorial with surprised face'
					className='flex-1 p-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500'
					onKeyDown={(e) => e.key === 'Enter' && !loading && search()}
					disabled={loading}
				/>
				<button
					onClick={search}
					disabled={loading || !query.trim()}
					className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 min-w-[100px] justify-center'
				>
					{loading ? (
						<>
							<Spinner />
							<span>Analyzing...</span>
						</>
					) : (
						'Search'
					)}
				</button>
			</div>

			{/* Loading State */}
			{loading && (
				<div className='flex flex-col items-center justify-center py-16 text-gray-400'>
					<Spinner />
					<p className='mt-4'>Analyzing thumbnails with AI...</p>
					<p className='text-sm text-gray-500 mt-1'>This may take up to 30 seconds</p>
				</div>
			)}

			{/* Error State */}
			{error && !loading && (
				<div className='mb-6 p-4 bg-red-900/50 border border-red-700 rounded'>
					<p className='text-red-300 mb-2'>{error}</p>
					<button
						onClick={search}
						className='px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm'
					>
						Retry
					</button>
				</div>
			)}

			{results && !loading && (
				<>
					{/* Pattern Summary */}
					<div className='mb-6 p-4 bg-gray-800 border border-gray-700 rounded'>
						<h2 className='font-semibold mb-2 text-white'>Pattern Analysis</h2>
						<p className='text-gray-300'>{results.pattern_summary}</p>
					</div>

					{/* Design Directions */}
					{results.directions?.length > 0 && (
						<div className='mb-6'>
							<h2 className='font-semibold mb-2'>
								Design Directions
							</h2>
							<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
								{results.directions.map((dir, i) => (
									<div key={i} className='p-3 bg-gray-800 border border-gray-700 rounded'>
										<h3 className='font-medium text-white'>
											{dir.name}
										</h3>
										<p className='text-sm text-gray-400'>
											{dir.description}
										</p>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Thumbnail Grid */}
					<h2 className='font-semibold mb-2'>
						Reference Thumbnails ({results.references?.length})
					</h2>
					<div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
						{results.references?.map((thumb) => (
							<a
								key={thumb.video_id}
								href={`https://youtube.com/watch?v=${thumb.video_id}`}
								target='_blank'
								rel='noopener noreferrer'
								className='group'
							>
								<div className='relative aspect-video overflow-hidden rounded-lg'>
									<img
										src={thumb.thumbnail_url}
										alt={thumb.title}
										className='w-full h-full object-cover group-hover:scale-105           
  transition-transform'
									/>
									<div
										className='absolute bottom-0 left-0 right-0 bg-gradient-to-t       
  from-black/80 p-2'
									>
										<p
											className='text-white text-xs font-medium                          
  truncate'
										>
											{thumb.title}
										</p>
										<p className='text-white/70 text-xs'>
											{thumb.channel}
										</p>
									</div>
								</div>
								<div className='mt-1 flex gap-2 text-xs text-gray-400'>
									<span>
										Score: {thumb.performance_score}
									</span>
									<span>{thumb.color_mood}</span>
								</div>
							</a>
						))}
					</div>
				</>
			)}
		</div>
	);
}
