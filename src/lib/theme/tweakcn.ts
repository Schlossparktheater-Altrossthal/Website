import { DEFAULT_WEBSITE_THEME } from "@/lib/theme/presets/builtin";

/**
 * Theme-Format kompatibel zu tweakcn.com bzw. shadcn-Registry (`cssVars`).
 * Variablennamen ohne führendes `--`.
 */
export const TWEAKCN_THEME_FORMAT = "tweakcn" as const;

export type ThemeVariables = Record<string, string>;

export type TweakcnTheme = {
  format: typeof TWEAKCN_THEME_FORMAT;
  /** Modusunabhängige Werte (Schriften, Radius, Tracking, Spacing). */
  theme: ThemeVariables;
  light: ThemeVariables;
  dark: ThemeVariables;
};

export type ThemeColorScheme = "light" | "dark";

export const THEME_COLOR_SCHEMES: ThemeColorScheme[] = ["light", "dark"];

const VARIABLE_NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const MAX_VALUE_LENGTH = 400;
const MAX_VARIABLES_PER_GROUP = 200;

/** Werte, die nicht pro Farbmodus variieren und daher in `theme` landen. */
function isThemeLevelVariable(name: string) {
  return (
    name === "radius" ||
    name === "spacing" ||
    name === "letter-spacing" ||
    name.startsWith("font-") ||
    name.startsWith("tracking-")
  );
}

/** Farben, die jedes Theme mindestens braucht (shadcn-Basis). */
export const CORE_COLOR_VARIABLES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
] as const;

/** Eigene Statusfarben des Mitgliederbereichs (nicht Teil von tweakcn). */
export const STATUS_COLOR_VARIABLES = [
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "info",
  "info-foreground",
] as const;

export const CHART_VARIABLES = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;

export const SIDEBAR_VARIABLES = [
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
] as const;

export const SHADOW_VARIABLES = [
  "shadow-2xs",
  "shadow-xs",
  "shadow-sm",
  "shadow",
  "shadow-md",
  "shadow-lg",
  "shadow-xl",
  "shadow-2xl",
] as const;

/** Tailwind-v4-Standardschatten, damit Themes ohne Schatten unverändert aussehen. */
const DEFAULT_SHADOWS: Record<(typeof SHADOW_VARIABLES)[number], string> = {
  "shadow-2xs": "0 1px rgb(0 0 0 / 0.05)",
  "shadow-xs": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  "shadow-sm": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  shadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  "shadow-md": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  "shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  "shadow-xl": "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "shadow-2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
};

export const DEFAULT_THEME_VARIABLES: ThemeVariables = {
  "font-sans": "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  "font-serif": 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  "font-mono": "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  radius: DEFAULT_WEBSITE_THEME.theme.radius,
  "tracking-normal": "0em",
};

/** Ableitungen für fehlende Variablen: Ziel ← Quelle (im selben Modus). */
const DERIVED_VARIABLES: [string, string][] = [
  ["card", "background"],
  ["card-foreground", "foreground"],
  ["popover", "card"],
  ["popover-foreground", "card-foreground"],
  ["input", "border"],
  ["ring", "primary"],
  ["sidebar", "card"],
  ["sidebar-foreground", "card-foreground"],
  ["sidebar-primary", "primary"],
  ["sidebar-primary-foreground", "primary-foreground"],
  ["sidebar-accent", "accent"],
  ["sidebar-accent-foreground", "accent-foreground"],
  ["sidebar-border", "border"],
  ["sidebar-ring", "ring"],
  ["chart-1", "primary"],
  ["chart-2", "secondary"],
  ["chart-3", "accent"],
  ["chart-4", "destructive"],
  ["chart-5", "muted-foreground"],
];

function defaultColors(scheme: ThemeColorScheme): ThemeVariables {
  return { ...DEFAULT_WEBSITE_THEME[scheme] };
}

/**
 * Prüft einen CSS-Wert. Werte landen in einem `<style>`-Tag, daher sind Zeichen verboten,
 * mit denen man aus der Deklaration oder dem Tag ausbrechen oder externe Ressourcen laden kann.
 */
export function sanitiseThemeValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const trimmed = String(value).trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > MAX_VALUE_LENGTH) {
    return null;
  }
  if (/[;{}<>\\]/.test(trimmed) || /url\s*\(|@import|expression\s*\(/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function sanitiseThemeVariables(input: unknown): ThemeVariables {
  const result: ThemeVariables = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return result;
  }
  for (const [rawName, rawValue] of Object.entries(input)) {
    if (Object.keys(result).length >= MAX_VARIABLES_PER_GROUP) {
      break;
    }
    const name = rawName.trim().replace(/^--/, "");
    if (!VARIABLE_NAME_PATTERN.test(name)) {
      continue;
    }
    const value = sanitiseThemeValue(rawValue);
    if (value !== null) {
      result[name] = value;
    }
  }
  return result;
}

export function isTweakcnTheme(value: unknown): value is TweakcnTheme {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).format === TWEAKCN_THEME_FORMAT
  );
}

