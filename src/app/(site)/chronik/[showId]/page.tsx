import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/text-link";
import { Heading, Text } from "@/components/ui/typography";

import { PosterSlideshow } from "../poster-slideshow";
import { getChronikItem } from "../data";
import { formatChronikPlayerName } from "../formatters";
import type { ChronikCastEntry, ChronikMeta } from "../types";

type ChronikDetailPageProps = {
  params: {
    showId: string;
  };
};

function buildPrimaryDetails(meta: ChronikMeta | null) {
  if (!meta) {
    return [] as { label: string; value: string }[];
  }

  const entries: { label: string; value: string }[] = [];

  const append = (label: string, value: string | null | undefined) => {
    if (value) {
      entries.push({ label, value });
    }
  };

  append("Autor", meta.author ?? null);
  append("Regie", meta.director ?? null);
  append("Ort", meta.venue ?? null);
  append("Organisation", meta.organizer ?? null);
  append("Tickets", meta.ticket_info ?? null);
  append("Anreise", meta.transport ?? null);

  return entries;
}

function sanitizeCast(meta: ChronikMeta | null) {
  if (!meta || !Array.isArray(meta.cast)) {
    return [] as ChronikCastEntry[];
  }

  return meta.cast;
}

export async function generateMetadata({ params }: ChronikDetailPageProps): Promise<Metadata> {
  const item = await getChronikItem(params.showId);

  if (!item) {
    return {
      title: "Chronik-Eintrag nicht gefunden",
      description: "Der angeforderte Eintrag ist in unserer Chronik nicht verfügbar.",
    };
  }

  const baseTitle = item.title ? `${item.title} (${item.year})` : `Saison ${item.year}`;

  return {
    title: `${baseTitle} – Chronik`,
    description: item.synopsis ?? `Erfahre mehr über die Saison ${item.year} unserer Chronik.`,
  };
}

