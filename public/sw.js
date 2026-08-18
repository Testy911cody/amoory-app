/* Talk Board service worker — makes the app work offline.
   Bump CACHE_VERSION whenever app files change so users get the update. */
const CACHE_VERSION = "talkboard-v35";
const SHELL_URL = "./index.html";
const SUPABASE_ESM =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";
const CORE_ASSETS = [
  "./index.html",
  "./promo.html",
  "./admin.html",
  "./privacy.html",
  "./src/admin-api.js",
  "./src/admin.js",
  "./src/app.js",
  "./src/audio-loader.js",
  "./src/community.js",
  "./src/config.js",
  "./src/data.js",
  "./src/dialect-fallback.js",
  "./src/features/auth-ui.js",
  "./src/features/recording.js",
  "./src/global.js",
  "./src/idb-evict.js",
  "./src/idb.js",
  "./src/kid-ui.js",
  "./src/locales.js",
  "./src/moderation.js",
  "./src/native.js",
  "./src/personal.js",
  "./src/priorities.js",
  "./src/supabase.js",
  "./src/tts.js",
  "./src/usage.js",
  "./src/styles.css",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm"
];

function networkFetch(req) {
  return fetch(new Request(req, { redirect: "follow" }));
}

function isHttpUrl(url) {
  return url.protocol === "http:" || url.protocol === "https:";
}

function isCacheableRequest(req) {
  try {
    return isHttpUrl(new URL(req.url));
  } catch {
    return false;
  }
}

function isCacheable(res) {
  return res && res.ok && res.type === "basic";
}

function isNavigation(req) {
  return req.mode === "navigate" || req.destination === "document";
}

function isAppShell(url, req) {
  if (isNavigation(req)) return true;
  if (url.pathname.includes("/src/") && url.pathname.endsWith(".js")) return true;
  if (url.pathname.endsWith(".css")) return true;
  if (url.pathname.endsWith("/manifest.json")) return true;
  if (url.pathname.includes("/icons/")) return true;
  return false;
}

function isRemoteApi(url) {
  return (
    url.hostname.endsWith(".supabase.co") ||
    url.hostname === "cdn.jsdelivr.net"
  );
}

function shouldBypassSW(url) {
  return url.hostname === "static.cloudflareinsights.com";
}

function safeCachePut(cache, req, res) {
  if (!isCacheable(res) || !isCacheableRequest(req)) return;
  try {
    cache.put(req, res);
  } catch {
    /* ignore unsupported schemes / opaque responses */
  }
}

function offlineResponse() {
  return new Response("Offline", { status: 503, statusText: "Offline" });
}

/** Return cached shell immediately; refresh in background when online. */
function staleWhileRevalidate(req, cacheKey) {
  const key = cacheKey || req;
  return caches.open(CACHE_VERSION).then(async (cache) => {
    const cached = await cache.match(key);
    const refresh = networkFetch(req)
      .then((res) => {
        if (isCacheable(res)) safeCachePut(cache, key, res.clone());
        return res;
      })
      .catch(() => null);
    if (cached && cached.ok) {
      refresh.catch(() => {});
      return cached;
    }
    const fresh = await refresh;
    return fresh || cached || offlineResponse();
  });
}

/** Network-first for API/CDN; fall back to cache when offline. */
function networkFirstWithCache(req) {
  return caches.open(CACHE_VERSION).then((cache) =>
    networkFetch(req)
      .then((res) => {
        if (isCacheable(res)) safeCachePut(cache, req, res.clone());
        return res;
      })
      .catch(() => cache.match(req).then((r) => r || offlineResponse()))
  );
}

// Install: pre-cache the core app shell (never cache "./" — it may be a redirect)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await Promise.allSettled(
        CORE_ASSETS.map((url) =>
          networkFetch(url).then((res) => {
            if (isCacheable(res)) return safeCachePut(cache, url, res);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - App shell (HTML, JS, CSS, icons): stale-while-revalidate
// - Supabase API + CDN modules: network-first with cache fallback
// - Other same-origin assets: cache-first
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (!isHttpUrl(url)) return;
  if (shouldBypassSW(url)) return;

  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin && isNavigation(req)) {
    if (url.pathname.endsWith("/index.html")) return;

    event.respondWith(
      staleWhileRevalidate(req, SHELL_URL)
    );
    return;
  }

  if (isSameOrigin && isAppShell(url, req)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if (!isSameOrigin && isRemoteApi(url)) {
    event.respondWith(networkFirstWithCache(req));
    return;
  }

  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached && cached.ok) return cached;
        return networkFetch(req).then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => safeCachePut(c, req, copy));
          }
          return res;
        });
      }).catch(() => offlineResponse())
    );
    return;
  }

  event.respondWith(networkFirstWithCache(req));
});
