"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { scaleSequential } from "d3-scale";
import { interpolatePuBuGn } from "d3-scale-chromatic";
import type { CallbacksProp, OptionsProp, Props as WordCloudProps, Word } from "react-wordcloud";
import "tippy.js/dist/tippy.css";

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

const ReactWordcloud = dynamic<WordCloudProps>(() => import("react-wordcloud"), { ssr: false });

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

export function InterestsSection({ topTags, wordCloud, coOccurrences, clusters, diversity }: InterestsSectionProps) {
  const words = useMemo<Word[]>(
    () => wordCloud.map((entry) => ({ text: entry.tag, value: entry.weight })),
    [wordCloud],
  );

  const maxWeight = useMemo(() => words.reduce((max, word) => Math.max(max, word.value), 0), [words]);

  const colorScale = useMemo(() => {
    const safeMax = maxWeight > 0 ? maxWeight : 1;
    return scaleSequential(interpolatePuBuGn).domain([0, safeMax]);
  }, [maxWeight]);

  const callbacks = useMemo<CallbacksProp | undefined>(() => {
    if (!words.length) {
      return undefined;
    }
    return {
      getWordColor: (word) => colorScale(word.value),
      getWordTooltip: (word) =>
        `${word.text} – ${word.value.toLocaleString("de-DE")}${word.value === 1 ? " Nennung" : " Nennungen"}`,
    } satisfies CallbacksProp;
  }, [colorScale, words.length]);

  const wordCloudOptions = useMemo<OptionsProp>(() => {
    const maxFont = Math.max(28, Math.min(68, 18 + maxWeight * 3));
    return {
      rotations: 3,
      rotationAngles: [-20, 20],
      fontFamily: "var(--font-sans)",
      fontStyle: "normal",
      fontWeight: "600",
      fontSizes: [14, maxFont],
      padding: 2,
      scale: "sqrt",
      spiral: "rectangular",
      deterministic: true,
      enableTooltip: true,
      enableOptimizations: true,
      transitionDuration: 720,
      tooltipOptions: { placement: "top" },
      colors: ["#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9"],
    } satisfies OptionsProp;
  }, [maxWeight]);

  const topWord = useMemo(() => {
    return wordCloud.length ? [...wordCloud].sort((a, b) => b.weight - a.weight)[0] : undefined;
  }, [wordCloud]);

  const sortedEdges = [...coOccurrences]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <DistributionBars title="Top-Interessen" items={topTags} subtitle="Häufigste Angaben" />
      <Card className="h-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Wordcloud</CardTitle>
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
                <ReactWordcloud words={words} callbacks={callbacks} options={wordCloudOptions} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card className="h-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Diversität</CardTitle>
          <p className="text-sm text-muted-foreground">
            Mischung der Interessensgebiete & Häufigkeit.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={diversity.status === "ok" ? "success" : diversity.status === "warning" ? "warning" : "destructive"}>
              {diversity.status === "ok" ? "sehr vielfältig" : diversity.status === "warning" ? "ausbalanciert" : "monoton"}
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
                  <span className="text-sm font-medium">{cluster.value.toLocaleString("de-DE")}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card className="xl:col-span-3">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Co-Occurrences</CardTitle>
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
