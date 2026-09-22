// These placeholders are replaced by the Vite build plugin.
const VERSION = "30d8b327445fa4b5";
const FILES = ["./assets/SongDetail-CaUSI8yL.js","./assets/index-CGqlfwHC.css","./assets/index-DOK73kB7.js","./icon.svg","./index.html","./manifest.webmanifest","./tunes/devils-dream.abc","./tunes/index.json","./tunes/julia-delaneys-reel.abc","./tunes/kesh-jig.abc","./tunes/old-hag-at-the-churn.abc","./tunes/red-haired-boy.abc","./tunes/sailors-hornpipe.abc"];
const SCOPE = new URL(self.registration.scope);
const PREFIX = `mtunebook:${SCOPE.pathname}:`;
const CACHE = PREFIX + VERSION;
const PRECACHE = FILES.map((file) => new URL(file, SCOPE).href);
const INDEX = new URL('index.html', SCOPE).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  // Activate updates after old tabs close so their HTML and chunks stay consistent.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const local = url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
  const soundfont = url.origin === 'https://paulrosen.github.io' && url.pathname.startsWith('/midi-js-soundfonts/');
  if (!local && !soundfont) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = local && event.request.mode === 'navigate' ? INDEX : event.request;
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) {
      // Await writes so the worker cannot be suspended before offline data is saved.
      try { await cache.put(key, response.clone()); } catch { /* Online use still works if storage is full. */ }
    }
    return response;
  })());
});
