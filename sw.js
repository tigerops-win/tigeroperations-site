const CACHE_PREFIX = 'tiger-operations-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/builds.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/maskable-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    ))
  );
});

async function cacheResponse(cache, request, response) {
  if (response.ok && response.type === 'basic') {
    // Storage failures must not prevent a successful network response.
    await cache.put(request, response.clone()).catch(() => {});
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    await cacheResponse(cache, request, response);
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Query strings do not change these static pages' offline content.
    const url = new URL(request.url);
    if (['/', '/index.html', '/builds.html'].includes(url.pathname)) {
      const page = await cache.match(url.pathname);
      if (page) return page;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await cacheResponse(cache, request, response);
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  const staticDestinations = ['style', 'script', 'image', 'font', 'manifest'];
  if (url.pathname !== '/sw.js' && (
    staticDestinations.includes(request.destination) ||
    PRECACHE_URLS.slice(3).includes(url.pathname)
  )) {
    event.respondWith(cacheFirst(request));
  }
});
