/* Talk Board service worker — makes the app work offline.
   Bump CACHE_VERSION whenever app files change so users get the update. */
const CACHE_VERSION = "talkboard-v12";
const SHELL_URL = "./index.html";
const CORE_ASSETS = [
  SHELL_URL,
  "./privacy.html",
  "./src/app.js",
  "./src/data.js",
  "./src/config.js",
  "./src/supabase.js",
  "./src/locales.js",
  "./src/tts.js",
  "./src/community.js",
  "./src/personal.js",
  "./src/moderation.js",
  "./src/native.js",
  "./src/idb.js",
  "./src/priorities.js",
  "./src/usage.js",
  "./src/kid-ui.js",
  "./src/styles.css",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
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

function isAppScript(url) {
  return url.pathname.includes("/src/") && url.pathname.endsWith(".js");
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
// - HTML navigation: network-first (host may rewrite/redirect amoory paths)
// - App JS modules: network-first (avoid stale broken bundles after deploy)
// - Other same-origin assets: cache-first
// - Remote: network-first with cache fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Skip extension/custom schemes — caching them throws in Chrome.
  if (!isHttpUrl(url)) return;

  // Let analytics beacons go straight to the network (no SW intercept).
  if (shouldBypassSW(url)) return;

  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin && isNavigation(req)) {
    // Let the browser handle /index.html → trailing-slash redirects from the host.
    if (url.pathname.endsWith("/index.html")) return;

    event.respondWith(
      networkFetch(req)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => safeCachePut(c, SHELL_URL, copy));
          }
          return res;
        })
        .catch(() => caches.match(SHELL_URL).then((r) => r || offlineResponse()))
    );
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

  event.respondWith(
    networkFetch(req)
      .then((res) => {
        if (isCacheable(res)) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => safeCachePut(c, req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || offlineResponse()))
  );
});
