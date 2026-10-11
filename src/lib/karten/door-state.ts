import type { DoorGuest, DoorMutation, DoorSnapshot } from "./checkin";

/** Zahlen für die Kopfzeile am Einlass. */
export function doorCounters(snapshot: DoorSnapshot) {
  let expected = 0;
  let present = 0;
  for (const guest of snapshot.guests) {
    if (guest.status !== "confirmed" && guest.status !== "pending") continue;
    expected += guest.tickets;
    present += guest.checkedIn;
  }
  const inside = present + snapshot.boxOfficeTickets;
  return {
    expected,
    present,
    missing: Math.max(0, expected - present),
    inside,
    free: Math.max(0, snapshot.capacity - expected - snapshot.boxOfficeTickets),
    boxOfficeTickets: snapshot.boxOfficeTickets,
  };
}

/**
 * Noch nicht bestätigte Aktionen auf die zuletzt vom Server geladene Liste anwenden – so zeigt das
 * Gerät auch offline den eigenen Stand.
 */
export function applyPending(
  snapshot: DoorSnapshot,
  queue: readonly DoorMutation[],
  priceByCategory: ReadonlyMap<string, number> = new Map(),
): DoorSnapshot {
  if (queue.length === 0) return snapshot;
  const guests = new Map<string, DoorGuest>(
    snapshot.guests.map((guest) => [guest.id, { ...guest }]),
  );
  let boxOfficeTickets = snapshot.boxOfficeTickets;
  let boxOfficeCents = snapshot.boxOfficeCents;
  for (const mutation of queue) {
    if (mutation.type === "sale") {
      for (const item of mutation.items) {
        boxOfficeTickets += item.quantity;
        boxOfficeCents += item.quantity * (priceByCategory.get(item.categoryId) ?? 0);
      }
      continue;
    }
    const guest = guests.get(mutation.reservationId);
    if (!guest) continue;
    guest.checkedIn = Math.max(0, Math.min(guest.tickets, guest.checkedIn + mutation.delta));
  }
  return { ...snapshot, guests: [...guests.values()], boxOfficeTickets, boxOfficeCents };
}

function normalize(value: string) {
  return value.toLocaleLowerCase("de").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Suche nach Name (Wortanfänge, ohne Akzente) oder Code. */
export function searchGuests(guests: readonly DoorGuest[], query: string): DoorGuest[] {
  const q = normalize(query.trim());
  if (!q) return [...guests];
  const code = query
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const parts = q.split(/\s+/);
  return guests.filter((guest) => {
    if (code.length >= 4 && guest.code.startsWith(code)) return true;
    const words = normalize(guest.name).split(/\s+/);
    return parts.every((part) => words.some((word) => word.startsWith(part)));
  });
}
