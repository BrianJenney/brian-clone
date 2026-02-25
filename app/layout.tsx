import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
	title: 'Article Trainer',
	description: 'Train AI to write articles in your style',
	icons: {
		icon: '/brain.svg',
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='en' className='dark'>
			<body className='antialiased bg-[#0d0d0d] text-white'>
				{children}
			</body>
		</html>
	);
}
