/** Lager-Projekte – Bezeichnungen und Datums-Helfer ohne Server-Abhängigkeiten. */
import type { StatusTone } from "@/lib/inventory/constants";

export const PROJECT_STATUSES = ["request", "confirmed", "done", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  request: "Angefragt",
  confirmed: "Bestätigt",
  done: "Abgeschlossen",
  cancelled: "Abgesagt",
};

export const PROJECT_STATUS_TONES: Record<ProjectStatus, StatusTone> = {
  request: "warning",
  confirmed: "success",
  done: "muted",
  cancelled: "muted",
};

/** Diese Projekte belegen Material. Angefragte nur „weich“ (Warnung statt Konflikt). */
export const RESERVING_STATUSES: ProjectStatus[] = ["request", "confirmed"];

export const PHASE_KINDS = ["setup", "event", "teardown", "other"] as const;
export type PhaseKind = (typeof PHASE_KINDS)[number];

export const PHASE_KIND_LABELS: Record<PhaseKind, string> = {
  setup: "Aufbau",
  event: "Veranstaltung",
  teardown: "Abbau",
  other: "Sonstiges",
};

export const INVENTORY_PROJECTS_PATH = "/mitglieder/lager/projekte";

export function inventoryProjectPath(publicId: string) {
  return `${INVENTORY_PROJECTS_PATH}/${encodeURIComponent(publicId)}`;
}

/** `YYYY-MM-DD` → UTC-Mitternacht (Spalten vom Typ `@db.Date`). */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateOnlyValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

const DAY = new Intl.DateTimeFormat("de-DE", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const DAY_SHORT = new Intl.DateTimeFormat("de-DE", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

/** „Fr., 12.06.2026“ bzw. „Fr., 12.06. – So., 14.06.2026“. */
export function formatDateRange(start: Date | string | null, end: Date | string | null): string {
  if (!start) return "ohne Termin";
  const from = new Date(start);
  const to = end ? new Date(end) : from;
  if (from.getTime() === to.getTime()) return DAY.format(from);
  return `${DAY_SHORT.format(from)} – ${DAY.format(to)}`;
}

/** Belegungszeitraum aus den Phasen. */
export function projectWindow(phases: readonly { startsOn: Date; endsOn: Date }[]) {
  if (!phases.length) return { startsOn: null, endsOn: null };
  let startsOn = phases[0]!.startsOn;
  let endsOn = phases[0]!.endsOn;
  for (const phase of phases) {
    if (phase.startsOn < startsOn) startsOn = phase.startsOn;
    if (phase.endsOn > endsOn) endsOn = phase.endsOn;
  }
  return { startsOn, endsOn };
}

export type ProjectFormValues = {
  title: string;
  status: ProjectStatus;
  contactName: string;
  venue: string;
  leadUserId: string | null;
  leadName: string;
  showId: string | null;
  note: string;
  phases: { kind: PhaseKind; label: string; startsOn: string; endsOn: string }[];
};

export function emptyProjectValues(): ProjectFormValues {
  return {
    title: "",
    status: "request",
    contactName: "",
    venue: "",
    leadUserId: null,
    leadName: "",
    showId: null,
    note: "",
    phases: [
      { kind: "setup", label: "", startsOn: "", endsOn: "" },
      { kind: "event", label: "", startsOn: "", endsOn: "" },
      { kind: "teardown", label: "", startsOn: "", endsOn: "" },
    ],
  };
}
