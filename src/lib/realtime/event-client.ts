const DEFAULT_EVENT_PATH = process.env.REALTIME_SERVER_EVENT_PATH || '/events';
const REALTIME_SERVER_URL =
  process.env.REALTIME_SERVER_URL || process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:4001';
const REALTIME_AUTH_TOKEN = process.env.REALTIME_AUTH_TOKEN || process.env.REALTIME_SERVER_TOKEN || '';

function resolveEventUrl() {
  const base = REALTIME_SERVER_URL?.replace(/\/$/, '') || 'http://localhost:4001';
  const path = DEFAULT_EVENT_PATH.startsWith('/') ? DEFAULT_EVENT_PATH : `/${DEFAULT_EVENT_PATH}`;
  return `${base}${path}`;
}

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