export default async function ChronikDetailPage({ params }: ChronikDetailPageProps) {
  const item = await getChronikItem(params.showId);

  if (!item) {
    notFound();
  }

  const heading = item.title ?? `Saison ${item.year}`;
  const meta: ChronikMeta | null = item.meta ?? null;
  const primaryDetails = buildPrimaryDetails(meta);
  const castEntries = sanitizeCast(meta);
  const sources = Array.isArray(meta?.sources) ? meta?.sources : [];
  const quotes = Array.isArray(meta?.quotes) ? meta?.quotes : [];
  const evidence = Array.isArray(meta?.evidence) ? meta?.evidence : [];
  const gallery = Array.isArray(meta?.gallery) ? meta?.gallery : [];

  return (
    <div className="relative">
      <div className="relative isolate overflow-hidden border-b border-border/60 bg-background">
        <div className="relative h-[65vh] min-h-[420px] w-full">
          {item.posterSources.length > 0 && (
            <PosterSlideshow
              sources={item.posterSources}
              alt={heading}
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[color:color-mix(in_oklab,var(--foreground)_75%,transparent)] via-[color:color-mix(in_oklab,var(--foreground)_35%,transparent)] to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background/95" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60rem_40rem_at_35%_70%,_color-mix(in_oklab,var(--primary)_12%,transparent),transparent_80%)]" />

          <div className="absolute inset-0 flex items-end">
            <div className="layout-container w-full py-12 sm:py-16">
              <div className="mx-auto max-w-4xl space-y-6 rounded-3xl border border-border/60 bg-background/75 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
                <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground">
                  <TextLink asChild variant="ghost" weight="semibold">
                    <Link href="/chronik" className="inline-flex items-center gap-2 text-foreground">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                      Zur Chronik
                    </Link>
                  </TextLink>
                  <Badge variant="default" className="bg-primary/20 text-primary">
                    Saison {item.year}
                  </Badge>
                </div>

                <Heading level="h1" className="text-balance text-3xl leading-tight sm:text-4xl md:text-5xl">
                  {heading}
                </Heading>

                {item.synopsis ? (
                  <Text className="max-w-3xl text-base leading-relaxed text-foreground/90 md:text-lg">
                    {item.synopsis}
                  </Text>
                ) : (
                  <Text className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
                    Für diese Saison liegt uns aktuell keine Zusammenfassung vor. Wir ergänzen die Chronik, sobald neue Informationen verfügbar sind.
                  </Text>
                )}

                {primaryDetails.length > 0 && (
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {primaryDetails.map((detail) => (
                      <div
                        key={`${item.id}-${detail.label}`}
                        className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-foreground/90 shadow-inner"
                      >
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                          {detail.label}
                        </dt>
                        <dd className="mt-1 text-base font-semibold md:text-lg">
                          {detail.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="layout-container space-y-16 py-16">
        <section className="mx-auto max-w-3xl space-y-4">
          <Heading level="h2">Über diese Saison</Heading>
          {item.synopsis ? (
            <Text className="text-base leading-relaxed text-foreground/90 md:text-lg">
              {item.synopsis}
            </Text>
          ) : (
            <Text className="text-base leading-relaxed text-muted-foreground md:text-lg">
              Noch haben wir keine weiteren Hintergründe zu dieser Saison aufgezeichnet. Wenn du Informationen beitragen möchtest, freuen wir uns über eine Nachricht.
            </Text>
          )}
        </section>

        {castEntries.length > 0 && (
          <section className="mx-auto max-w-5xl space-y-6">
            <Heading level="h2">Ensemble &amp; Rollen</Heading>
            <div className="grid gap-4 sm:grid-cols-2">
              {castEntries.map((entry, index) => (
                <div
                  key={`${item.id}-cast-${index}`}
                  className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <Heading level="h3" asChild>
                    <span className="text-lg font-semibold text-foreground">
                      {entry.role}
                    </span>
                  </Heading>
                  <Text className="mt-2 text-sm text-foreground/80 md:text-base">
                    {entry.players
                      .map((player) => formatChronikPlayerName(player))
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                </div>
              ))}
            </div>
          </section>
        )}

        {quotes.length > 0 && (
          <section className="mx-auto max-w-4xl space-y-5">
            <Heading level="h2">Pressestimmen</Heading>
            <div className="space-y-4">
              {quotes.map((quote, index) => (
                <blockquote
                  key={`${item.id}-quote-${index}`}
                  className="rounded-3xl border border-border/60 bg-muted/40 p-6 text-lg italic text-foreground/90 shadow-inner"
                >
                  “{quote}”
                </blockquote>
              ))}
            </div>
          </section>
        )}

        {evidence.length > 0 && (
          <section className="mx-auto max-w-4xl space-y-4">
            <Heading level="h2">Zeitzeugnisse</Heading>
            <ul className="grid list-disc gap-3 pl-6 text-base text-foreground/80">
              {evidence.map((snippet, index) => (
                <li key={`${item.id}-evidence-${index}`}>{snippet}</li>
              ))}
            </ul>
          </section>
        )}

        {sources.length > 0 && (
          <section className="mx-auto max-w-4xl space-y-5">
            <Heading level="h2">Weiterführende Quellen</Heading>
            <div className="grid gap-4 sm:grid-cols-2">
              {sources.map((src, index) => (
                <a
                  key={`${item.id}-source-${index}`}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative flex flex-col rounded-2xl border border-border/60 bg-background/80 p-4 text-sm text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-background/90 hover:shadow-lg"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Quelle {index + 1}
                  </span>
                  <span className="mt-2 break-words text-xs text-muted-foreground group-hover:text-foreground/80">
                    {src}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {gallery.length > 0 && (
          <section className="mx-auto max-w-5xl space-y-5">
            <Heading level="h2">Galerie</Heading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((src, index) => (
                <a
                  key={`${item.id}-gallery-${index}`}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative block overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div
                    className="aspect-[4/3] w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                  <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 text-sm font-semibold text-white drop-shadow-lg">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18M3 19h18M5 5l1.5 14h11L19 5" />
                    </svg>
                    Bild {index + 1}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
