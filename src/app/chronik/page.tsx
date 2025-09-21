export const dynamic = "force-dynamic";

import { chronikFallbackShows } from "@/data/chronik-fallback";
import { prisma } from "@/lib/prisma";
import type { Prisma, Show } from "@prisma/client";
import { Heading, Text } from "@/components/ui/typography";
import { ChronikStacked } from "./stacked";
import { ChronikTimeline } from "./timeline";

type ShowCastEntry = {
  role: string;
  players: string[];
};

type ChronikShowRecord = Pick<Show, "id" | "year" | "title" | "synopsis" | "posterUrl" | "meta">;

type ShowMeta = {
  author?: string | null;
  director?: string | null;
  venue?: string | null;
  ticket_info?: string | null;
  sources?: string[] | null;
  gallery?: string[] | null;
  cast?: ShowCastEntry[] | null;
};

type PosterOverride =
  | { strategy: "replace"; sources: string[] }
  | { strategy: "append"; sources: string[] };

const CHRONIK_POSTER_OVERRIDES: Record<string, PosterOverride> = {
  "altrossthal-2024": { strategy: "replace", sources: ["/images/Bunbury_Flyer.jpg"] },
  "altrossthal-2022": { strategy: "append", sources: ["/images/Aladin_Bühne.jpg"] },
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

function parseShowMeta(meta: Prisma.JsonValue | null | undefined): ShowMeta | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }

  const record = meta as Record<string, unknown>;
  const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);
  const stringArrayOrNull = (value: unknown) =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : null;
  const castOrNull = (value: unknown): ShowCastEntry[] | null => {
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

        return {
          role,
          players,
        } satisfies ShowCastEntry;
      })
      .filter((entry): entry is ShowCastEntry => Boolean(entry));

    return castEntries.length > 0 ? castEntries : null;
  };

  return {
    author: stringOrNull(record.author),
    director: stringOrNull(record.director),
    venue: stringOrNull(record.venue),
    ticket_info: stringOrNull(record.ticket_info),
    sources: stringArrayOrNull(record.sources),
    gallery: stringArrayOrNull(record.gallery),
    cast: castOrNull(record.cast),
  };
}

const CHRONIK_SUPPLEMENTS: Record<string, Partial<ShowMeta>> = {
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

function applyChronikSupplements(id: string, meta: ShowMeta | null): ShowMeta | null {
  const supplements = CHRONIK_SUPPLEMENTS[id];
  if (!supplements) {
    return meta;
  }

  const base: ShowMeta = { ...(meta ?? {}) };
  if ((!base.cast || base.cast.length === 0) && Array.isArray(supplements.cast)) {
    const supplementedCast = supplements.cast
      .map((entry) => ({
        role: entry.role ?? "",
        players: Array.isArray(entry.players) ? [...entry.players] : [],
      }))
      .filter((entry): entry is ShowCastEntry => Boolean(entry.role) && entry.players.length > 0);

    base.cast = supplementedCast.length > 0 ? supplementedCast : null;
  }

  return base;
}

export default async function ChronikPage() {
  const now = new Date();
  let shows: ChronikShowRecord[] = [];
  try {
    shows = await prisma.show.findMany({
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
  } catch {
    shows = [];
  }

  if (shows.length === 0) {
    shows = [...chronikFallbackShows];
  }

  if (shows.length === 0) {
    return (
      <div className="layout-container py-16">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
            <svg className="h-12 w-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <Heading level="h2" align="center">
            Chronik erwacht bald
          </Heading>
          <Text tone="muted" align="center">
            Die Geschichten vergangener Sommer werden bald enthüllt. Hier werden die mystischen Momente unserer Aufführungen für die Ewigkeit bewahrt.
          </Text>
        </div>
      </div>
    );
  }

  const items = shows.map((s) => ({
    id: s.id,
    year: s.year,
    title: s.title,
    synopsis: s.synopsis ?? null,
    posterUrl: (() => {
      const posterSources = getChronikPosterSources(s);
      if (posterSources.length === 0) {
        return null;
      }
      if (posterSources.length === 1) {
        return posterSources[0];
      }
      return posterSources;
    })(),
    meta: applyChronikSupplements(s.id, parseShowMeta(s.meta)),
  }));
  
  return (
    <div className="relative">
      <div className="layout-container space-y-6 py-16 text-center">
        <Heading level="h1" align="center">
          Chronik vergangener Sommer
        </Heading>
        <Text variant="bodyLg" tone="muted" align="center" className="mx-auto max-w-2xl">
          Eine Reise durch die mystischen Momente unserer Aufführungen
        </Text>
      </div>

      <ChronikStacked items={items} />
      <ChronikTimeline items={items} />
    </div>
  );
}
