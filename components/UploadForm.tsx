'use client';

import { useState } from 'react';
import { ContentType, UploadRequest, UploadResponse } from '@/libs/schemas';

export default function UploadForm() {
	const [formData, setFormData] = useState<UploadRequest>({
		text: '',
		contentType: 'article',
		metadata: {
			title: '',
			tags: [],
		},
	});
	const [tagInput, setTagInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<UploadResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	const addTag = () => {
		if (tagInput.trim() && formData.metadata) {
			setFormData({
				...formData,
				metadata: {
					...formData.metadata,
					tags: [...(formData.metadata.tags || []), tagInput.trim()],
				},
			});
			setTagInput('');
		}
	};

	const removeTag = (index: number) => {
		if (formData.metadata?.tags) {
			const newTags = [...formData.metadata.tags];
			newTags.splice(index, 1);
			setFormData({
				...formData,
				metadata: {
					...formData.metadata,
					tags: newTags,
				},
			});
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setResult(null);

		try {
			const response = await fetch('/api/upload', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (response.ok) {
				setResult(data);
				// Reset form
				setFormData({
					text: '',
					contentType: 'article',
					metadata: { title: '', tags: [] },
				});
			} else {
				setError(data.error || 'Failed to upload content');
			}
		} catch (err) {
			setError('An error occurred while uploading');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='space-y-4'>
			<h2 className='text-2xl font-bold text-white'>Upload Content</h2>

			<form onSubmit={handleSubmit} className='space-y-4'>
				{/* Content Type */}
				<div>
					<label
						htmlFor='contentType'
						className='block text-sm font-medium text-[#b0b0b0] mb-1'
					>
						Content Type
					</label>
					<select
						id='contentType'
						value={formData.contentType}
						onChange={(e) =>
							setFormData({
								...formData,
								contentType: e.target.value as ContentType,
							})
						}
						className='w-full px-3 py-2 border border-[#444444] rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-[#2f2f2f] text-white'
					>
						<option value='transcript'>Transcript</option>
						<option value='article'>Article</option>
						<option value='post'>Post</option>
					</select>
					<p className='mt-1 text-xs text-[#8b8b8b]'>
						{formData.contentType === 'post'
							? 'Posts are stored as-is (no chunking)'
							: 'Articles and transcripts will be chunked with overlap'}
					</p>
				</div>

				{/* Title */}
				<div>
					<label
						htmlFor='title'
						className='block text-sm font-medium text-[#b0b0b0] mb-1'
					>
						Title (Optional)
					</label>
					<input
						type='text'
						id='title'
						value={formData.metadata?.title || ''}
						onChange={(e) =>
							setFormData({
								...formData,
								metadata: {
									...formData.metadata,
									title: e.target.value,
								},
							})
						}
						placeholder='Enter title...'
						className='w-full px-3 py-2 border border-[#444444] rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-[#2f2f2f] text-white placeholder-[#8b8b8b]'
					/>
				</div>

				{/* Tags */}
				<div>
					<label className='block text-sm font-medium text-[#b0b0b0] mb-1'>
						Tags (Optional)
					</label>
					<div className='flex gap-2 mb-2'>
						<input
							type='text'
							value={tagInput}
							onChange={(e) => setTagInput(e.target.value)}
							onKeyPress={(e) =>
								e.key === 'Enter' &&
								(e.preventDefault(), addTag())
							}
							placeholder='Add tag...'
							className='flex-1 px-3 py-2 border border-[#444444] rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-[#2f2f2f] text-white placeholder-[#8b8b8b]'
						/>
						<button
							type='button'
							onClick={addTag}
							className='px-4 py-2 bg-[#2f2f2f] hover:bg-[#2f2f2f] text-white rounded-md transition-colors border border-[#444444]'
						>
							Add
						</button>
					</div>
					<div className='flex flex-wrap gap-2'>
						{formData.metadata?.tags?.map((tag, index) => (
							<span
								key={index}
								className='px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-sm flex items-center gap-2'
							>
								{tag}
								<button
									type='button'
									onClick={() => removeTag(index)}
									className='hover:text-red-400'
								>
									×
								</button>
							</span>
						))}
					</div>
				</div>

				{/* Text Content */}
				<div>
					<label
						htmlFor='text'
						className='block text-sm font-medium text-[#b0b0b0] mb-1'
					>
						Content
					</label>
					<textarea
						id='text'
						value={formData.text}
						onChange={(e) =>
							setFormData({ ...formData, text: e.target.value })
						}
						required
						rows={10}
						placeholder='Paste your content here...'
						className='w-full px-3 py-2 border border-[#444444] rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-[#2f2f2f] text-white placeholder-[#8b8b8b] font-mono text-sm'
					/>
					<p className='mt-1 text-xs text-[#8b8b8b]'>
						{formData.text.length} characters
					</p>
				</div>

				{/* Submit */}
				<button
					type='submit'
					disabled={loading}
					className='w-full bg-white hover:bg-[#e0e0e0] disabled:bg-[#2f2f2f] disabled:text-[#8b8b8b] text-black font-medium py-2 px-4 rounded-md transition-colors'
				>
					{loading ? 'Uploading...' : 'Upload Content'}
				</button>
			</form>

			{/* Error */}
			{error && (
				<div className='p-4 rounded-md bg-red-900 text-red-200'>
					{error}
				</div>
			)}

			{/* Success */}
			{result && (
				<div className='p-4 rounded-md bg-green-900 text-green-200'>
					<p className='font-medium'>{result.message}</p>
					<p className='text-sm mt-1'>
						Created {result.chunksCreated} chunk(s)
					</p>
				</div>
			)}
		</div>
	);
}
