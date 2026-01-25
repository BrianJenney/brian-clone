/** @type {import('next').NextConfig} */
const nextConfig = {
	rewrites: async () => {
		return [
			{
				source: '/python/api/:path*',
				destination:
					process.env.NODE_ENV === 'development'
						? 'http://localhost:5328/api/:path*'
						: '/api/',
			},
		];
	},
};

module.exports = nextConfig;
