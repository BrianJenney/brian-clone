/** @type {import('next').NextConfig} */
const nextConfig = {
  // The video renderer shells out to a static FFmpeg build and reads fonts and
  // the format library from disk; make sure Vercel bundles them with the
  // functions that need them.
  outputFileTracingIncludes: {
    "/api/inngest": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./video/assets/fonts/**",
      "./data/video/**",
    ],
    "/api/mcp": ["./data/video/**"],
  },
  rewrites: async () => {
    const metadata = [
      ["oauth-authorization-server", "authorization-server"],
      ["oauth-protected-resource", "protected-resource"],
    ];
    return {
      // OAuth discovery lives at fixed /.well-known paths (RFC 8414 / 9728).
      beforeFiles: metadata.flatMap(([wk, route]) => [
        {
          source: `/.well-known/${wk}`,
          destination: `/api/oauth/metadata/${route}`,
        },
        {
          source: `/.well-known/${wk}/:path*`,
          destination: `/api/oauth/metadata/${route}`,
        },
      ]),
      afterFiles: [
        {
          source: "/api/:path*",
          destination:
            process.env.NODE_ENV === "development"
              ? "http://127.0.0.1:5328/:path*"
              : "/api/:path*",
        },
      ],
    };
  },
};

module.exports = nextConfig;
