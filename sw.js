// 9M2PJU Line-of-Sight Map - Service Worker
const CACHE_NAME = 'los-map-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/index.js',
  '/favicon.png',
  '/manifest.json'
];

// External CDN assets to cache
const CDN_ASSETS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://code.highcharts.com/highcharts.js',
  'https://code.jquery.com/jquery-3.7.1.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // For API calls (elevation, geocoding), always use network
  if (url.hostname.includes('open-elevation') || 
      url.hostname.includes('nominatim') ||
      url.hostname.includes('arcgisonline')) {
    event.respondWith(fetch(request));
    return;
  }

  // For static assets and CDN, use cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        // Cache successful responses for CDN assets
        if (networkResponse.ok && CDN_ASSETS.some(asset => request.url.includes(asset))) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Return offline fallback if available
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
