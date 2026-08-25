"use client";

import { motion } from "framer-motion";
import { scaleSequential } from "d3-scale";
import { interpolatePuBuGn } from "d3-scale-chromatic";
import cloud, { type Word as CloudWord } from "d3-cloud";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { z } from "zod";

import {
  clusterNodeSchema,
  coOccurrenceEdgeSchema,
  diversityMetricSchema,
  distributionEntrySchema,
} from "@/lib/onboarding/dashboard-schemas";

import { DistributionBars } from "./distribution-bars";

type WordCloudWord = { text: string; value: number };

type InterestsSectionProps = {
  topTags: Array<z.infer<typeof distributionEntrySchema>>;
  wordCloud: Array<{ tag: string; weight: number }>;
  coOccurrences: Array<z.infer<typeof coOccurrenceEdgeSchema>>;
  clusters: Array<z.infer<typeof clusterNodeSchema>>;
  diversity: z.infer<typeof diversityMetricSchema>;
};

const clusterColors: Record<string, string> = {
  schauspiel: "from-rose-500/60 to-rose-500/15",
  technik: "from-sky-500/60 to-sky-500/15",
  musik: "from-indigo-500/60 to-indigo-500/15",
  orga: "from-emerald-500/60 to-emerald-500/15",
  allgemein: "from-amber-500/60 to-amber-500/15",
};

