/* global workbox */
// Einziger Service Worker der App (Scope „/“): Offline-Sync, statische Assets,
// Offline-Seite und Klicks auf Benachrichtigungen. `notification-sw.js` lädt nur diese Datei.
const WORKBOX_VERSION = "7.4.1";
const OFFLINE_URL = "/offline.html";
const OFFLINE_CACHE = "offline-page-v1";

try {
  importScripts(`./workbox/workbox-v${WORKBOX_VERSION}/workbox-sw.js`);
} catch (error) {
  console.warn("[ServiceWorker] Workbox library could not be loaded.", error);
}

if (typeof workbox !== "undefined") {
  workbox.setConfig({ modulePathPrefix: `./workbox/workbox-v${WORKBOX_VERSION}` });
  const { precaching, routing, strategies, backgroundSync, core } = workbox;

  const OFFLINE_QUEUE_NAME = "offline-events";
  const OFFLINE_SYNC_TAG = `workbox-background-sync:${OFFLINE_QUEUE_NAME}`;

  const broadcastMessage = async (message) => {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: "window",
    });

    for (const client of clients) {
      client.postMessage(message);
    }
  };

  const replayQueue = async (queue) => {
    const pendingEntries = typeof queue.getAll === "function" ? await queue.getAll() : null;
    const hasPending = Array.isArray(pendingEntries) ? pendingEntries.length > 0 : true;

    if (!hasPending) {
      return;
    }

    try {
      await queue.replayRequests();
      await broadcastMessage({ type: "offline-events:flushed" });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      await broadcastMessage({ type: "offline-events:error", message: details });
      throw error;
    }
  };

  core.skipWaiting();
  core.clientsClaim();

  precaching.precacheAndRoute(self.__WB_MANIFEST || []);

  const syncPlugin = new backgroundSync.BackgroundSyncPlugin(OFFLINE_QUEUE_NAME, {
    maxRetentionTime: 24 * 60,
    onSync: async ({ queue }) => replayQueue(queue),
  });

  const offlineQueue = syncPlugin._queue;

  routing.registerRoute(
    ({ request, url }) => request.method === "GET" && url.pathname.startsWith("/api/sync"),
    new strategies.NetworkFirst({
      cacheName: "sync-api-cache",
      networkTimeoutSeconds: 10,
    }),
    "GET",
  );

  routing.registerRoute(
    ({ url }) => url.pathname.startsWith("/api/sync"),
    new strategies.NetworkOnly({
      plugins: [syncPlugin],
    }),
    "POST",
  );

  routing.registerRoute(
    ({ request, url }) =>
      url.origin === self.location.origin &&
      ["style", "script", "font", "image"].includes(request.destination),
    new strategies.StaleWhileRevalidate({
      cacheName: "static-assets",
    }),
  );

  // Seitenaufrufe immer übers Netz; ohne Verbindung die Offline-Seite statt Browserfehler.
  routing.registerRoute(new routing.NavigationRoute(new strategies.NetworkOnly()));
  routing.setCatchHandler(async ({ request }) => {
    if (request.destination === "document") {
      const cached = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
      if (cached) return cached;
    }
    return Response.error();
  });

  self.addEventListener("message", (event) => {
    const { data } = event;

    if (!data || typeof data !== "object") {
      return;
    }

    if (data.type === "SKIP_WAITING") {
      self.skipWaiting();
      return;
    }

    if (data.type === OFFLINE_SYNC_TAG && offlineQueue) {
      event.waitUntil(replayQueue(offlineQueue));
    }
  });
} else {
  self.registration?.unregister?.();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .catch((error) => console.warn("[ServiceWorker] offline page not cached", error)),
  );
});

// Klick auf eine Benachrichtigung: vorhandenes Fenster fokussieren oder das Ziel öffnen.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification?.data?.url ?? "/mitglieder";

  let target;
  try {
    target = new URL(rawUrl, self.location.origin);
  } catch {
    target = new URL("/mitglieder", self.location.origin);
  }
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client =
        windows.find((entry) => new URL(entry.url).pathname === target.pathname) ??
        windows.find((entry) => new URL(entry.url).origin === target.origin);
      if (client) {
        await client.focus();
        if ("navigate" in client && client.url !== target.href) {
          try {
            await client.navigate(target.href);
          } catch (error) {
            console.warn("[ServiceWorker] navigate failed", error);
          }
        }
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
