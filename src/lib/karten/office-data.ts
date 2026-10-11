import { loadPerformances, loadReservationsForEvent, loadTicketCategories } from "./queries";

/** Daten für Kartenbüro und Einlass einer Produktion; Vorstellung aus `?vorstellung=` oder die nächste. */
export async function loadOfficeData(showId: string, requestedEventId?: string | null) {
  const now = new Date();
  const [performances, categories] = await Promise.all([
    loadPerformances(showId, { now }),
    loadTicketCategories(showId, { activeOnly: true }),
  ]);
  const selected =
    performances.find((row) => row.eventId === requestedEventId) ??
    performances.find((row) => row.configured && !row.cancelled) ??
    performances[0] ??
    null;
  const reservations = selected ? await loadReservationsForEvent(selected.eventId) : [];
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
    selectedEventId: selected?.eventId ?? null,
    reservations,
  };
}
