import type { TicketActor } from "./access";
import { listTicketingShows } from "./queries";

export type TicketShowOption = {
  id: string;
  title: string;
  enabled: boolean;
};

export function showOptionLabel(show: { title: string | null; year: number }) {
  return show.title ? `${show.title} (${show.year})` : `Produktion ${show.year}`;
}

/**
 * Welche Produktion die Kartenseiten zeigen: gewünschte (`?produktion=`), sonst die neueste mit
 * aktivem Kartenverkauf, sonst die neueste. Kartenbüro-Zugänge sehen nur ihre Produktion.
 */
export async function resolveTicketShow(actor: TicketActor, requested?: string | null) {
  const shows = await listTicketingShows(
    actor.kind === "access" && actor.showId ? { id: actor.showId } : {},
  );
  const options: TicketShowOption[] = shows.map((show) => ({
    id: show.id,
    title: showOptionLabel(show),
    enabled: show.ticketingSettings?.enabled ?? false,
  }));
  // Wer nicht einrichtet, sieht nur Produktionen mit Kartenverkauf.
  const visible = actor.canManage ? options : options.filter((option) => option.enabled);
  const selected =
    visible.find((option) => option.id === requested) ??
    visible.find((option) => option.enabled) ??
    visible[0] ??
    null;
  return { shows: visible, selected };
}

export function withShowParam(path: string, showId: string | null | undefined) {
  return showId ? `${path}?produktion=${encodeURIComponent(showId)}` : path;
}

/** Öffentliche Website (Drupal) für Datenschutz- und Rücklinks. */
export function publicWebsiteUrl(): string {
  const first = process.env.PUBLIC_SITE_ORIGINS?.split(",")[0]?.trim();
  return (first || "https://sommertheater-altrossthal.de").replace(/\/$/, "");
}
