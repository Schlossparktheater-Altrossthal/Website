const DEFAULT_EVENT_PATH = process.env.REALTIME_SERVER_EVENT_PATH || '/events';
const REALTIME_SERVER_URL =
  process.env.REALTIME_SERVER_URL || process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:4001';
const REALTIME_AUTH_TOKEN = process.env.REALTIME_AUTH_TOKEN || process.env.REALTIME_SERVER_TOKEN || '';

function resolveEventUrl() {
  const base = REALTIME_SERVER_URL?.replace(/\/$/, '') || 'http://localhost:4001';
  const path = DEFAULT_EVENT_PATH.startsWith('/') ? DEFAULT_EVENT_PATH : `/${DEFAULT_EVENT_PATH}`;
  return `${base}${path}`;
}

/**
 * Emits a realtime event to the standalone Socket.io bridge.
 *
 * Supported admin sync events include:
 * - `inventory_event`: broadcast inventory deltas (expects `{ scope: 'inventory', serverSeq, events, delta }`).
 * - `ticket_scan_event`: broadcast ticket scan deltas (expects `{ scope: 'tickets', serverSeq, events, delta }`).
 *
 * The payload for these events should mirror the response from the sync API so
 * connected scanner clients can immediately apply the mutation to Dexie without
 * waiting for the next poll.
 */
export async function emitRealtimeEvent(eventType: string, payload: unknown): Promise<void> {
  if (!eventType) {
    console.warn('[RealtimeTriggers] Missing event type');
    return;
  }

  try {
    const response = await fetch(resolveEventUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType,
        payload,
        token: REALTIME_AUTH_TOKEN,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[RealtimeTriggers] Failed to emit event', eventType, response.status, text);
    }
  } catch (error) {
    console.error('[RealtimeTriggers] Error emitting event', eventType, error);
  }
}
