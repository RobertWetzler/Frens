const CACHE_NAME = 'frens-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    // Activate immediately — don't wait for old SW to release
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    // Take control of all open clients immediately
    event.waitUntil(self.clients.claim());
});

// Network-first fetch handler. Navigation requests (HTML pages) always go to
// the network so that deep-link URLs like /post/:id are served the real SPA
// index.html by the server, not a stale cache entry.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    // Always go to network for page navigations (deep links, refreshes, etc.)
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// Handle incoming push messages.
// For DWP (Declarative Web Push) browsers like Safari, the declarative payload
// is used as a fallback if this handler fails. By explicitly showing the
// notification here we also support non-DWP browsers (Chrome, Firefox, etc.).
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const notif = payload.notification;
    if (notif?.title) {
      const deepLink = notif.navigate || notif.data?.url || '/';
      event.waitUntil(
        self.registration.showNotification(notif.title, {
          body: notif.body || '',
          data: { url: deepLink },
        })
      );
    }
  } catch (e) {
    console.warn('Failed to parse push payload in SW, DWP fallback will handle it.', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const navigateTarget = event.notification?.data?.url || '/';
  let destination;
  try {
    destination = new URL(navigateTarget, self.location.origin).href;
  } catch (error) {
    destination = self.location.origin;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If an existing window is open, post a message so the React app can
      // navigate in-app (client.navigate reloads the page and loses state).
      for (const client of clientList) {
        if (client.url && client.visibilityState === 'visible') {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: navigateTarget });
          return client.focus();
        }
      }
      // No visible window — open a fresh one at the deep link URL
      return self.clients.openWindow(destination);
    })
  );
});
