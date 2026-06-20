/* Talk Board service worker — makes the app work offline.
   Bump CACHE_VERSION whenever app files change so users get the update. */
const CACHE_VERSION = "talkboard-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./src/app.js",
  "./src/data.js",
  "./src/config.js",
  "./src/supabase.js",
  "./src/locales.js",
  "./src/tts.js",
  "./src/community.js",
  "./src/styles.css",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Install: pre-cache the core app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
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
// - App shell + same-origin files: cache-first (instant, offline-safe)
// - Supabase / network calls: network-first, fall back to cache if offline
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetchAndCache(req))
    );
  } else {
    // remote (e.g. recordings/pictures): try network, cache the result, fall back to cache
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});

function fetchAndCache(req) {
  return fetch(req).then((res) => {
    const copy = res.clone();
    caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
    return res;
  });
}