/** Verschiebt modusunabhängige Werte aus light/dark nach `theme`. */
function normaliseGroups(groups: {
  theme?: unknown;
  light?: unknown;
  dark?: unknown;
}): TweakcnTheme {
  const theme = sanitiseThemeVariables(groups.theme);
  const light = sanitiseThemeVariables(groups.light);
  const dark = sanitiseThemeVariables(groups.dark);

  for (const [name, value] of Object.entries(light)) {
    if (isThemeLevelVariable(name)) {
      theme[name] ??= value;
      delete light[name];
    }
  }
  for (const [name, value] of Object.entries(dark)) {
    if (isThemeLevelVariable(name)) {
      theme[name] ??= value;
      delete dark[name];
    }
  }

  return { format: TWEAKCN_THEME_FORMAT, theme, light, dark };
}

/** Füllt fehlende Variablen auf, damit jedes Theme alle genutzten Tokens liefert. */
export function completeTweakcnTheme(input: TweakcnTheme): TweakcnTheme {
  const theme: ThemeVariables = { ...DEFAULT_THEME_VARIABLES, ...input.theme };
  const result: TweakcnTheme = { format: TWEAKCN_THEME_FORMAT, theme, light: {}, dark: {} };

  for (const scheme of THEME_COLOR_SCHEMES) {
    const fallback = defaultColors(scheme);
    // Fehlt ein Modus komplett (z. B. Theme nur mit :root), dient der andere als Basis.
    const other = scheme === "light" ? input.dark : input.light;
    const own = Object.keys(input[scheme]).length > 0 ? input[scheme] : other;
    const vars: ThemeVariables = { ...own };

    for (const [target, source] of DERIVED_VARIABLES) {
      if (!vars[target] && vars[source]) {
        vars[target] = vars[source];
      }
    }
    for (const name of [...CORE_COLOR_VARIABLES, ...STATUS_COLOR_VARIABLES]) {
      if (!vars[name] && fallback[name]) {
        vars[name] = fallback[name];
      }
    }
    for (const [target, source] of DERIVED_VARIABLES) {
      if (!vars[target] && vars[source]) {
        vars[target] = vars[source];
      }
    }
    for (const name of SHADOW_VARIABLES) {
      vars[name] ??= DEFAULT_SHADOWS[name];
    }
    result[scheme] = vars;
  }

  return result;
}

/** Normalisiert beliebige Eingaben (gespeichertes Theme oder Registry-`cssVars`). */
export function sanitiseTweakcnTheme(value: unknown): TweakcnTheme {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return completeTweakcnTheme(normaliseGroups(record));
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export class ThemeImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThemeImportError";
  }
}

type CssBlock = { selector: string; body: string };

/** Zerlegt CSS in Blöcke der obersten Ebene; `@layer`-Blöcke werden aufgelöst. */
function splitCssBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = -1;
  let selector = "";

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === "{") {
      if (depth === 0) {
        selector = css.slice(selectorStart, index).trim();
        bodyStart = index + 1;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth < 0) {
        throw new ThemeImportError("Das CSS enthält eine schließende Klammer zu viel.");
      }
      if (depth === 0) {
        const body = css.slice(bodyStart, index);
        if (selector.startsWith("@layer")) {
          blocks.push(...splitCssBlocks(body));
        } else {
          blocks.push({ selector, body });
        }
        selectorStart = index + 1;
      }
    } else if (char === ";" && depth === 0) {
      // Top-Level-Anweisungen wie @import ignorieren.
      selectorStart = index + 1;
    }
  }

  if (depth !== 0) {
    throw new ThemeImportError("Das CSS enthält nicht geschlossene Klammern.");
  }
  return blocks;
}

/** Liest Custom Properties der obersten Ebene eines Blocks (verschachtelte @media ignoriert). */
function readCustomProperties(body: string): ThemeVariables {
  let flat = "";
  let depth = 0;
  for (const char of body) {
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      flat += ";";
      continue;
    }
    if (depth === 0) {
      flat += char;
    }
  }

  const result: Record<string, string> = {};
  for (const declaration of flat.split(";")) {
    const match = /^\s*--([a-zA-Z0-9-]+)\s*:\s*([\s\S]+?)\s*$/.exec(declaration);
    if (match) {
      result[match[1].toLowerCase()] = match[2];
    }
  }
  return result;
}

function normaliseSelector(selector: string) {
  return selector.replace(/\s+/g, " ").trim();
}

