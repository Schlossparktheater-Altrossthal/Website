const DEFAULT_EVENT_PATH = process.env.REALTIME_SERVER_EVENT_PATH || "/events";
const REALTIME_SERVER_URL =
  process.env.REALTIME_SERVER_URL ||
  process.env.NEXT_PUBLIC_REALTIME_URL ||
  "http://localhost:4001";
const REALTIME_AUTH_TOKEN =
  process.env.REALTIME_AUTH_TOKEN || process.env.REALTIME_SERVER_TOKEN || "";

/**
 * Ziel für Events. Enthält der Event-Pfad schon den Basispfad der Server-URL (Docker:
 * `REALTIME_SERVER_URL=…/realtime`, `REALTIME_SERVER_EVENT_PATH=/realtime/events`), wird er nicht
 * doppelt angehängt – sonst landet jedes Event als 404 bei Next statt beim Realtime-Server.
 */
export function resolveEventUrl(
  serverUrl: string | undefined = REALTIME_SERVER_URL,
  eventPath: string = DEFAULT_EVENT_PATH,
) {
  const base = serverUrl?.replace(/\/$/, "") || "http://localhost:4001";
  const path = eventPath.startsWith("/") ? eventPath : `/${eventPath}`;
  try {
    const url = new URL(base);
    const basePath = url.pathname.replace(/\/$/, "");
    if (basePath && (path === basePath || path.startsWith(`${basePath}/`))) {
      return `${url.origin}${path}`;
    }
  } catch {
    // Relative Basis (z. B. „/realtime“): unverändert zusammensetzen.
  }
  return `${base}${path}`;
}

/**
 * Emits a realtime event to the standalone Socket.io bridge.
 *
 * Supported admin sync events include:
 * - `ticket_scan_event`: broadcast ticket scan deltas (expects `{ scope: 'tickets', serverSeq, events, delta }`).
 *
 * The payload for these events should mirror the response from the sync API so
 * connected scanner clients can immediately apply the mutation to Dexie without
 * waiting for the next poll.
 */
export async function emitRealtimeEvent(eventType: string, payload: unknown): Promise<void> {
  if (!eventType) {
    console.warn("[RealtimeTriggers] Missing event type");
    return;
  }

  try {
    const response = await fetch(resolveEventUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventType,
        payload,
        token: REALTIME_AUTH_TOKEN,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[RealtimeTriggers] Failed to emit event", eventType, response.status, text);
    }
  } catch (error) {
    console.error("[RealtimeTriggers] Error emitting event", eventType, error);
  }
}
