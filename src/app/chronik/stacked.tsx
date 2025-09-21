"use client";
import { useState } from "react";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { PosterSlideshow } from "./poster-slideshow";

type ChronikCastEntry = {
  role: string;
  players: string[];
};

type ChronikMeta = {
  author?: string | null;
  director?: string | null;
  venue?: string | null;
  ticket_info?: string | null;
  sources?: unknown;
  gallery?: unknown;
  cast?: ChronikCastEntry[] | null;
};

type ChronikItem = {
  id: string;
  year: number;
  title?: string | null;
  synopsis?: string | null;
  posterUrl?: string | string[] | null;
  meta?: ChronikMeta | null;
};

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function toCastEntries(value: ChronikMeta["cast"]) {
  if (!Array.isArray(value)) {
    return [] as ChronikCastEntry[];
  }

  return value.filter(
    (entry): entry is ChronikCastEntry =>
      Boolean(entry) &&
      typeof entry.role === "string" &&
      Array.isArray(entry.players) &&
      entry.players.length > 0,
  );
}

function formatPlayerName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }

  const lastName = parts.pop() ?? "";
  const lastInitial = lastName.charAt(0);
  const firstNames = parts.join(" ");
  if (!lastInitial) {
    return trimmed;
  }

  return `${firstNames} ${lastInitial}.`;
}

function toPosterSources(value: ChronikItem["posterUrl"]) {
  if (!value) {
    return [] as string[];
  }

  const sources = Array.isArray(value) ? value : [value];
  return sources
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => entry.length > 0);
}

