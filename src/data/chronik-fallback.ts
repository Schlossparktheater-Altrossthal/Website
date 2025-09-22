import type { Show } from "@prisma/client";

import rawChronikAltrossthal from "./chronik-altrossthal.json" with { type: "json" };

type RawChronikCastEntry = {
  role?: string | null;
  players?: string[] | null;
};

type ChronikCastEntry = {
  role: string;
  players: string[];
};

type RawChronikEntry = {
  year: number;
  title?: string | null;
  author?: string | null;
  location?: string | null;
  director?: string | null;
  organizer?: string | null;
  sources?: string[] | null;
  evidence_snippets?: string[] | null;
  press_quotes?: string[] | null;
  images?: string[] | null;
  ticket_info?: string | null;
  transport?: string | null;
  cast?: RawChronikCastEntry[] | null;
  posterUrl?: string | null;
};

type ChronikShowRecord = Pick<Show, "id" | "year" | "title" | "synopsis" | "posterUrl" | "meta">;

function sanitizeCast(entry: RawChronikEntry["cast"]): ChronikCastEntry[] | null {
  if (!Array.isArray(entry)) {
    return null;
  }

  const normalized: ChronikCastEntry[] = [];

  for (const castEntry of entry) {
    if (!castEntry || typeof castEntry !== "object") {
      continue;
    }

    const role = typeof castEntry.role === "string" ? castEntry.role.trim() : "";
    const players = Array.isArray(castEntry.players)
      ? castEntry.players
          .filter((player): player is string => typeof player === "string" && player.trim().length > 0)
          .map((player) => player.trim())
      : [];

    if (!role || players.length === 0) {
      continue;
    }

    normalized.push({ role, players });
  }

  return normalized.length > 0 ? normalized : null;
}

function toChronikShowRecord(entry: RawChronikEntry): ChronikShowRecord | null {
  if (!entry || typeof entry.year !== "number") {
    return null;
  }

  const meta = {
    author: entry.author ?? null,
    director: entry.director ?? null,
    venue: entry.location ?? null,
    organizer: entry.organizer ?? null,
    sources: Array.isArray(entry.sources) ? entry.sources : [],
    evidence: Array.isArray(entry.evidence_snippets) ? entry.evidence_snippets : [],
    quotes: Array.isArray(entry.press_quotes) ? entry.press_quotes : [],
    gallery: Array.isArray(entry.images) ? entry.images : [],
    ticket_info: entry.ticket_info ?? null,
    transport: entry.transport ?? null,
    cast: sanitizeCast(entry.cast ?? null),
  } satisfies Record<string, unknown>;

  return {
    id: `altrossthal-${entry.year}`,
    year: entry.year,
    title: typeof entry.title === "string" ? entry.title : null,
    synopsis: entry.author ? `${entry.author}` : null,
    posterUrl: typeof entry.posterUrl === "string" && entry.posterUrl.trim()
      ? entry.posterUrl.trim()
      : `https://picsum.photos/seed/${entry.year}/800/1200`,
    meta,
  } satisfies ChronikShowRecord;
}

const chronikFallbackShowsInternal = (Array.isArray(rawChronikAltrossthal) ? rawChronikAltrossthal : [])
  .map((entry) => toChronikShowRecord(entry as RawChronikEntry))
  .filter((entry): entry is ChronikShowRecord => Boolean(entry))
  .sort((a, b) => b.year - a.year);

export const chronikFallbackShows: ChronikShowRecord[] = chronikFallbackShowsInternal;
