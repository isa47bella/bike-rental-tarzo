self.addEventListener('push', function (e) {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Bike Rental Tarzo', {
      body:  data.body  || 'Nuova attività',
      icon:  '/favicon.ico',
      badge: '/favicon.ico',
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
