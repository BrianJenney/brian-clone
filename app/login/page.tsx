'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setIsLoading(true);

		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password }),
			});

			if (res.ok) {
				router.push('/');
				router.refresh();
			} else {
				const data = await res.json();
				setError(data.error || 'Invalid password');
			}
		} catch {
			setError('Something went wrong');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<main className='min-h-screen flex items-center justify-center bg-[#0d0d0d] p-4'>
			<div className='w-full max-w-md'>
				<div className='bg-[#1a1a1a] rounded-lg shadow-xl border border-[#2f2f2f] p-8'>
					<h1 className='text-2xl font-bold text-center mb-2 text-white'>
						Brian's AI Writing Assistant
					</h1>
					<p className='text-center text-[#8b8b8b] mb-8'>
						Enter password to continue
					</p>

					<form onSubmit={handleSubmit} className='space-y-4'>
						<div>
							<input
								type='password'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder='Password'
								autoFocus
								className='w-full px-4 py-3 border border-[#444444] rounded-lg bg-[#2f2f2f] text-white placeholder-[#8b8b8b] focus:ring-0 focus:border-[#444444]'
							/>
						</div>

						{error && (
							<div className='p-3 rounded-md bg-red-900/50 border border-red-700 text-red-200 text-sm text-center'>
								{error}
							</div>
						)}

						<button
							type='submit'
							disabled={isLoading || !password}
							className='w-full py-3 bg-white hover:bg-[#e0e0e0] disabled:bg-[#2f2f2f] disabled:text-[#8b8b8b] disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors'
						>
							{isLoading ? 'Signing in...' : 'Sign In'}
						</button>
					</form>
				</div>
			</div>
		</main>
	);
}
