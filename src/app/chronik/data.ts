import { chronikFallbackShows } from "@/data/chronik-fallback";
import { prisma } from "@/lib/prisma";
import type { Prisma, Show } from "@prisma/client";

import type { ChronikMeta, ChronikPreparedItem } from "./types";

type ChronikShowRecord = Pick<Show, "id" | "year" | "title" | "synopsis" | "posterUrl" | "meta">;

type PosterOverride =
  | { strategy: "replace"; sources: string[] }
  | { strategy: "append"; sources: string[] };

const CHRONIK_POSTER_OVERRIDES: Record<string, PosterOverride> = {
  "altrossthal-2024": {
    strategy: "replace",
    sources: ["/images/Bunbury_Flyer.jpg", "/images/Sequenz%2001.Standbild137.jpg"],
  },
  "altrossthal-2023": {
    strategy: "replace",
    sources: ["/images/Screenshot%202025-09-21%20234531.png"],
  },
  "altrossthal-2022": { strategy: "append", sources: ["/images/Aladin_Bühne.jpg"] },
  "altrossthal-2018": {
    strategy: "replace",
    sources: ["/images/Screenshot%202025-09-21%20235339.png"],
  },
  "altrossthal-2017": {
    strategy: "replace",
    sources: ["/images/SNT_1.png", "/images/SNT_2.png"],
  },
  "altrossthal-2016": {
    strategy: "replace",
    sources: ["/images/Canterville.png"],
  },
  "altrossthal-2015": {
    strategy: "replace",
    sources: ["/images/RuJ_1.png", "/images/RuJ_2.png", "/images/RuJ_3.png", "/images/RuJ_4.png"],
  },
  "altrossthal-2014": {
    strategy: "replace",
    sources: ["/images/Faust_1.png", "/images/Faust_2.png"],
  },
};

function sanitizePosterSources(sources: (string | null | undefined)[]) {
  const unique = new Set<string>();
  const sanitized: string[] = [];

  for (const entry of sources) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmed = entry.trim();
    if (!trimmed || unique.has(trimmed)) {
      continue;
    }

    unique.add(trimmed);
    sanitized.push(trimmed);
  }

  return sanitized;
}

function getChronikPosterSources(show: ChronikShowRecord) {
  const override = CHRONIK_POSTER_OVERRIDES[show.id];
  const baseSources = sanitizePosterSources([show.posterUrl]);

  if (!override) {
    return baseSources;
  }

  const overrideSources = sanitizePosterSources(override.sources);

  if (override.strategy === "replace") {
    return overrideSources;
  }

  return sanitizePosterSources([...baseSources, ...overrideSources]);
}

function sanitizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const unique = new Set<string>();
  const normalized: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmed = entry.trim();
    if (!trimmed || unique.has(trimmed)) {
      continue;
    }

    unique.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized.length > 0 ? normalized : null;
}

function parseShowMeta(meta: Prisma.JsonValue | null | undefined): ChronikMeta | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }

  const record = meta as Record<string, unknown>;
  const stringOrNull = (value: unknown) => (typeof value === "string" ? value.trim() || null : null);
  const stringArrayOrNull = (value: unknown) => sanitizeStringArray(value);
  const castOrNull = (value: unknown): ChronikMeta["cast"] => {
    if (!Array.isArray(value)) {
      return null;
    }

    const castEntries = value
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return null;
        }

        const castRecord = entry as Record<string, unknown>;
        const role = typeof castRecord.role === "string" ? castRecord.role.trim() : "";
        const players = Array.isArray(castRecord.players)
          ? castRecord.players
              .filter((player): player is string => typeof player === "string" && player.trim().length > 0)
              .map((player) => player.trim())
          : [];

        if (!role || players.length === 0) {
          return null;
        }

        return { role, players };
      })
      .filter((entry): entry is NonNullable<ChronikMeta["cast"]>[number] => Boolean(entry));

    return castEntries.length > 0 ? castEntries : null;
  };

  const metaRecord: ChronikMeta = {
    author: stringOrNull(record.author),
    director: stringOrNull(record.director),
    venue: stringOrNull(record.venue ?? record.location),
    ticket_info: stringOrNull(record.ticket_info),
    organizer: stringOrNull(record.organizer),
    transport: stringOrNull(record.transport),
    sources: stringArrayOrNull(record.sources),
    gallery: stringArrayOrNull(record.gallery ?? record.images),
    evidence: stringArrayOrNull(record.evidence ?? record.evidence_snippets),
    quotes: stringArrayOrNull(record.quotes ?? record.press_quotes),
    cast: castOrNull(record.cast),
  };

  const hasValue = Object.values(metaRecord).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value != null;
  });

  return hasValue ? metaRecord : null;
}

