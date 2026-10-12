// Minimal service worker. Android needs one before it offers "Install app".
// It does not cache anything, so users always get the latest version.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// Push notifications: show the message, and open the app when it is tapped.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Legendary Pay', {
    body: d.body || '',
    icon: 'logo-512.jpg',
    badge: 'logo-512.jpg',
    data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow((e.notification.data && e.notification.data.url) || '/'));
});
