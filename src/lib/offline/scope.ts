import type { OfflineScope } from "./types";

/** Seit das Offline-Inventar entfernt ist, gibt es nur noch den Ticket-Scope. */
export function inferScopeFromEventType(type: string): OfflineScope {
  if (!type.startsWith("ticket")) {
    console.warn(`[offline] Unbekannter Ereignistyp „${type}“ – wird als Ticket behandelt.`);
  }
  return "tickets";
}