const CHRONIK_SUPPLEMENTS: Record<string, Partial<ChronikMeta>> = {
  "altrossthal-2024": {
    cast: [
      { role: "Jack Worthing", players: ["Luca Totzek"] },
      { role: "Algernon Moncrieff", players: ["Yann Lindemann"] },
      { role: "Lady Augusta Brachnell", players: ["Tobias Schneider"] },
      { role: "Gwendolen Fairfax", players: ["Leonie Thea Tänzer", "Cosima Werner"] },
      { role: "Cecily Dardew", players: ["Bashi Deutsch"] },
      { role: "Miss Laetitia Prism", players: ["Helene Irmer"] },
      { role: "Dr. Frederick Chasuble", players: ["Jonas Fehrmann"] },
      { role: "Mary", players: ["Bianca Milke"] },
      { role: "Lane", players: ["Nicklas Gretzel"] },
      { role: "Diener", players: ["Bianca Milke", "Jonas Fehrmann"] },
      {
        role: "Amüsierdamen",
        players: ["Sarah König", "Bashi Deutsch", "Mathilda Hoffmann", "Helene Irmer", "Mia Däbler"],
      },
      { role: "Gäste", players: ["Sebastian Seifert", "Lennart Neumeister", "Justus Schmeling"] },
    ],
  },
};

function applyChronikSupplements(id: string, meta: ChronikMeta | null): ChronikMeta | null {
  const supplements = CHRONIK_SUPPLEMENTS[id];
  if (!supplements) {
    return meta;
  }

  const base: ChronikMeta = { ...(meta ?? {}) };
  if ((!base.cast || base.cast.length === 0) && Array.isArray(supplements.cast)) {
    const supplementedCast = supplements.cast
      .map((entry) => ({
        role: entry?.role ?? "",
        players: Array.isArray(entry?.players) ? [...entry.players] : [],
      }))
      .filter((entry) => Boolean(entry.role) && entry.players.length > 0);

    base.cast = supplementedCast.length > 0 ? supplementedCast : null;
  }

  return base;
}

async function fetchChronikRecords(): Promise<ChronikShowRecord[]> {
  const now = new Date();

  try {
    const shows = await prisma.show.findMany({
      where: { revealedAt: { not: null, lte: now } },
      orderBy: [{ year: "desc" }],
      select: {
        id: true,
        year: true,
        title: true,
        synopsis: true,
        posterUrl: true,
        meta: true,
      },
    });

    if (shows.length > 0) {
      return shows;
    }
  } catch {
    // Prisma is optional in some environments; fall back to static data when unavailable.
  }

  return [...chronikFallbackShows];
}

function mapChronikRecord(record: ChronikShowRecord): ChronikPreparedItem {
  return {
    id: record.id,
    year: record.year,
    title: record.title ?? null,
    synopsis: record.synopsis ?? null,
    posterSources: getChronikPosterSources(record),
    meta: applyChronikSupplements(record.id, parseShowMeta(record.meta)),
  };
}

export async function getChronikItems(): Promise<ChronikPreparedItem[]> {
  const records = await fetchChronikRecords();
  return records.map((record) => mapChronikRecord(record));
}

export async function getChronikItem(id: string): Promise<ChronikPreparedItem | null> {
  const now = new Date();

  try {
    const record = await prisma.show.findFirst({
      where: { id, revealedAt: { not: null, lte: now } },
      select: {
        id: true,
        year: true,
        title: true,
        synopsis: true,
        posterUrl: true,
        meta: true,
      },
    });

    if (record) {
      return mapChronikRecord(record);
    }
  } catch {
    // ignore and fall back to static data
  }

  const fallback = chronikFallbackShows.find((entry) => entry.id === id);
  return fallback ? mapChronikRecord(fallback) : null;
}
