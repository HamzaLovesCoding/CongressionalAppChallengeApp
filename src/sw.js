// Template: vite.config.ts fills in the version and file list at build time.
const CACHE = 'amber-__CACHE_VERSION__';
const PRECACHE = __PRECACHE__;
// Watched lesson videos, written by the feed page (VIDEO_CACHE in src/feed/feed.ts). It outlives
// builds so a new deploy doesn't throw away clips a learner already downloaded. Rename it only when
// the files themselves change: the old cache (here, the pre-H.264 'amber-videos') is then deleted on activate.
const VIDEO_CACHE = 'amber-videos-h264';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

// No automatic skipWaiting: an open tab on the old build may still lazy-load old shader chunks.
// A new build takes over once every old tab is closed, or when a freshly launched page asks for it
// before anything has lazy-loaded (see the registration in main.ts).
// waitUntil keeps this worker alive until Chrome has acted on the request; it may otherwise stop the idle
// worker first and drop it.
self.addEventListener('message', (event) => { if (event.data === 'skip-waiting') event.waitUntil(self.skipWaiting()); });

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('amber-') && key !== CACHE && key !== VIDEO_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Media elements ask for byte ranges (Safari won't play without them), so a cached clip is sliced
// to the requested range. Uncached clips stream from the network untouched.
async function videoResponse(request) {
  const cached = await caches.open(VIDEO_CACHE).then((cache) => cache.match(request.url, { ignoreSearch: true, ignoreVary: true }));
  if (!cached) return fetch(request);
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (!range) return cached;
  const blob = await cached.blob();
  const start = range[1] ? Number(range[1]) : Math.max(0, blob.size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), blob.size - 1) : blob.size - 1;
  if (start >= blob.size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') ?? 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${blob.size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/videos/')) { event.respondWith(videoResponse(request)); return; }
  // Hosts often send Vary: Origin, and module scripts are CORS requests carrying an
  // Origin header the precache entries lack, so a Vary-aware lookup misses offline.
  if (request.mode === 'navigate') {
    // ignoreSearch keeps ?perf=1 working offline.
    event.respondWith(caches.match('./', { ignoreSearch: true, ignoreVary: true }).then((hit) => hit ?? fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { ignoreVary: true }).then((hit) => hit ?? fetch(request)));
});
