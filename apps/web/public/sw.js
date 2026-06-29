/**
 * Abhaya Service Worker
 * Strategy: network-first for API calls, cache-first for static assets.
 * Critical: never cache SOS API calls — they must always go to the network.
 */

const CACHE_NAME = 'abhaya-v2';
const STATIC_ASSETS = [
  '/',
  '/sos/active',
  '/sos/history',
  '/witness/alert',
  '/evidence',
  '/safe-places',
  '/contacts',
  '/trip',
  '/settings',
];

// ── Install: pre-cache shell routes ──────────────────────────────────────────

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {
        // Non-fatal — cache warming is best-effort
      }),
    ),
  );
});

// ── Activate: prune old caches ────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always go network-first (and never cache) for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(request));
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, images)
  if (
    url.pathname.match(/\.(js|css|woff2?|png|svg|ico|webp|avif)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-first with cache fallback for navigation (HTML)
  event.respondWith(networkFirstWithFallback(request));
});

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'Abhaya', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Abhaya alert', {
      body:    payload.body ?? 'Someone nearby may need help.',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      tag:     payload.tag ?? 'abhaya-alert',
      renotify: true,
      data:    payload,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/witness/alert';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        if ('navigate' in existing) return existing.navigate(target).then((client) => client.focus());
        return existing.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

// ── Strategy helpers ──────────────────────────────────────────────────────────

async function networkOnly(request) {
  return fetch(request);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Offline fallback: return root shell
    const root = await caches.match('/');
    return root ?? new Response('Abhaya is offline. Open the app to continue.', {
      headers: { 'Content-Type': 'text/plain' },
      status: 503,
    });
  }
}
