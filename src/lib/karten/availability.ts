import type { ReservationSource } from "@prisma/client";

/** Kontingente einer Vorstellung (`PerformanceTicketing`). */
export type PerformanceQuota = {
  capacity: number;
  onlineLimit: number | null;
  boxOfficeReserve: number;
};

/** Belegte Plätze: gesamt und davon über Online-Buchungen. */
export type TakenSeats = {
  total: number;
  online: number;
};

export type Availability = {
  capacity: number;
  taken: number;
  /** Frei für Online-Buchung und Freikarten (ohne Abendkassen-Reserve, mit Online-Grenze). */
  online: number;
  /** Frei für Kartenbüro und Abendkasse (inklusive Reserve). */
  office: number;
};

export function computeAvailability(quota: PerformanceQuota, taken: TakenSeats): Availability {
  const office = Math.max(0, quota.capacity - taken.total);
  let online = Math.max(0, quota.capacity - quota.boxOfficeReserve - taken.total);
  if (quota.onlineLimit !== null) {
    online = Math.min(online, Math.max(0, quota.onlineLimit - taken.online));
  }
  return { capacity: quota.capacity, taken: taken.total, online, office };
}

/** Wie viele Plätze eine Quelle noch vergeben darf. */
export function seatsAvailableFor(availability: Availability, source: ReservationSource): number {
  return source === "online" || source === "free_ticket"
    ? availability.online
    : availability.office;
}

/** Ausgebucht-Grenze für die Anzeige: „wenige Plätze“ ab höchstens 10 % oder 10 Plätzen. */
export function availabilityLevel(free: number, capacity: number): "free" | "few" | "sold_out" {
  if (free <= 0) return "sold_out";
  if (free <= Math.max(3, Math.min(10, Math.ceil(capacity * 0.1)))) return "few";
  return "free";
}
