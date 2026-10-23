import type { TweakcnTheme } from "@/lib/theme/tweakcn";
import type { ClientWebsiteTheme, ClientWebsiteThemeSummary } from "@/lib/website-settings";

const SWATCH_KEYS = [
  "background",
  "foreground",
  "card",
  "primary",
  "secondary",
  "accent",
  "muted",
  "border",
] as const;

export type ThemeSwatch = Record<(typeof SWATCH_KEYS)[number], string>;

/** Wenige Farben je Modus für Vorschaukarten. */
export type ThemeSwatches = { light: ThemeSwatch; dark: ThemeSwatch };

export function toThemeSwatches(tokens: TweakcnTheme): ThemeSwatches {
  const pick = (vars: Record<string, string>) =>
    Object.fromEntries(SWATCH_KEYS.map((key) => [key, vars[key] ?? "transparent"])) as ThemeSwatch;
  return { light: pick(tokens.light), dark: pick(tokens.dark) };
}

/** Listen-Zusammenfassung aus einem vollständigen Theme (Server und Browser). */
export function summarizeClientWebsiteTheme(theme: ClientWebsiteTheme): ClientWebsiteThemeSummary {
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    isDefault: theme.isDefault,
    isPreset: theme.isPreset,
    memberSelectable: theme.memberSelectable,
    swatches: toThemeSwatches(theme.tokens),
    radius: theme.tokens.theme.radius ?? "0.5rem",
    updatedAt: theme.updatedAt,
  };
}
