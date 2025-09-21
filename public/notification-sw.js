self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification?.data?.url;
  if (!rawUrl) {
    return;
  }

  let target;
  try {
    target = new URL(rawUrl, self.location.origin);
  } catch {
    target = null;
  }

  if (!target) {
    return;
  }

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of windowClients) {
        try {
          const clientUrl = new URL(client.url);
          const sameOrigin = clientUrl.origin === target.origin;
          const pathMatches = clientUrl.pathname.startsWith(target.pathname);

          if (sameOrigin && pathMatches) {
            await client.focus();
            try {
              if ('navigate' in client) {
                await client.navigate(target.href);
              }
            } catch (navigateError) {
              console.warn('[NotificationSW] navigate failed', navigateError);
            }
            return;
          }
        } catch {
          // Ignore parse errors for non-standard URLs
        }
      }

      await self.clients.openWindow(target.href);
    })(),
  );
});
