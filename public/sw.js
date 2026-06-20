const CACHE_NAME = 'flohq-v8';

const swPath = self.location.pathname;
const BASE = swPath.replace(/\/sw\.js$/, '');

// Resources to precache (minimal — just navigation shells)
const PRECACHE = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
].filter((v, i, a) => a.indexOf(v) === i);

// ── Install: cache shells, skip waiting immediately ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {})) // non-fatal
      .then(() => self.skipWaiting()) // take over immediately without waiting
  );
});

// ── Activate: delete ALL old caches, claim all clients, force reload ──────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // take control of all open tabs
      .then(() => {
        // Tell all existing clients to reload so they get fresh JS/CSS
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'RELOAD_PAGE' });
          });
        });
      })
  );
});

// ── Fetch: smart strategy per resource type ───────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept: non-GET, Firebase/Google APIs, Chrome extensions
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('paystack') ||
    url.protocol === 'chrome-extension:'
  ) {
    return; // pass through to network
  }

  // JS / CSS / module assets: NETWORK ONLY (never cache — ensures deploys are instant)
  if (/\.(js|mjs|css)($|\?)/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then(c => c || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  // HTML navigation: STRICT network-first — never serve stale HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            // Only cache if the response is actually HTML (not a JS blob)
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('text/html')) {
              caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
            }
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => {
              if (cached) return cached;
              // Last resort: return a minimal page that reloads when back online
              return new Response(
                '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FloHQ</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#F0F2F7;color:#1A1D2E}div{text-align:center}p{color:#9A9FB8}</style></head><body><div><h2>You are offline</h2><p>Reconnecting…</p></div><script>setTimeout(()=>location.reload(),3000)</script></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
            })
        )
    );
    return;
  }

  // Images and other static assets: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response.ok && response.type !== 'opaque') {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached || new Response('Offline', { status: 503 }));
        return cached || networkFetch;
      })
    )
  );
});

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
