import { tv } from "tailwind-variants";

export type TimelineTone = "blocked" | "limited" | "holiday" | "free" | "preferred";

export type TimelineLegendItem = {
  id: string;
  label: string;
  description: string;
  tone: Exclude<TimelineTone, "preferred">;
};

export const timelineLegendItems: readonly TimelineLegendItem[] = [
  {
    id: "blocked",
    tone: "blocked",
    label: "Gesperrt",
    description: "Eingetragene Abwesenheiten – Details per Klick",
  },
  {
    id: "limited",
    tone: "limited",
    label: "Eingeschränkt",
    description: "Teilnahme nur in bestimmten Zeitfenstern",
  },
  {
    id: "holiday",
    tone: "holiday",
    label: "Ferien & Feiertage",
    description: "Automatisch importierte Kalenderdaten",
  },
  {
    id: "free",
    tone: "free",
    label: "Frei",
    description: "Keine Konflikte gemeldet",
  },
] as const;

export const timelineToneStyles = tv({
  slots: {
    legendContainer:
      "flex items-center gap-2 rounded-lg border border-border/60 bg-card/90 px-3 py-2 shadow-sm transition-colors",
    legendSwatch: "h-8 w-8 shrink-0 rounded-md border border-border/60 bg-muted/60 transition-colors",
    legendLabel: "text-xs font-semibold uppercase tracking-wide text-foreground/90",
    legendDescription: "text-[11px] leading-5 text-muted-foreground/80",
    bullet: "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
    text: "transition-colors",
  },
  variants: {
    tone: {
      blocked: {
        legendContainer: "border-destructive/60 bg-destructive/10 text-destructive/90",
        legendSwatch: "border-destructive/70 bg-destructive/60",
        legendLabel: "text-destructive",
        legendDescription: "text-destructive/80",
        bullet: "bg-destructive",
        text: "text-destructive/90",
      },
      limited: {
        legendContainer: "border-amber-400/60 bg-amber-200/30 text-amber-900 dark:text-amber-100",
        legendSwatch: "border-amber-400/60 bg-amber-300/70 dark:bg-amber-400/60",
        legendLabel: "text-amber-900 dark:text-amber-100",
        legendDescription: "text-amber-900/80 dark:text-amber-100/80",
        bullet: "bg-amber-500",
        text: "text-amber-800 dark:text-amber-100",
      },
      holiday: {
        legendContainer: "border-sky-400/60 bg-sky-300/20 text-sky-800 dark:text-sky-200",
        legendSwatch: "border-sky-400/60 bg-sky-400/60",
        legendLabel: "text-sky-800 dark:text-sky-200",
        legendDescription: "text-sky-700/80 dark:text-sky-200/80",
        bullet: "bg-sky-500",
        text: "text-sky-700 dark:text-sky-200",
      },
      preferred: {
        legendContainer: "border-emerald-400/60 bg-emerald-300/20 text-emerald-800 dark:text-emerald-200",
        legendSwatch: "border-emerald-400/60 bg-emerald-400/60",
        legendLabel: "text-emerald-800 dark:text-emerald-200",
        legendDescription: "text-emerald-700/80 dark:text-emerald-200/80",
        bullet: "bg-emerald-500",
        text: "text-emerald-700 dark:text-emerald-200",
      },
      free: {
        legendContainer: "border-border/60 bg-muted/40 text-muted-foreground",
        legendSwatch: "border-border/60 bg-muted/70",
        legendLabel: "text-foreground/80",
        legendDescription: "text-muted-foreground/80",
        bullet: "bg-muted-foreground/70",
        text: "text-muted-foreground",
      },
    },
  },
});
