import type { ProtocolKind } from "@/lib/skript/live/protocol";

export const DATE_TIME = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});
export const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

export const STATUS_LABEL = {
  recording: "Läuft",
  draft: "Entwurf",
  confirmed: "Bestätigt",
  discarded: "Verworfen",
} as const;

export const KIND_LABEL: Record<ProtocolKind, string> = {
  durchlauf: "Durchlauf",
  leseprobe: "Leseprobe",
  szenenarbeit: "Szenenarbeit",
};

/** „1 h 05 min“, „12 min“, „40 s“. */
export function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
