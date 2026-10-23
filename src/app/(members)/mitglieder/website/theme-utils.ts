import {
  CHART_VARIABLES,
  CORE_COLOR_VARIABLES,
  SHADOW_VARIABLES,
  SIDEBAR_VARIABLES,
  STATUS_COLOR_VARIABLES,
  TWEAKCN_THEME_FORMAT,
  type ThemeVariables,
  type TweakcnTheme,
} from "@/lib/theme/tweakcn";
import type { ClientWebsiteThemeSummary } from "@/lib/website-settings";

export type VariableGroup = { id: string; label: string; names: readonly string[] };

/** Was die meisten Themes unterscheidet – steht im Editor ganz oben. */
export const KEY_COLOR_VARIABLES = [
  "primary",
  "primary-foreground",
  "background",
  "foreground",
  "secondary",
  "accent",
  "muted",
  "border",
] as const;

export const KNOWN_GROUPS: VariableGroup[] = [
  { id: "core", label: "Alle Grundfarben", names: CORE_COLOR_VARIABLES },
  { id: "status", label: "Statusfarben", names: STATUS_COLOR_VARIABLES },
  { id: "sidebar", label: "Seitenleiste", names: SIDEBAR_VARIABLES },
  { id: "chart", label: "Diagramme", names: CHART_VARIABLES },
  { id: "shadow", label: "Schatten", names: SHADOW_VARIABLES },
];

const KNOWN_VARIABLES = new Set(KNOWN_GROUPS.flatMap((group) => group.names));

export function groupVariables(vars: ThemeVariables): VariableGroup[] {
  const other = Object.keys(vars)
    .filter((name) => !KNOWN_VARIABLES.has(name))
    .sort((a, b) => a.localeCompare(b));
  return other.length > 0
    ? [...KNOWN_GROUPS, { id: "other", label: "Weitere Variablen", names: other }]
    : KNOWN_GROUPS;
}

const VARIABLE_LABELS: Record<string, string> = {
  background: "Hintergrund",
  foreground: "Text",
  card: "Karte",
  "card-foreground": "Text auf Karte",
  popover: "Overlay",
  "popover-foreground": "Text auf Overlay",
  primary: "Primär",
  "primary-foreground": "Text auf Primär",
  secondary: "Sekundär",
  "secondary-foreground": "Text auf Sekundär",
  muted: "Gedämpft",
  "muted-foreground": "Gedämpfter Text",
  accent: "Akzent",
  "accent-foreground": "Text auf Akzent",
  destructive: "Gefahr",
  "destructive-foreground": "Text auf Gefahr",
  border: "Rahmen",
  input: "Feldrahmen",
  ring: "Fokusring",
  success: "Erfolg",
  "success-foreground": "Text auf Erfolg",
  warning: "Warnung",
  "warning-foreground": "Text auf Warnung",
  info: "Info",
  "info-foreground": "Text auf Info",
  sidebar: "Hintergrund",
  "sidebar-foreground": "Text",
  "sidebar-primary": "Primär",
  "sidebar-primary-foreground": "Text auf Primär",
  "sidebar-accent": "Akzent",
  "sidebar-accent-foreground": "Text auf Akzent",
  "sidebar-border": "Rahmen",
  "sidebar-ring": "Fokusring",
};

export function variableLabel(name: string) {
  const chart = /^chart-(\d+)$/.exec(name);
  if (chart) return `Diagramm ${chart[1]}`;
  return VARIABLE_LABELS[name] ?? name;
}

export function toFileSlug(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "theme";
}

/** Entfernt leere Eingaben, damit der Server fehlende Werte wieder ergänzt. */
function compactVariables(vars: ThemeVariables): ThemeVariables {
  return Object.fromEntries(
    Object.entries(vars)
      .map(([name, value]) => [name, value.trim()] as const)
      .filter(([, value]) => value.length > 0),
  );
}

export function buildTheme(draft: TweakcnTheme): TweakcnTheme {
  return {
    format: TWEAKCN_THEME_FORMAT,
    theme: compactVariables(draft.theme),
    light: compactVariables(draft.light),
    dark: compactVariables(draft.dark),
  };
}

/** Standard zuerst, dann Vorlagen, dann eigene Themes alphabetisch. */
export function sortThemeSummaries(
  themes: ClientWebsiteThemeSummary[],
): ClientWebsiteThemeSummary[] {
  return [...themes].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.isPreset !== b.isPreset) return a.isPreset ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function upsertSummary(
  themes: ClientWebsiteThemeSummary[],
  summary: ClientWebsiteThemeSummary,
): ClientWebsiteThemeSummary[] {
  const map = new Map(themes.map((entry) => [entry.id, entry] as const));
  map.set(summary.id, summary);
  return sortThemeSummaries(Array.from(map.values()));
}
