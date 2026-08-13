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
    // Reverse-proxy /backend/* to the FastAPI server. This is the default path
    // for every API call (see src/lib/api.ts), not a convenience.
    //
    // BACKEND_ORIGIN is resolved *here*, in the Next.js server process on the
    // developer's machine — so `localhost:8000` is correct and stays correct
    // no matter how the browser reached the site. That is the whole point:
    // a phone on ngrok has no localhost:8000 of its own to talk to.
    //
    // It is deliberately not NEXT_PUBLIC_*: this value must never be inlined
    // into the browser bundle, because the browser cannot use it.
    const backendOrigin = (
      process.env.BACKEND_ORIGIN || "http://localhost:8000"
    ).replace(/\/+$/, "");

    return [
      { source: "/backend/:path*", destination: `${backendOrigin}/:path*` },
    ];
  },
  async headers() {
    return [
      {
        // The service worker must never be served from cache: a stale copy
        // pins the app to an old build that it then keeps serving offline,
        // and nothing short of clearing site data recovers it.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
};

export default nextConfig;
