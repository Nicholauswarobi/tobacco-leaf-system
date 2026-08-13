/*
 * TobaccoScan service worker.
 *
 * Two jobs: make the app installable, and keep it usable when the phone drops
 * off the network — which in the field is most of the time.
 *
 * What is deliberately NOT cached:
 *
 *   • Anything that is not a GET. A prediction is a POST of a photo; replaying
 *     one from cache would show a farmer last week's diagnosis for this week's
 *     leaf.
 *   • `/api/*` on the backend origin. History, health and stats must be live —
 *     a stale grade or a stale "model loaded" flag is worse than an error.
 *
 * What is cached: the pages actually visited, the build's static chunks, the
 * icons, and uploaded leaf photos (whose URLs are unique per prediction and
 * never change, so they can never go stale).
 *
 * Bump CACHE_VERSION to retire every old cache on the next activation.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `tobaccoscan-shell-${CACHE_VERSION}`;
const PAGE_CACHE = `tobaccoscan-pages-${CACHE_VERSION}`;
const ASSET_CACHE = `tobaccoscan-assets-${CACHE_VERSION}`;
const IMAGE_CACHE = `tobaccoscan-images-${CACHE_VERSION}`;

const CURRENT_CACHES = [SHELL_CACHE, PAGE_CACHE, ASSET_CACHE, IMAGE_CACHE];

const OFFLINE_URL = "/offline";

/*
 * Only the offline fallback and the icons are precached.
 *
 * Precaching the real pages would be a trap: a page's HTML references
 * content-hashed JS chunks from the build that produced it, and those chunks
 * are not in the cache until something fetches them. Storing the HTML alone
 * yields a page that loads offline and then hangs with no interactivity.
 * Runtime caching stores each page together with the chunks it pulled in.
 */
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

/** How long to wait for the network on a page load before serving the cache. */
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One failed URL must not fail the whole install, or a single typo
      // leaves the app with no service worker at all.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      );
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("tobaccoscan-") && !CURRENT_CACHES.includes(name)
          )
          .map((name) => caches.delete(name))
      );

      // Serve navigations from the cache before the network where the browser
      // supports it, which cuts the blank-screen time on a slow connection.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }

      await self.clients.claim();
    })()
  );
});

/** The page asks for this once the user accepts an update. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch anything that can change server state.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Chrome extensions and the like.
  if (!url.protocol.startsWith("http")) return;

  const sameOrigin = url.origin === self.location.origin;

  // The backend is normally reached through the same-origin `/backend/*`
  // proxy, so "same origin" is no longer enough to mean "safe to cache". These
  // two checks must come before any of the same-origin handling below.
  const isApi =
    url.pathname.startsWith("/api/") || url.pathname.startsWith("/backend/api/");

  // Uploaded leaf photos, whether proxied or fetched from the backend origin
  // directly. Their filenames are per-prediction and immutable, so a cache hit
  // is always correct — this is what lets history and results render offline.
  const isUpload =
    url.pathname.startsWith("/uploads/") ||
    url.pathname.startsWith("/backend/uploads/");

  // History, health and stats must always be live. A stale grade, or a stale
  // "model loaded" flag, is worse than an error.
  if (isApi) return;

  if (isUpload) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Anything else on another origin is left entirely alone.
  if (!sameOrigin) return;

  // React Server Component payloads for client-side navigation. They are
  // versioned against the running build; serving a stale one produces a
  // hydration mismatch rather than a helpful offline page.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Content-hashed build output and the icons: the URL changes whenever the
  // bytes do, so the cached copy can be trusted indefinitely.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (request.destination === "image" || request.destination === "font") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
});

/**
 * Pages: network first, because a diagnosis app showing yesterday's page is a
 * bug. The cache is the safety net, and the offline page is the last resort.
 */
async function handleNavigation(event) {
  const { request } = event;

  try {
    const preload = await event.preloadResponse;
    if (preload) {
      void putInCache(PAGE_CACHE, request, preload.clone());
      return preload;
    }

    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    if (response && response.ok) {
      void putInCache(PAGE_CACHE, request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    return new Response(
      "<h1>Offline</h1><p>TobaccoScan needs a connection to load this page.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      void putInCache(cacheName, request, response.clone());
    }
    return response;
  } catch (err) {
    // A missing image offline is not worth an unhandled rejection in the
    // console; hand back a clean failure instead.
    return Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        void putInCache(cacheName, request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  const fresh = cached ? undefined : await network;
  return cached || fresh || Response.error();
}

async function putInCache(cacheName, request, response) {
  // Range responses cannot be stored, and a redirect stored against the
  // original URL would loop.
  if (response.status !== 200 || response.type === "opaqueredirect") return;

  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch {
    /* quota exceeded or an unstorable response — not worth failing over */
  }
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
