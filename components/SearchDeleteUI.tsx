'use client';

import { useState } from 'react';
import {
	SearchRequest,
	SearchResponse,
	SearchResult,
	ContentType,
} from '@/libs/schemas';

export default function SearchDeleteUI() {
	const [query, setQuery] = useState('');
	const [selectedTypes, setSelectedTypes] = useState<ContentType[]>([
		'transcript',
		'article',
		'post',
	]);
	const [limit, setLimit] = useState(10);
	const [loading, setLoading] = useState(false);
	const [results, setResults] = useState<SearchResult[]>([]);
	const [selectedIds, setSelectedIds] = useState<Set<string | number>>(
		new Set()
	);
	const [error, setError] = useState<string | null>(null);
	const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

	const handleSearch = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setResults([]);
		setSelectedIds(new Set());
		setDeleteMessage(null);

		try {
			const searchRequest: SearchRequest = {
				query,
				collections: selectedTypes,
				limit,
			};

			const response = await fetch('/api/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(searchRequest),
			});

			const data: SearchResponse = await response.json();

			if (response.ok && data.success) {
				setResults(data.results);
			} else {
				setError('Failed to search content');
			}
		} catch (err) {
			setError('An error occurred while searching');
		} finally {
			setLoading(false);
		}
	};

	const toggleType = (type: ContentType) => {
		setSelectedTypes((prev) =>
			prev.includes(type)
				? prev.filter((t) => t !== type)
				: [...prev, type]
		);
	};

	const toggleSelection = (id: string | number) => {
		setSelectedIds((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(id)) {
				newSet.delete(id);
			} else {
				newSet.add(id);
			}
			return newSet;
		});
	};

	const selectAll = () => {
		setSelectedIds(new Set(results.map((r) => r.id)));
	};

	const deselectAll = () => {
		setSelectedIds(new Set());
	};

	const handleDelete = async () => {
		if (selectedIds.size === 0) return;

		if (
			!confirm(
				`Are you sure you want to delete ${selectedIds.size} item(s)?`
			)
		) {
			return;
		}

		setLoading(true);
		setError(null);
		setDeleteMessage(null);

		try {
			// Group IDs by collection type
			const idsByCollection = new Map<ContentType, (string | number)[]>();

			results.forEach((result) => {
				if (selectedIds.has(result.id)) {
					const ids = idsByCollection.get(result.contentType) || [];
					ids.push(result.id);
					idsByCollection.set(result.contentType, ids);
				}
			});

			// Delete from each collection
			const deletePromises = Array.from(idsByCollection.entries()).map(
				async ([collection, ids]) => {
					const response = await fetch('/api/delete', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ ids, collection }),
					});

					if (!response.ok) {
						throw new Error(`Failed to delete from ${collection}`);
					}

					return ids.length;
				}
			);

			const deletedCounts = await Promise.all(deletePromises);
			const totalDeleted = deletedCounts.reduce(
				(sum, count) => sum + count,
				0
			);

			setDeleteMessage(`Successfully deleted ${totalDeleted} item(s)`);

			// Remove deleted items from results
			setResults((prev) => prev.filter((r) => !selectedIds.has(r.id)));
			setSelectedIds(new Set());
		} catch (err) {
			setError('An error occurred while deleting');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='space-y-4'>
			<h2 className='text-2xl font-bold text-white'>
				Search & Delete Content
			</h2>

			{/* Search Form */}
			<form onSubmit={handleSearch} className='space-y-4'>
				<div>
					<label
						htmlFor='query'
						className='block text-sm font-medium text-gray-300 mb-1'
					>
						Search Query
					</label>
					<input
						type='text'
						id='query'
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						required
						placeholder='Enter search query...'
						className='w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400'
					/>
				</div>

				<div>
					<label className='block text-sm font-medium text-gray-300 mb-2'>
						Content Types
					</label>
					<div className='flex gap-4'>
						{(
							['transcript', 'article', 'post'] as ContentType[]
						).map((type) => (
							<label
								key={type}
								className='flex items-center gap-2'
							>
								<input
									type='checkbox'
									checked={selectedTypes.includes(type)}
									onChange={() => toggleType(type)}
									className='rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500'
								/>
								<span className='text-sm text-gray-300 capitalize'>
									{type}
								</span>
							</label>
						))}
					</div>
				</div>

				<div>
					<label
						htmlFor='limit'
						className='block text-sm font-medium text-gray-300 mb-1'
					>
						Results Limit: {limit}
					</label>
					<input
						type='range'
						id='limit'
						min='5'
						max='50'
						value={limit}
						onChange={(e) => setLimit(parseInt(e.target.value))}
						className='w-full accent-blue-600'
					/>
				</div>

				<button
					type='submit'
					disabled={loading || selectedTypes.length === 0}
					className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors'
				>
					{loading ? 'Searching...' : 'Search'}
				</button>
			</form>

			{/* Error */}
			{error && (
				<div className='p-4 rounded-md bg-red-900 text-red-200'>
					{error}
				</div>
			)}

			{/* Delete Success Message */}
			{deleteMessage && (
				<div className='p-4 rounded-md bg-green-900 text-green-200'>
					{deleteMessage}
				</div>
			)}

			{/* Results */}
			{results.length > 0 && (
				<div className='space-y-3'>
					<div className='flex justify-between items-center'>
						<h3 className='text-lg font-semibold text-white'>
							Results ({results.length})
						</h3>
						<div className='flex gap-2'>
							<button
								onClick={selectAll}
								className='px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors'
							>
								Select All
							</button>
							<button
								onClick={deselectAll}
								className='px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors'
							>
								Deselect All
							</button>
							{selectedIds.size > 0 && (
								<button
									onClick={handleDelete}
									disabled={loading}
									className='px-3 py-1 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded transition-colors'
								>
									Delete ({selectedIds.size})
								</button>
							)}
						</div>
					</div>

					<div className='space-y-2'>
						{results.map((result) => (
							<div
								key={String(result.id)}
								className={`p-4 border rounded-md cursor-pointer transition-colors ${
									selectedIds.has(result.id)
										? 'bg-blue-900 border-blue-500'
										: 'bg-gray-800 border-gray-700 hover:bg-gray-700'
								}`}
								onClick={() => toggleSelection(result.id)}
							>
								<div className='flex justify-between items-start mb-2'>
									<div className='flex items-center gap-2'>
										<input
											type='checkbox'
											checked={selectedIds.has(result.id)}
											onChange={() =>
												toggleSelection(result.id)
											}
											className='rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500'
											onClick={(e) => e.stopPropagation()}
										/>
										<span className='px-2 py-1 bg-gray-700 text-gray-200 rounded text-xs font-medium capitalize'>
											{result.contentType}
										</span>
										<span className='text-sm text-gray-400'>
											Score: {result.score.toFixed(3)}
										</span>
									</div>
									{result.chunkIndex !== undefined && (
										<span className='text-xs text-gray-400'>
											Chunk {result.chunkIndex + 1} of{' '}
											{result.totalChunks}
										</span>
									)}
								</div>
								<p className='text-sm text-gray-200 line-clamp-3'>
									{result.text}
								</p>
								<div className='mt-2 space-y-1'>
									{result.metadata?.title && (
										<p className='text-xs text-gray-400'>
											Title: {result.metadata.title}
										</p>
									)}
									{result.metadata?.sourceUrl && (
										<a
											href={result.metadata.sourceUrl}
											target='_blank'
											rel='noopener noreferrer'
											onClick={(e) => e.stopPropagation()}
											className='inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline'
										>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												fill='none'
												viewBox='0 0 24 24'
												strokeWidth={1.5}
												stroke='currentColor'
												className='w-3 h-3'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													d='M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25'
												/>
											</svg>
											View Full Source
										</a>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
