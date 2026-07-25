/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
  async rewrites() {
    // Optional reverse-proxy of /backend/* to the FastAPI server (handy in dev).
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      { source: "/backend/:path*", destination: `${apiUrl}/:path*` },
    ];
  },
};

export default nextConfig;
