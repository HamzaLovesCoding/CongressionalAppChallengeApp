// Template: vite.config.ts fills in the version and file list at build time.
const CACHE = 'amber-__CACHE_VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

// No skipWaiting: an open tab on the old build may still lazy-load old shader chunks,
// so the new cache only takes over once every old tab is closed.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('amber-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // Hosts often send Vary: Origin, and module scripts are CORS requests carrying an
  // Origin header the precache entries lack, so a Vary-aware lookup misses offline.
  if (request.mode === 'navigate') {
    // ignoreSearch keeps ?perf=1 working offline.
    event.respondWith(caches.match('./', { ignoreSearch: true, ignoreVary: true }).then((hit) => hit ?? fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { ignoreVary: true }).then((hit) => hit ?? fetch(request)));
});
