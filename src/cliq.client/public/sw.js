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
    // Skip waiting to activate immediately
    self.skipWaiting();
/*
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
*/
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    // Take control of all pages immediately
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Handle push notifications for traditional Web Push (non-Declarative)
// This is needed for Chrome, Firefox, Edge, Android browsers, etc.
// 
// For Safari/WebKit with Declarative Web Push support:
// - Safari will dispatch the push event to the SW
// - If we call showNotification(), it replaces the declarative notification
// - If we don't call showNotification(), Safari uses the declarative payload as fallback
// 
// Strategy: Check if window.pushManager exists (Declarative Web Push indicator).
// Since we can't check that from a SW, we use a different approach:
// We always show the notification for browsers that need it (Chrome, Firefox, etc.)
// Safari users are NOT expected to have this SW process their notifications.
// 
// We detect Safari by checking if the push event has a "proposedNotification" property
// (available in Declarative Web Push spec) or by user agent (less reliable).
self.addEventListener('push', (event) => {
    console.log('Push event received:', event);

    // Check if this browser supports Declarative Web Push by checking for proposedNotification
    // This is part of the Declarative Web Push spec - if present, browser handles it natively
    if (event.proposedNotification) {
        console.log('Declarative Web Push detected (proposedNotification present), letting browser handle natively');
        // Don't call showNotification - browser will use the declarative payload
        return;
    }

    let data = {};
    
    if (event.data) {
        try {
            data = event.data.json();
            console.log('Push data:', data);
        } catch (e) {
            console.error('Error parsing push data:', e);
            data = { notification: { title: 'Frens', body: event.data.text() } };
        }
    }

    // For traditional push browsers (Chrome, Firefox, Edge, Android), 
    // we need to display the notification ourselves.
    // The payload uses Declarative Web Push format which we parse here.
    const notification = data.notification || data;
    
    const title = notification.title || 'Frens';
    const options = {
        body: notification.body || '',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            url: notification.navigate || notification.url || '/',
            timestamp: Date.now()
        },
        requireInteraction: false,
        tag: notification.tag || 'frens-notification'
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.focus();
                        // Navigate to the URL if it's different
                        if (urlToOpen && urlToOpen !== '/') {
                            client.navigate(urlToOpen);
                        }
                        return;
                    }
                }
                // If no window is open, open a new one
                if (self.clients.openWindow) {
                    return self.clients.openWindow(urlToOpen);
                }
            })
    );
});

// Handle notification close (for analytics if needed)
self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed:', event);
});