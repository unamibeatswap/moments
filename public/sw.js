const CACHE_NAME = 'unami-moments-v1';
const STATIC_ASSETS = [
  '/login.html',
  '/admin-dashboard.html',
  '/moments/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.ico',
  '/offline.html'
];

const API_CACHE_NAME = 'unami-api-v1';
const API_ENDPOINTS = [
  '/admin/moments',
  '/admin/analytics',
  '/admin/sponsors'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS.filter(asset => asset !== '/'));
      }),
      caches.open(API_CACHE_NAME)
    ])
  );
  self.skipWaiting();
});

// Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.startsWith('unami-')).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Fetch handler with improved caching strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-HTTP requests (chrome-extension, etc.)
  if (!req.url.startsWith('http')) {
    return;
  }

  // Skip non-GET requests and requests with auth headers
  if (req.method !== 'GET' || req.headers.get('authorization')) {
    return event.respondWith(
      fetch(req).catch(() => {
        if (req.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return new Response('Offline', { status: 503 });
      })
    );
  }

  // Handle navigation requests (HTML pages)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      // Try network first for fresh content
      fetch(req)
        .then(response => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(req, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache, then offline page
          return caches.match(req)
            .then(cached => cached || caches.match('/offline.html'));
        })
    );
    return;
  }

  // Handle API requests with cache-first strategy for better offline experience
  if (API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint))) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(cache => {
        return cache.match(req).then(cached => {
          // Return cached version immediately if available
          if (cached) {
            // Update cache in background
            fetch(req).then(response => {
              if (response.ok) {
                cache.put(req, response.clone());
              }
            }).catch(() => {});
            return cached;
          }
          
          // No cache, try network
          return fetch(req).then(response => {
            if (response.ok) {
              cache.put(req, response.clone());
            }
            return response;
          }).catch(() => {
            // Return empty data structure for API failures
            return new Response(JSON.stringify({ data: [] }), {
              headers: { 'Content-Type': 'application/json' },
              status: 200
            });
          });
        });
      })
    );
    return;
  }

  // Handle static assets with stale-while-revalidate
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.match(/\.(css|js|png|jpg|svg|ico)$/)) {
    // Skip chrome-extension and other unsupported schemes
    if (!req.url.startsWith('http')) {
      return;
    }
    
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(req).then(cached => {
          const fetchPromise = fetch(req).then(response => {
            if (response.ok && req.url.startsWith('http')) {
              cache.put(req, response.clone()).catch(() => {});
            }
            return response;
          }).catch(() => null);
          
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Handle background sync for offline actions (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle queued actions when back online
      console.log('Background sync triggered')
    );
  }
});

// Handle push notifications (future enhancement)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'unami-moment',
      requireInteraction: false,
      actions: [
        {
          action: 'view',
          title: 'View Moment'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'New Moment', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/moments')
    );
  }
});