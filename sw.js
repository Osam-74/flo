const CACHE_NAME = 'cashbook-v13';

const swPath = self.location.pathname;
const BASE = swPath.replace(/\/sw\.js$/, '');

const PRECACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
].filter((v, i, a) => a.indexOf(v) === i);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())   // activate immediately, don't wait
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // take over all existing tabs
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and external requests
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('google') ||
    url.hostname.includes('fonts.') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // JS and CSS assets: NETWORK-FIRST so new deployments always load fresh.
  // Only fall back to cache when fully offline.
  const isAsset = url.pathname.match(/\.(js|css|mjs)$/i);
  if (isAsset) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached =>
          cached || new Response('Offline — asset unavailable', { status: 503 })
        ))
    );
    return;
  }

  // Everything else: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match(BASE + '/index.html')
              .then(html => html || caches.match(BASE + '/'))
              .then(html => html || new Response(
                '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem"><h2>You are offline</h2><p>Please reconnect and reload.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              ));
          }
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
