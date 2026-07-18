const CACHE_NAME = 'tfas-v1'; // Incremented key to invalidate any stale browser/service-worker caches immediately
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => console.log('[PWA] Precaching failed during install:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[PWA] Removing stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
  console.log('[PWA] Service Worker Activated - Version:', CACHE_NAME);
});

self.addEventListener('fetch', (e) => {
  // Only target http/https requests
  if (!e.request.url.startsWith('http')) return;

  // Let browser handle Supabase database API requests directly without caching
  if (e.request.url.includes('supabase.co') || e.request.url.includes('/api/')) {
    return;
  }

  // Network-First Strategy: Try modern network fetch first. If offline, fallback to cached resources.
  // This guarantees index.html is always up-to-date online (having the correct asset hash references).
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // If fetch is successful, cache a copy of the asset for future offline access
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache when the user is completely offline
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no match and it is a navigation page, fall back to index.html
          if (e.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});


