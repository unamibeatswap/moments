const CACHE_NAME = 'moments-admin-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/admin/analytics',
  '/admin/moments',
  '/admin/sponsors',
  '/admin/settings'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('PWA: Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          console.log('PWA: Serving from cache:', event.request.url);
          return response;
        }
        console.log('PWA: Fetching from network:', event.request.url);
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('PWA: Service worker activated');
});