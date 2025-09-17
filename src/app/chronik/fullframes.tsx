"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ChronikMeta = {
  author?: string | null;
  director?: string | null;
  venue?: string | null;
  ticket_info?: string | null;
  sources?: unknown;
  gallery?: unknown;
};

type ChronikItem = {
  id: string;
  year: number;
  title?: string | null;
  synopsis?: string | null;
  posterUrl?: string | null;
  meta?: ChronikMeta | null;
};

function toStringArray(value: unknown, limit?: number) {
  if (!Array.isArray(value)) return [] as string[];
  const entries = value.filter((entry): entry is string => typeof entry === "string");
  return typeof limit === "number" ? entries.slice(0, limit) : entries;
}

export function ChronikFullframes({ items }: { items: ChronikItem[] }) {
  const sorted = useMemo(() => [...items].sort((a, b) => b.year - a.year), [items]);
  const [active, setActive] = useState(sorted[0]?.id);
  const [reducedMotion, setReducedMotion] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    const sections = Object.values(sectionRefs.current).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        let candidate: string | null = null;
        let best = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (e.intersectionRatio > best) {
            best = e.intersectionRatio;
            candidate = e.target.getAttribute("data-id");
          }
        }
        if (candidate && candidate !== active) {
          // batch state updates to next frame
          requestAnimationFrame(() => setActive(candidate!));
        }
      },
      { root: null, threshold: [0.4, 0.6, 0.8] }
    );
    sections.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sorted, active]);

  const scrollTo = useCallback(
    (id: string) => {
      const el = sectionRefs.current[id];
      if (el) {
        el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      }
    },
    [reducedMotion]
  );

  return (
    <div className="relative lg:grid lg:grid-cols-[11rem_1fr] lg:gap-6">
      {/* Side timeline */}
      <aside className="hidden lg:block sticky top-28 self-start h-[calc(100vh-7rem)]" aria-label="Zeitleiste">
        <ol className="relative pl-4 pr-2">
          <div className="absolute left-1 top-0 bottom-0 w-px bg-border/60" aria-hidden />
          {sorted.map((s) => {
            const current = s.id === active;
            return (
              <li key={s.id} className="relative mb-3 last:mb-0">
                <button
                  onClick={() => scrollTo(s.id)}
                  aria-current={current ? "true" : undefined}
                  className={`group relative flex w-full items-center gap-2 pl-4 text-sm transition-colors ${
                    current ? "text-primary" : "text-foreground/80 hover:text-primary"
                  }`}
                >
                  <span
                    className={`absolute left-0 inline-flex h-2.5 w-2.5 rounded-full ${
                      current ? "bg-primary" : "bg-border"
                    }`}
                    aria-hidden
                  />
                  {s.year}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Fullframe sections */}
      <div className="lg:col-start-2 snap-y snap-mandatory">
        {sorted.map((s, idx) => {
          const meta: ChronikMeta = s.meta ?? {};
          const sources = toStringArray(meta.sources, 3);
          const gallery = toStringArray(meta.gallery, 6);
          return (
            <section
              key={s.id}
              id={s.id}
              data-id={s.id}
              ref={(el) => (sectionRefs.current[s.id] = el)}
              className="relative min-h-screen grid place-items-stretch overflow-hidden snap-start"
            >
              {/* Background image */}
              {s.posterUrl && (
                <div className="absolute inset-0 -z-10">
                  <Image
                    src={s.posterUrl}
                    alt={s.title ?? String(s.year)}
                    fill
                    className="object-cover"
                    priority={idx === 0}
                  />
                </div>
              )}
              {/* Mystic overlays for readability */}
              <div className="absolute inset-0 -z-0 bg-gradient-to-b from-background/80 via-background/60 to-background/80" />
              <div className="absolute inset-0 -z-0 bg-[radial-gradient(60rem_30rem_at_20%_-10%,_color-mix(in_oklab,var(--primary)_16%,transparent),transparent_65%)] pointer-events-none" />

              <div className="container mx-auto py-16 md:py-24 grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-2">
                  <div className="text-sm text-foreground/80">{s.year}</div>
                  <h2 className="text-3xl md:text-4xl font-serif">{s.title ?? `Saison ${s.year}`}</h2>
                  {meta?.author && <div className="text-sm text-foreground/80">Autor: {meta.author}</div>}
                  {meta?.director && <div className="text-sm text-foreground/80">Regie: {meta.director}</div>}
                  {meta?.venue && <div className="text-sm text-foreground/80">Ort: {meta.venue}</div>}
                  {s.synopsis && <p className="mt-3 max-w-prose text-foreground/85">{s.synopsis}</p>}
                  <div className="flex flex-wrap gap-2 pt-3">
                    {sources.map((src, i) => (
                        <a
                          key={i}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded border border-border/60 bg-card/70 px-2 py-1 text-xs hover:bg-accent/30"
                        >
                          Quelle {i + 1}
                        </a>
                      ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {gallery.length > 0 ? (
                    gallery.map((url, i) => {
                      const isImg = /\.(jpg|jpeg|png|webp|avif)$/i.test(url) || /picsum\.photos/.test(url);
                      return (
                        <div key={i} className="relative h-28 sm:h-32 md:h-36 rounded overflow-hidden border border-border/40">
                          {isImg ? (
                            <Image src={url} alt={`${s.title ?? s.year} – Bild ${i + 1}`} fill className="object-cover" />
                          ) : (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm hover:underline"
                              aria-label={`Externer Link: ${url}`}
                            >
                              Link öffnen
                            </a>
                          )}
                        </div>
                      );
                    })
                  ) : s.posterUrl ? (
                    <div className="relative col-span-2 sm:col-span-3 h-56 md:h-72 rounded overflow-hidden border border-border/40">
                      <Image src={s.posterUrl} alt={s.title ?? String(s.year)} fill className="object-cover" />
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