/** Importiert CSS aus dem tweakcn-Code-Export oder einer Drupal-`theme.css`. */
export function parseThemeCss(css: string): TweakcnTheme {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = splitCssBlocks(withoutComments);

  let light: ThemeVariables = {};
  let dark: ThemeVariables = {};
  for (const block of blocks) {
    const selector = normaliseSelector(block.selector);
    if (selector === ":root" || selector === "html" || selector === ":root, :host") {
      light = { ...light, ...readCustomProperties(block.body) };
    } else if (selector === ".dark" || selector === ":root.dark" || selector === "html.dark") {
      dark = { ...dark, ...readCustomProperties(block.body) };
    }
  }

  if (Object.keys(light).length === 0 && Object.keys(dark).length === 0) {
    throw new ThemeImportError("Im CSS wurden keine :root- oder .dark-Variablen gefunden.");
  }
  return sanitiseTweakcnTheme({ light, dark });
}

/** Importiert ein Registry-Item (`https://tweakcn.com/r/themes/<name>.json`). */
export function parseThemeRegistryItem(json: unknown): TweakcnTheme {
  const record =
    json && typeof json === "object" && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : null;
  const cssVars = record?.cssVars;
  if (!cssVars || typeof cssVars !== "object" || Array.isArray(cssVars)) {
    throw new ThemeImportError("Das JSON enthält keine cssVars (shadcn-Registry-Format).");
  }
  const groups = cssVars as Record<string, unknown>;
  if (!groups.light && !groups.dark) {
    throw new ThemeImportError("Das JSON enthält weder light- noch dark-Variablen.");
  }
  return sanitiseTweakcnTheme({ theme: groups.theme, light: groups.light, dark: groups.dark });
}

/** Erkennt automatisch, ob CSS oder Registry-JSON eingefügt wurde. */
export function parseThemeInput(input: string): TweakcnTheme {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ThemeImportError("Bitte CSS oder JSON einfügen.");
  }
  if (trimmed.startsWith("{") && !trimmed.startsWith("{--")) {
    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch {
      json = undefined;
    }
    if (json !== undefined) {
      return parseThemeRegistryItem(json);
    }
  }
  return parseThemeCss(trimmed);
}

const TWEAKCN_URL_PATTERN =
  /^https:\/\/tweakcn\.com\/(?:r\/themes|themes)\/([a-zA-Z0-9_-]+)(?:\.json)?\/?$/;

/**
 * Liefert die Registry-URL zu einem tweakcn-Link oder `null`, wenn der Link nicht von
 * tweakcn.com stammt. Nur diese Adressen werden serverseitig abgerufen.
 */
export function toTweakcnRegistryUrl(input: string): string | null {
  const match = TWEAKCN_URL_PATTERN.exec(input.trim());
  return match ? `https://tweakcn.com/r/themes/${match[1]}.json` : null;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function toDeclarations(vars: ThemeVariables) {
  return Object.entries(vars)
    .map(([name, value]) => `  --${name}: ${value};`)
    .join("\n");
}

/**
 * Geist wird über `next/font` geladen und ist nur über dessen CSS-Variable erreichbar.
 * Themes (z. B. von tweakcn) nennen die Schrift aber beim Namen.
 */
const FONT_ALIASES: [RegExp, string][] = [
  [/(^|,\s*)["']?Geist Mono["']?(?=\s*(,|$))/gi, "$1var(--font-geist-mono)"],
  [/(^|,\s*)["']?Geist["']?(?=\s*(,|$))/gi, "$1var(--font-geist-sans)"],
];

function resolveFontAliases(vars: ThemeVariables): ThemeVariables {
  return Object.fromEntries(
    Object.entries(vars).map(([name, value]) => [
      name,
      name.startsWith("font-")
        ? FONT_ALIASES.reduce(
            (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
            value,
          )
        : value,
    ]),
  );
}

export type ThemeCssOptions = {
  /** Für die Ausgabe im Mitgliederbereich: Schriftnamen auf lokal geladene Schriften abbilden. */
  resolveFonts?: boolean;
};

/**
 * Erzeugt `:root { … } .dark { … }` im tweakcn-Stil. Ohne `resolveFonts` passt das Ergebnis
 * unverändert als `theme.css` ins Drupal-Theme bzw. in den tweakcn-Import.
 */
export function createTweakcnThemeCss(input: TweakcnTheme, options: ThemeCssOptions = {}) {
  const theme = completeTweakcnTheme(input);
  const themeVars = options.resolveFonts ? resolveFontAliases(theme.theme) : theme.theme;
  return [
    ":root {",
    toDeclarations({ ...themeVars, ...theme.light }),
    "}",
    "",
    ".dark {",
    toDeclarations(theme.dark),
    "}",
    "",
  ].join("\n");
}

/** Registry-Item für den Export nach tweakcn bzw. `shadcn add`. */
export function toThemeRegistryItem(name: string, input: TweakcnTheme) {
  const theme = completeTweakcnTheme(input);
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name,
    type: "registry:style",
    cssVars: { theme: theme.theme, light: theme.light, dark: theme.dark },
  };
}
