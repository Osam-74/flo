const CACHE_NAME = 'cashbook-v12';

// Detect base path from the SW's own location at runtime.
// On GitHub Pages:  self.location = https://osam-74.github.io/flo/sw.js  → BASE = '/flo'
// On Vercel:        self.location = https://yourapp.vercel.app/sw.js      → BASE = ''
const swPath = self.location.pathname; // e.g. '/flo/sw.js' or '/sw.js'
const BASE = swPath.replace(/\/sw\.js$/, ''); // e.g. '/flo' or ''

const PRECACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
].filter((v, i, a) => a.indexOf(v) === i); // dedupe (in case BASE is empty, '/' appears once)

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
    return;
  }

  if (event.request.method !== 'GET') return;

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
