const CACHE_NAME = 'flohq-v13';

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
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Delete ALL old caches — no RELOAD_PAGE broadcast (caused infinite loop)
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Pass through non-GET, Firebase, Google, fonts
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

  // JS / CSS / module assets: NETWORK ONLY when online.
  const isAsset = /\.(js|mjs|css)($|\?)/.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request)
          .then(c => c || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // HTML navigation: network-first, cache fallback for offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached ||
              caches.match(BASE + '/index.html') ||
              caches.match(BASE + '/')
            )
        )
    );
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
