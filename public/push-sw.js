/* eslint-disable no-undef */
/**
 * Manejadores de push. Se inyecta en el service worker que genera
 * vite-plugin-pwa (modo generateSW) via workbox.importScripts, porque en ese
 * modo el SW se regenera en cada build y no se puede editar a mano.
 */

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    // Un payload que no sea JSON igual merece mostrarse en vez de perderse.
    data = { title: 'Juntos+1', body: event.data ? event.data.text() : '' };
  }

  var title = data.title || 'Juntos+1';
  var options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    // El mismo tag reemplaza el aviso anterior en vez de apilar duplicados
    // cuando el resumen se reenvia.
    tag: data.tag || 'juntos',
    renotify: true,
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (list) {
        // Reusar una pestania ya abierta evita dejarle al usuario dos copias
        // de la app compitiendo por el mismo estado.
        for (var i = 0; i < list.length; i++) {
          var client = list[i];
          if ('focus' in client) {
            if ('navigate' in client) client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

/**
 * Los clientes que ya venian de la version anterior tienen un "api-cache" con
 * respuestas de /api/data guardadas. Ya nadie lo lee, pero conviene borrarlo:
 * mientras exista, ocupa espacio y confunde al depurar.
 */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n === 'api-cache'; })
             .map(function (n) { return caches.delete(n); })
      );
    })
  );
});