export function InterestsSection({
  topTags,
  wordCloud,
  coOccurrences,
  clusters,
  diversity,
}: InterestsSectionProps) {
  const words = useMemo<WordCloudWord[]>(() => {
    return wordCloud
      .map((entry) => ({ text: entry.tag, value: Number(entry.weight) || 0 }))
      .filter((entry) => Number.isFinite(entry.value) && entry.value >= 0);
  }, [wordCloud]);

  const maxWeight = useMemo(
    () => words.reduce((max, word) => Math.max(max, word.value), 0),
    [words],
  );

  const colorScale = useMemo(() => {
    const safeMax = maxWeight > 0 ? maxWeight : 1;
    return scaleSequential(interpolatePuBuGn).domain([0, safeMax]);
  }, [maxWeight]);

  const maxFont = useMemo(() => Math.max(28, Math.min(68, 18 + maxWeight * 3)), [maxWeight]);

  const topWord = useMemo(() => {
    return wordCloud.length ? [...wordCloud].sort((a, b) => b.weight - a.weight)[0] : undefined;
  }, [wordCloud]);

  const sortedEdges = [...coOccurrences].sort((a, b) => b.weight - a.weight).slice(0, 8);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <DistributionBars title="Top-Interessen" items={topTags} subtitle="Häufigste Angaben" />
      <Card className="h-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
            Wordcloud
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Schriftgröße entspricht relativer Häufigkeit der Nennung.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {words.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Interessen hinterlegt.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                {topWord ? (
                  <span className="flex items-center gap-2">
                    dominant:
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"
                    >
                      {topWord.tag}
                    </motion.span>
                    <span className="text-xs text-muted-foreground/80">
                      {topWord.weight.toLocaleString("de-DE")}
                      {topWord.weight === 1 ? " Nennung" : " Nennungen"}
                    </span>
                  </span>
                ) : null}
                <span>{words.length} Stichwörter</span>
              </div>
              <div className="relative h-[300px] w-full overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-background via-muted/40 to-background p-2">
                <WordCloudCanvas
                  words={words}
                  maxWeight={maxWeight}
                  maxFont={maxFont}
                  colorScale={colorScale}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card className="h-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
            Diversität
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Mischung der Interessensgebiete & Häufigkeit.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant={
                diversity.status === "ok"
                  ? "success"
                  : diversity.status === "warning"
                    ? "warning"
                    : "destructive"
              }
            >
              {diversity.status === "ok"
                ? "sehr vielfältig"
                : diversity.status === "warning"
                  ? "ausbalanciert"
                  : "monoton"}
            </Badge>
            <span className="text-sm text-muted-foreground">{diversity.explanation}</span>
          </div>
          <dl className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Shannon</dt>
              <dd className="font-medium">{diversity.shannon.toFixed(2)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Gini</dt>
              <dd className="font-medium">{diversity.gini.toFixed(2)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Normalisiert</dt>
              <dd className="font-medium">{(diversity.normalized * 100).toFixed(0)}%</dd>
            </div>
          </dl>
          <div className="grid gap-2">
            {clusters.map((cluster) => {
              const gradient = clusterColors[cluster.id] ?? clusterColors.allgemein;
              return (
                <div
                  key={cluster.id}
                  className={`flex items-center justify-between rounded-xl border border-border/40 bg-gradient-to-r ${gradient} px-3 py-2`}
                >
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground/85">
                    {cluster.label}
                  </span>
                  <span className="text-sm font-medium">
                    {cluster.value.toLocaleString("de-DE")}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card className="xl:col-span-3">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
            Co-Occurrences
          </CardTitle>
          <p className="text-sm text-muted-foreground">Gemeinsame Tags pro Person (Top 8).</p>
        </CardHeader>
        <CardContent>
          {sortedEdges.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Kombinationen erfasst.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {sortedEdges.map((edge, index) => (
                <motion.div
                  key={`${edge.source}-${edge.target}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                    <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs uppercase tracking-[0.12em]">
                      {edge.source}
                    </span>
                    <span className="text-muted-foreground">×</span>
                    <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs uppercase tracking-[0.12em]">
                      {edge.target}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">{edge.weight}</span>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type WordCloudCanvasProps = {
  words: WordCloudWord[];
  maxWeight: number;
  maxFont: number;
  colorScale: (value: number) => string;
};

type LayoutWord = CloudWord & WordCloudWord;

const MIN_FONT_SIZE = 14;
const ROTATION_VALUES = [-20, 0, 20] as const;

function WordCloudCanvas({ words, maxWeight, maxFont, colorScale }: WordCloudCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [layoutWords, setLayoutWords] = useState<LayoutWord[]>([]);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height || words.length === 0) {
      setLayoutWords([]);
      setHasError(false);
      return undefined;
    }

    let cancelled = false;
    try {
      const layout = cloud<LayoutWord>()
        .size([
          Math.max(1, Math.floor(dimensions.width)),
          Math.max(1, Math.floor(dimensions.height)),
        ])
        .words(words.map((word) => ({ ...word })) as LayoutWord[])
        .padding(2)
        .rotate((datum) => computeRotation(datum.text ?? ""))
        .font("var(--font-sans)")
        .fontStyle("normal")
        .fontWeight("600")
        .fontSize((datum) => computeFontSize(datum.value ?? 0, maxWeight, maxFont))
        .random(createDeterministicRandom("interests-wordcloud"));

      layout.on("end", (generated) => {
        if (cancelled) {
          return;
        }
        setLayoutWords(generated.map((item) => ({ ...item, text: item.text ?? "" })));
        setHasError(false);
      });

      layout.start();

      return () => {
        cancelled = true;
        layout.stop();
      };
    } catch (error) {
      console.error("[onboarding.interests.wordcloud]", error);
      setHasError(true);
      return undefined;
    }
  }, [dimensions.height, dimensions.width, maxFont, maxWeight, words]);

  const width = Math.max(1, Math.floor(dimensions.width));
  const height = Math.max(1, Math.floor(dimensions.height));

  if (hasError) {
    return (
      <div ref={containerRef} className="flex h-full w-full items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">
          Wordcloud konnte nicht geladen werden. Bitte neu laden oder später erneut versuchen.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <svg
        role="img"
        aria-label="Wordcloud der Interessen"
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${width / 2}, ${height / 2})`}>
          {layoutWords.map((word) => {
            const rotation = word.rotate ?? 0;
            const tooltip = `${word.text} – ${word.value.toLocaleString("de-DE")}${
              word.value === 1 ? " Nennung" : " Nennungen"
            }`;
            return (
              <text
                key={`${word.text}-${word.x ?? 0}-${word.y ?? 0}-${word.size ?? 0}`}
                textAnchor="middle"
                fontFamily="var(--font-sans)"
                fontWeight={600}
                fontStyle="normal"
                fontSize={word.size ?? MIN_FONT_SIZE}
                fill={colorScale(word.value)}
                transform={`translate(${word.x ?? 0}, ${word.y ?? 0}) rotate(${rotation})`}
              >
                <title>{tooltip}</title>
                {word.text}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function computeFontSize(value: number, maxWeight: number, maxFont: number) {
  if (!Number.isFinite(value) || maxWeight <= 0) {
    return MIN_FONT_SIZE;
  }

  if (maxFont <= MIN_FONT_SIZE) {
    return MIN_FONT_SIZE;
  }

  const ratio = value / maxWeight;
  return MIN_FONT_SIZE + ratio * (maxFont - MIN_FONT_SIZE);
}

function computeRotation(text: string) {
  if (!text) {
    return 0;
  }

  const index = Math.abs(hashString(text)) % ROTATION_VALUES.length;
  return ROTATION_VALUES[index];
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

function createDeterministicRandom(seed: string) {
  let state = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 3432918353);
    state = (state << 13) | (state >>> 19);
  }

  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    state ^= state >>> 16;
    return (state >>> 0) / 4294967296;
  };
}
