/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// ── Core SW setup ────────────────────────────────────────────
self.skipWaiting();
clientsClaim();

// ── Precache all static assets injected by vite-plugin-pwa ──
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Runtime Caching ──────────────────────────────────────────

// App shell navigation
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  })
);

// Google Fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Supabase API — always try network first
registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  })
);

// Images
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// JS / CSS
registerRoute(
  /\.(?:js|css)$/i,
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  })
);

// ── Push Notification Handler ────────────────────────────────
// Triggered when the Supabase edge function sends a web push.
// Payload JSON shape: { title, body, icon?, badge?, url?, tag? }
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let data: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
    event_type?: string;
  };

  try {
    data = event.data.json();
  } catch {
    // Fallback for plain-text payloads
    data = { title: 'Water Alert', body: event.data.text() };
  }

  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/favicon-32.png',
    tag: data.tag || 'water-alert',
    renotify: true,
    // Store the target URL so notificationclick can open it
    data: { url: data.url || '/' },
    vibrate: [150, 75, 150, 75, 150],
    // Show on Android lock-screen / notification drawer too
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification Click Handler ───────────────────────────────
// Focuses an existing app window or opens a new one.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl: string = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an already-open window on the same origin
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
