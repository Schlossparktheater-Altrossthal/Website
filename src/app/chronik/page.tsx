import { prisma } from "@/lib/prisma";
import type { Prisma, Show } from "@prisma/client";
import { Heading, Text } from "@/components/ui/typography";
import { ChronikStacked } from "./stacked";
import { ChronikTimeline } from "./timeline";

type ShowMeta = {
  author?: string | null;
  director?: string | null;
  venue?: string | null;
  ticket_info?: string | null;
  sources?: string[] | null;
  gallery?: string[] | null;
};

function parseShowMeta(meta: Prisma.JsonValue | null | undefined): ShowMeta | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }

  const record = meta as Record<string, unknown>;
  const stringOrNull = (value: unknown) => (typeof value === "string" ? value : null);
  const stringArrayOrNull = (value: unknown) =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : null;

  return {
    author: stringOrNull(record.author),
    director: stringOrNull(record.director),
    venue: stringOrNull(record.venue),
    ticket_info: stringOrNull(record.ticket_info),
    sources: stringArrayOrNull(record.sources),
    gallery: stringArrayOrNull(record.gallery),
  };
}

export default async function ChronikPage() {
  const now = new Date();
  let shows: Show[] = [];
  try {
    shows = await prisma.show.findMany({
      where: { revealedAt: { not: null, lte: now } },
      orderBy: [{ year: "desc" }],
    });
  } catch {
    shows = [];
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
    posterUrl: s.posterUrl ?? null,
    meta: parseShowMeta(s.meta),
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
