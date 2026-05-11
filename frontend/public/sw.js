const CACHE = 'bike-rental-v1';

// Required by Chrome for PWA installability
self.addEventListener('fetch', function (e) {
  // Network-first: serve fresh, fall back to cache for same-origin GET requests
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache static assets only
        if (res.ok && e.request.destination !== 'document') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', function (e) {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Bike Rental Tarzo', {
      body:  data.body  || 'Nuova attività',
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      data:  { url: data.url || '/admin' },
    })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(wins => {
    for (const win of wins) {
      if (win.url.includes('/admin') && 'focus' in win) return win.focus();
    }
    if (clients.openWindow) return clients.openWindow('/admin');
  }));
});
