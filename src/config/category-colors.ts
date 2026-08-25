/**
 * Zentrale Identitäts- und Kategoriefarben.
 *
 * Rollen, Gewerke und Interessen besitzen bewusst feste Identitätsfarben, die
 * sich nicht über die Status-Tokens (success/warning/destructive) abbilden
 * lassen. Diese Datei ist der einzige Ort, an dem diese Farben gepflegt werden.
 * Änderungen wirken sich dadurch konsistent auf alle Verwendungsstellen aus.
 *
 * TODO(design): Sobald das Design-System eigene Kategorie-Tokens besitzt,
 * diese Zuordnungen auf semantische Tokens umstellen.
 */

/** Badge-Farben für den Onboarding-Fokus (Schauspiel / Gewerke / beides). */
export const FOCUS_BADGE_STYLES: Record<"acting" | "tech" | "both", string> = {
  acting: "border-violet-400/40 bg-violet-500/10 text-violet-600",
  tech: "border-cyan-400/40 bg-cyan-500/10 text-cyan-600",
  both: "border-indigo-400/40 bg-indigo-500/10 text-indigo-600",
};

/** Verlaufs-Akzente für Fokus-Karten (Schauspiel / Gewerke). */
export const FOCUS_ACCENT_STYLES: Record<"acting" | "crew", string> = {
  acting: "from-violet-500/70 to-fuchsia-500/70",
  crew: "from-cyan-500/70 to-teal-500/70",
};

/** Verlaufs-Farben für Interessen-Cluster in der Wortwolken-Auswertung. */
export const INTEREST_CLUSTER_STYLES: Record<string, string> = {
  schauspiel: "from-rose-500/60 to-rose-500/15",
  technik: "from-sky-500/60 to-sky-500/15",
  musik: "from-indigo-500/60 to-indigo-500/15",
  orga: "from-emerald-500/60 to-emerald-500/15",
  allgemein: "from-amber-500/60 to-amber-500/15",
};

/** Badge-Farben für Ranking-Rollen (Schauspiel- und Crew-Untergruppen). */
export const RANKING_ROLE_STYLES: Record<string, string> = {
  acting_lead: "border-amber-400/60 bg-amber-500/10 dark:border-amber-400/40 dark:bg-amber-500/5",
  acting_medium:
    "border-orange-400/60 bg-orange-500/10 dark:border-orange-400/40 dark:bg-orange-500/5",
  acting_scout:
    "border-emerald-400/60 bg-emerald-500/10 dark:border-emerald-400/40 dark:bg-emerald-500/5",
  acting_statist: "border-primary/60 bg-primary/10 dark:border-primary/40 dark:bg-primary/5",
  crew_stage:
    "border-purple-400/55 bg-purple-500/10 dark:border-purple-400/40 dark:bg-purple-500/5",
  crew_tech: "border-cyan-400/55 bg-cyan-500/10 dark:border-cyan-400/40 dark:bg-cyan-500/5",
  crew_costume: "border-pink-400/55 bg-pink-500/10 dark:border-pink-400/40 dark:bg-pink-500/5",
  crew_makeup: "border-rose-400/55 bg-rose-500/10 dark:border-rose-400/40 dark:bg-rose-500/5",
  crew_direction:
    "border-indigo-400/55 bg-indigo-500/10 dark:border-indigo-400/40 dark:bg-indigo-500/5",
  crew_music: "border-lime-400/55 bg-lime-500/10 dark:border-lime-400/40 dark:bg-lime-500/5",
  crew_props: "border-teal-400/55 bg-teal-500/10 dark:border-teal-400/40 dark:bg-teal-500/5",
  crew_marketing:
    "border-amber-300/55 bg-amber-400/10 dark:border-amber-300/40 dark:bg-amber-400/5",
  default: "border-border/60 bg-muted/30",
};