function ChronikStackedCard({ item, index }: { item: ChronikItem; index: number }) {
  const meta: ChronikMeta = item.meta ?? {};
  const sources = toStringArray(meta.sources);
  const castEntries = toCastEntries(meta.cast);
  const posterSources = toPosterSources(item.posterUrl);
  const isBunburySeason = item.id === "altrossthal-2024";
  const [isCastVisible, setIsCastVisible] = useState(() => !isBunburySeason);
  const castListId = `chronik-${item.id}-cast`;

  return (
    <section
      id={item.id}
      className="group relative overflow-hidden rounded-2xl border border-border/60 shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-3xl sm:rounded-3xl"
    >
      <div className="relative h-[60vh] sm:h-[70vh] lg:h-[75vh] xl:h-[65vh] 2xl:h-[60vh] w-full max-h-[800px]">
        {posterSources.length > 0 && (
          <PosterSlideshow
            sources={posterSources}
            alt={item.title ?? String(item.year)}
            priority={index === 0}
          />
        )}
        {/* Enhanced overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:color-mix(in_oklab,var(--foreground)_70%,transparent)] via-[color:color-mix(in_oklab,var(--foreground)_30%,transparent)] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60rem_40rem_at_30%_70%,_color-mix(in_oklab,var(--primary)_12%,transparent),transparent_80%)]" />

        <div className="absolute inset-0 flex items-end">
          <div className="w-full p-6 sm:p-8">
            <div className="mx-auto max-w-5xl rounded-2xl border border-border/60 bg-background/70 p-5 shadow-2xl backdrop-blur transition-all duration-500 group-hover:bg-background/80 sm:p-6 lg:p-8 xl:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {item.year}
              </div>
              <Heading
                level="h2"
                className="mt-4 max-w-4xl text-balance leading-tight [text-shadow:_0_0_14px_rgba(0,0,0,0.55)]"
              >
                {item.title ?? `Saison ${item.year}`}
              </Heading>

              <div className="mt-6 grid gap-x-8 gap-y-3 text-foreground/90 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-3">
                {meta?.author && (
                  <div className="flex items-center gap-2 text-sm [text-shadow:_1px_1px_3px_rgba(0,0,0,0.5)]">
                    <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="font-medium">Autor:</span> {meta.author}
                  </div>
                )}
                {meta?.director && (
                  <div className="flex items-center gap-2 text-sm [text-shadow:_1px_1px_3px_rgba(0,0,0,0.5)]">
                    <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V3a1 1 0 011 1v10a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1V2" />
                    </svg>
                    <span className="font-medium">Regie:</span> {meta.director}
                  </div>
                )}
                {meta?.venue && (
                  <div className="flex items-center gap-2 text-sm [text-shadow:_1px_1px_3px_rgba(0,0,0,0.5)]">
                    <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium">Ort:</span> {meta.venue}
                  </div>
                )}
                {meta?.ticket_info && (
                  <div className="flex items-center gap-2 text-sm [text-shadow:_1px_1px_3px_rgba(0,0,0,0.5)]">
                    <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    <span className="font-medium">Tickets:</span> {meta.ticket_info}
                  </div>
                )}
              </div>

              {item.synopsis && (
                <Text className="mt-6 max-w-4xl text-base leading-relaxed text-foreground/90 [text-shadow:_1px_1px_3px_rgba(0,0,0,0.45)] lg:text-lg xl:text-xl">
                  {item.synopsis}
                </Text>
              )}
              {castEntries.length > 0 && (
                <div className="mt-6 text-left">
                  {isBunburySeason ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsCastVisible((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-5 py-4 text-left shadow-inner backdrop-blur-sm transition-all duration-200 hover:border-primary/50 hover:bg-background/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-expanded={isCastVisible}
                        aria-controls={castListId}
                      >
                        <span className="flex flex-col text-left">
                          <Heading level="h3" asChild>
                            <span className="text-lg font-semibold text-foreground [text-shadow:_1px_1px_3px_rgba(0,0,0,0.35)] sm:text-xl">
                              Ensemble
                            </span>
                          </Heading>
                          <Text variant="small" tone="muted" asChild>
                            <span className="mt-1 text-left [text-shadow:_1px_1px_3px_rgba(0,0,0,0.25)]">
                              {isCastVisible ? "Tippen, um Rollen auszublenden" : "Tippen, um Rollen anzuzeigen"}
                            </span>
                          </Text>
                        </span>
                        <svg
                          className={cn(
                            "h-5 w-5 text-primary transition-transform duration-300",
                            isCastVisible ? "rotate-180" : "rotate-0",
                          )}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isCastVisible && (
                        <dl id={castListId} className="mt-4 grid gap-3 sm:grid-cols-2">
                          {castEntries.map((entry, entryIndex) => (
                            <div
                              key={`${entry.role}-${entryIndex}`}
                              className="rounded-xl border border-border/50 bg-background/70 p-3 shadow-inner backdrop-blur-sm"
                            >
                              <dt className="text-sm font-semibold text-foreground">
                                {entry.role}
                              </dt>
                              <dd className="mt-1 text-sm text-foreground/80">
                                {entry.players.map((player) => formatPlayerName(player)).filter(Boolean).join(", ")}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </>
                  ) : (
                    <>
                      <Heading
                        level="h3"
                        className="text-lg font-semibold text-foreground [text-shadow:_1px_1px_3px_rgba(0,0,0,0.35)] sm:text-xl"
                      >
                        Ensemble
                      </Heading>
                      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                        {castEntries.map((entry, entryIndex) => (
                          <div
                            key={`${entry.role}-${entryIndex}`}
                            className="rounded-xl border border-border/50 bg-background/70 p-3 shadow-inner backdrop-blur-sm"
                          >
                            <dt className="text-sm font-semibold text-foreground">
                              {entry.role}
                            </dt>
                            <dd className="mt-1 text-sm text-foreground/80">
                              {entry.players.map((player) => formatPlayerName(player)).filter(Boolean).join(", ")}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                </div>
              )}
              {sources.length > 0 && (
                <div className="mt-8 flex flex-wrap gap-3">
                  {sources.slice(0, 3).map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-4 py-2 text-sm text-foreground transition-all duration-200 hover:scale-105 hover:border-primary/50 hover:bg-background/80 backdrop-blur-sm"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Quelle {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ChronikStacked({ items }: { items: ChronikItem[] }) {
  const sorted = [...items].sort((a, b) => b.year - a.year);

  return (
    <div className="layout-container space-y-12 pb-24 lg:space-y-16">
      {sorted.map((item, index) => (
        <ChronikStackedCard key={item.id} item={item} index={index} />
      ))}
    </div>
  );
}

