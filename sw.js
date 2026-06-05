const CACHE_NAME = 'cashbook-v10';
const BASE = '/flo';

const PRECACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Firebase, Google APIs, extensions
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('google') ||
    url.hostname.includes('fonts.') ||
    url.protocol === 'chrome-extension:'
  ) {
    return; // Let the browser handle it natively
  }

  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;

          // For navigation requests, serve index.html so the SPA can handle routing
          if (event.request.mode === 'navigate') {
            return caches.match(BASE + '/index.html')
              .then(html => html || caches.match(BASE + '/'))
              .then(html => html || new Response(
                '<!DOCTYPE html><html><body><p>You are offline. Please reconnect.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              ));
          }

          // For other resources, return a safe empty 503 response (never undefined)
          return new Response('Offline — resource unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
