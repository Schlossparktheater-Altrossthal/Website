import type {
  ReservationPaymentStatus,
  ReservationSource,
  ReservationStatus,
} from "@prisma/client";

import {
  DEFAULT_TIME_ZONE,
  formatIsoDateInTimeZone,
  formatIsoTimeInTimeZone,
} from "@/lib/format/date";

/** Kartenbuchung (docs/Plan/kartenbuchung-plan.md). */
export const TICKET_PERMISSION_KEYS = {
  manage: "PRIVATE.TICKETS.MANAGE",
  office: "PRIVATE.TICKETS.OFFICE",
  checkIn: "PRIVATE.TICKETS.CHECKIN",
} as const;

export const PUBLIC_TICKETS_PATH = "/karten";
export const BOX_OFFICE_PATH = "/kartenbuero";
export const MEMBERS_TICKETS_PATH = "/mitglieder/karten";

export const RESERVATION_SOURCE_LABELS: Record<ReservationSource, string> = {
  online: "Online",
  phone: "Telefon",
  free_ticket: "Freikarte",
  box_office: "Abendkasse",
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "Unbestätigt",
  confirmed: "Bestätigt",
  cancelled: "Storniert",
  expired: "Verfallen",
};

export const RESERVATION_STATUS_TONES: Record<
  ReservationStatus,
  "success" | "warning" | "destructive" | "muted"
> = {
  pending: "warning",
  confirmed: "success",
  cancelled: "destructive",
  expired: "muted",
};

export const PAYMENT_STATUS_LABELS: Record<ReservationPaymentStatus, string> = {
  open: "offen",
  paid: "bezahlt",
  free: "frei",
};

const priceFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function formatPrice(cents: number): string {
  return priceFormat.format(cents / 100);
}

/** Eingaben wie „12“, „12,50“ oder „12.5“ → Cent; ungültig → null. */
export function parsePriceToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s|€/g, "").replace(",", ".");
  if (normalized === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

const performanceFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: DEFAULT_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const performanceLongFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: DEFAULT_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatPerformanceDate(date: Date): string {
  return `${performanceFormat.format(date)} Uhr`;
}

export function formatPerformanceDateLong(date: Date): string {
  return `${performanceLongFormat.format(date)} Uhr`;
}

/** „2 × Erwachsene, 1 × Kinder“ */
export function describeItems(items: readonly { label: string; quantity: number }[]): string {
  return items
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.quantity} × ${item.label}`)
    .join(", ");
}

/** Wert für `<input type="datetime-local">` in Berliner Zeit. */
export function toDateTimeLocalValue(date: Date | null | undefined): string | null {
  if (!date) return null;
  const iso = date.toISOString();
  return `${formatIsoDateInTimeZone(iso)}T${formatIsoTimeInTimeZone(iso)}`;
}
