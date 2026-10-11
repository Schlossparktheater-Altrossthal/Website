import type {
  ReservationPaymentStatus,
  ReservationSource,
  ReservationStatus,
} from "@prisma/client";

import type { ReservationListEntry } from "@/lib/karten/queries";

export type OfficePerformance = {
  eventId: string;
  start: string;
  cancelled: boolean;
  configured: boolean;
  capacity: number;
  taken: number;
  freeOnline: number;
  freeOffice: number;
  checkedIn: number;
};

export type OfficeCategory = {
  id: string;
  name: string;
  priceCents: number;
  needsSeat: boolean;
};

export type OfficeReservation = {
  id: string;
  code: string;
  eventId: string;
  source: ReservationSource;
  status: ReservationStatus;
  name: string;
  email: string | null;
  phone: string | null;
  note: string | null;
  internalNote: string | null;
  seats: number;
  totalCents: number;
  paymentStatus: ReservationPaymentStatus;
  holdUntil: string | null;
  checkedInCount: number;
  createdAt: string;
  memberName: string | null;
  items: { categoryId: string | null; label: string; quantity: number }[];
};

export function toOfficeReservation(entry: ReservationListEntry): OfficeReservation {
  return {
    id: entry.id,
    code: entry.code,
    eventId: entry.eventId,
    source: entry.source,
    status: entry.status,
    name: entry.name,
    email: entry.email,
    phone: entry.phone,
    note: entry.note,
    internalNote: entry.internalNote,
    seats: entry.seats,
    totalCents: entry.totalCents,
    paymentStatus: entry.paymentStatus,
    holdUntil: entry.holdUntil?.toISOString() ?? null,
    checkedInCount: entry.checkedInCount,
    createdAt: entry.createdAt.toISOString(),
    memberName: entry.member?.name ?? null,
    items: entry.items.map((item) => ({
      categoryId: item.categoryId,
      label: item.label,
      quantity: item.quantity,
    })),
  };
}
