import type { StatTileTone } from "@/components/ui/stat-tile";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

export const numberFormat = new Intl.NumberFormat("de-DE");
const decimalFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
export const percentFormat = new Intl.NumberFormat("de-DE", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function formatMs(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "–";
  return ms >= 1000 ? `${decimalFormat.format(ms / 1000)} s` : `${Math.round(ms)} ms`;
}

/** Verweil-/Besuchsdauer: Sekunden, Minuten oder Stunden. */
export function formatDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "–";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatRelative(iso: string, now: number = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.round(diff / 60_000);
  if (minutes < 2) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "gestern" : `vor ${days} Tagen`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    timeZone: DEFAULT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Veränderung zum Vorzeitraum als kurzer Text, z. B. „+12 %“. Null ohne Vergleichswert. */
export function formatChange(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const change = (current - previous) / previous;
  const rounded = Math.round(change * 100);
  if (rounded === 0) return "±0 %";
  return `${rounded > 0 ? "+" : ""}${rounded} %`;
}

export { routeLabel as shortRoute } from "@/lib/analytics/route-labels";

// Grenzen angelehnt an die Web-Vitals-Empfehlungen (LCP gut < 2,5 s); Seitenwechsel sollen
// sich unter einer Sekunde anfühlen.
export function loadTone(ms: number | null, kind: "load" | "navigation"): StatTileTone {
  if (ms === null) return "neutral";
  const [good, poor] = kind === "load" ? [2500, 4000] : [1000, 2500];
  if (ms <= good) return "success";
  if (ms <= poor) return "warning";
  return "destructive";
}

export const TONE_TEXT: Record<StatTileTone, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function formatWeekday(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("de-DE", {
    timeZone: DEFAULT_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}
