import { loadPerformances, loadReservationsForEvent, loadTicketCategories } from "./queries";

/** Ansicht über alle kommenden Vorstellungen (`?vorstellung=alle`, Standard im Kartenbüro). */
export const ALL_PERFORMANCES = "alle";

/** Daten fürs Kartenbüro; `?vorstellung=` wählt eine Vorstellung, sonst alle kommenden. */
export async function loadOfficeData(showId: string, requestedEventId?: string | null) {
  const now = new Date();
  const [performances, categories] = await Promise.all([
    loadPerformances(showId, { now }),
    loadTicketCategories(showId, { activeOnly: true }),
  ]);
  const selected = performances.find((row) => row.eventId === requestedEventId) ?? null;
  const reservations = await loadReservationsForEvent(
    selected ? selected.eventId : performances.map((row) => row.eventId),
  );
  return {
    performances: performances.map((row) => ({
      eventId: row.eventId,
      start: row.start.toISOString(),
      cancelled: row.cancelled,
      configured: row.configured,
      capacity: row.capacity,
      taken: row.availability.taken,
      freeOnline: row.availability.online,
      freeOffice: row.availability.office,
      checkedIn: row.checkedIn,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      priceCents: category.priceCents,
      needsSeat: category.needsSeat,
    })),
    /** null = alle Vorstellungen. */
    selectedEventId: selected?.eventId ?? null,
    reservations,
  };
}
