/* global workbox */
importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js");

if (workbox) {
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
    ({ request, url }) =>
      request.method === "GET" && url.pathname.startsWith("/api/sync"),
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
  console.error("Workbox failed to load. Offline support is disabled.");
}
