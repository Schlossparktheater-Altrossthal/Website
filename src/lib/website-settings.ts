import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_WEBSITE_THEME,
  FESTIVAL_LIGHTS_THEME,
  FOREST_CANOPY_THEME,
  NIGHT_SKY_THEME,
  PASTEL_DREAM_THEME,
  SUNSET_GLOW_THEME,
  VELVET_SPOTLIGHT_THEME,
} from "@/lib/theme/presets/builtin";
import { SOMMERTHEATER_DRUPAL_THEME_CSS } from "@/lib/theme/presets/sommertheater-drupal";
import {
  isTweakcnTheme,
  parseThemeCss,
  sanitiseTweakcnTheme,
  type TweakcnTheme,
} from "@/lib/theme/tweakcn";
import type { Prisma, WebsiteSettings, WebsiteTheme } from "@prisma/client";

export const DEFAULT_THEME_ID = "default-website-theme" as const;
export const DEFAULT_WEBSITE_SETTINGS_ID = "public" as const;
export const DEFAULT_SITE_TITLE = "Sommertheater Altrossthal" as const;
export const DEFAULT_COLOR_MODE = "dark" as const;
export const DEFAULT_MAINTENANCE_MODE = false as const;

export type PageVisibilitySettings = {
  pages: {
    general: boolean;
    maintenance: boolean;
    websiteTheme: boolean;
  };
  public: {
    about: boolean;
    mystery: boolean;
    schoolCat: boolean;
    timeline: boolean;
  };
  members: Record<string, boolean>;
  categories: {
    dateisystem: {
      enabled: boolean;
      archive: boolean;
      images: boolean;
      timeline: boolean;
      data: boolean;
    };
  };
};

export const DEFAULT_PAGE_VISIBILITY: PageVisibilitySettings = {
  pages: { general: true, maintenance: true, websiteTheme: true },
  public: { about: true, mystery: true, schoolCat: true, timeline: true },
  members: {},
  categories: {
    dateisystem: { enabled: true, archive: true, images: true, timeline: true, data: true },
  },
};

function sanitisePageVisibility(input: unknown): PageVisibilitySettings {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const pages =
    source.pages && typeof source.pages === "object"
      ? (source.pages as Record<string, unknown>)
      : {};
  const publicPages =
    source.public && typeof source.public === "object"
      ? (source.public as Record<string, unknown>)
      : {};
  const members =
    source.members && typeof source.members === "object"
      ? (source.members as Record<string, unknown>)
      : {};
  const categories =
    source.categories && typeof source.categories === "object"
      ? (source.categories as Record<string, unknown>)
      : {};
  const dateisystem =
    categories.dateisystem && typeof categories.dateisystem === "object"
      ? (categories.dateisystem as Record<string, unknown>)
      : {};
  const pick = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    pages: {
      general: pick(pages.general, true),
      maintenance: pick(pages.maintenance, true),
      websiteTheme: pick(pages.websiteTheme, true),
    },
    public: {
      about: pick(publicPages.about, true),
      mystery: pick(publicPages.mystery, true),
      schoolCat: pick(publicPages.schoolCat, true),
      timeline: pick(publicPages.timeline, true),
    },
    members: Object.fromEntries(
      Object.entries(members).map(([key, value]) => [key, pick(value, true)]),
    ),
    categories: {
      dateisystem: {
        enabled: pick(dateisystem.enabled, true),
        archive: pick(dateisystem.archive, true),
        images: pick(dateisystem.images, true),
        timeline: pick(dateisystem.timeline, true),
        data: pick(dateisystem.data, true),
      },
    },
  };
}
export const THEME_COLOR_MODES = ["light", "dark", "system"] as const;
export type ThemeColorMode = (typeof THEME_COLOR_MODES)[number];

/** Frühere Speicherform (Farbfamilien + berechnete `modes`), nur noch zum Lesen. */
type LegacyStoredTheme = {
  radius?: { base?: unknown };
  modes?: { light?: unknown; dark?: unknown };
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type WebsiteThemePresetDefinition = {
  id: string;
  name: string;
  description: string;
  tokens: TweakcnTheme;
};

export const SOMMERTHEATER_DRUPAL_THEME_ID = "sommertheater-drupal" as const;

const PRESET_THEME_DEFINITIONS: WebsiteThemePresetDefinition[] = [
  {
    id: SOMMERTHEATER_DRUPAL_THEME_ID,
    name: "Sommertheater (Drupal)",
    description: "Gleiches Theme wie die öffentliche Drupal-Website (theme.css).",
    tokens: parseThemeCss(SOMMERTHEATER_DRUPAL_THEME_CSS),
  },
  {
    id: "theatre-sunset-glow",
    name: "Sommertheater Sonnenuntergang",
    description: "Warme Orange- und Goldtöne für stimmungsvolle Abendvorstellungen.",
    tokens: SUNSET_GLOW_THEME,
  },
  {
    id: "theatre-night-sky",
    name: "Sommertheater Nachtblau",
    description: "Kühle Blaunuancen mit hoher Kontrastwirkung für nächtliche Events.",
    tokens: NIGHT_SKY_THEME,
  },
  {
    id: "theatre-pastel-dream",
    name: "Sommertheater Pastell",
    description: "Sanfte Pastellfarben für festliche Sommermatineen.",
    tokens: PASTEL_DREAM_THEME,
  },
  {
    id: "theatre-forest-canopy",
    name: "Sommertheater Waldlichtung",
    description: "Natürliche Grün- und Moostöne für Freilicht-Bühnenbilder.",
    tokens: FOREST_CANOPY_THEME,
  },
  {
    id: "theatre-velvet-spotlight",
    name: "Sommertheater Samt & Scheinwerfer",
    description: "Dramatische Purpurakzente für Gala-Abende und Premieren.",
    tokens: VELVET_SPOTLIGHT_THEME,
  },
  {
    id: "theatre-festival-lights",
    name: "Sommertheater Festivallichter",
    description: "Strahlende Festivalfarben mit verspieltem Charakter für Sommerfeste.",
    tokens: FESTIVAL_LIGHTS_THEME,
  },
];

const PRESET_THEME_IDS = new Set(PRESET_THEME_DEFINITIONS.map((preset) => preset.id));

function sanitiseCssValue(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitiseThemeDescription(value: unknown, fallback: string | null): string | null {
  if (value === undefined) {
    return fallback;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 500);
}

/**
 * Normalisiert ein gespeichertes Theme. Themes in der früheren Speicherform (vor Migration
 * 20260924150000) werden über ihre berechneten `modes` übernommen.
 */
export function toTweakcnTheme(value: unknown): TweakcnTheme {
  if (isTweakcnTheme(value)) {
    return sanitiseTweakcnTheme(value);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const legacy = value as LegacyStoredTheme;
    if (legacy.modes && typeof legacy.modes === "object") {
      return sanitiseTweakcnTheme({
        theme: typeof legacy.radius?.base === "string" ? { radius: legacy.radius.base } : {},
        light: legacy.modes.light,
        dark: legacy.modes.dark,
      });
    }
  }
  return sanitiseTweakcnTheme(DEFAULT_WEBSITE_THEME);
}

function tokensToJson(tokens: TweakcnTheme): Prisma.JsonObject {
  return JSON.parse(JSON.stringify(tokens)) as Prisma.JsonObject;
}

function sanitiseSiteTitle(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_SITE_TITLE;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_SITE_TITLE;
  }
  return trimmed.slice(0, 160);
}

function sanitiseColorMode(value: unknown): ThemeColorMode {
  if (typeof value !== "string") {
    return DEFAULT_COLOR_MODE;
  }
  const normalised = value.trim().toLowerCase();
  return THEME_COLOR_MODES.includes(normalised as ThemeColorMode)
    ? (normalised as ThemeColorMode)
    : DEFAULT_COLOR_MODE;
}

function sanitiseMaintenanceMode(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalised)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalised)) {
      return false;
    }
  }

  return Boolean(value);
}

export type WebsiteSettingsRecord = (WebsiteSettings & { theme: WebsiteTheme | null }) | null;

export class LockedWebsiteThemeError extends Error {
  constructor(
    message = "Standard-Designs können nicht bearbeitet werden. Bitte dupliziere das Theme.",
  ) {
    super(message);
    this.name = "LockedWebsiteThemeError";
  }
}

export type ResolvedWebsiteTheme = {
  id: string;
  name: string;
  description: string | null;
  tokens: TweakcnTheme;
  isDefault: boolean;
  isPreset: boolean;
  updatedAt: Date | null;
};

export type ResolvedWebsiteSettings = {
  id: string;
  siteTitle: string;
  colorMode: ThemeColorMode;
  maintenanceMode: boolean;
  pageVisibility: PageVisibilitySettings;
  updatedAt: Date | null;
  theme: ResolvedWebsiteTheme;
};

const FALLBACK_THEME: ResolvedWebsiteTheme = {
  id: "__design-system__",
  name: "Designsystem",
  description: "Standardfarben aus dem Designsystem.",
  tokens: toTweakcnTheme(DEFAULT_WEBSITE_THEME),
  isDefault: true,
  isPreset: true,
  updatedAt: null,
};

export function resolveWebsiteTheme(record: WebsiteTheme | null | undefined): ResolvedWebsiteTheme {
  if (!record) {
    return FALLBACK_THEME;
  }

  return {
    id: record.id,
    name: record.name,
    description: record.description ?? null,
    tokens: toTweakcnTheme(record.tokens ?? DEFAULT_WEBSITE_THEME),
    isDefault: record.isDefault ?? false,
    isPreset: PRESET_THEME_IDS.has(record.id) || Boolean(record.isDefault),
    updatedAt: record.updatedAt ?? null,
  };
}

export function resolveWebsiteSettings(record: WebsiteSettingsRecord): ResolvedWebsiteSettings {
  const theme = resolveWebsiteTheme(record?.theme ?? null);
  return {
    id: record?.id ?? DEFAULT_WEBSITE_SETTINGS_ID,
    siteTitle: record ? sanitiseSiteTitle(record.siteTitle) : DEFAULT_SITE_TITLE,
    colorMode: record ? sanitiseColorMode(record.colorMode) : DEFAULT_COLOR_MODE,
    maintenanceMode: record
      ? sanitiseMaintenanceMode(record.maintenanceMode)
      : DEFAULT_MAINTENANCE_MODE,
    pageVisibility: record
      ? sanitisePageVisibility(record.pageVisibility)
      : DEFAULT_PAGE_VISIBILITY,
    updatedAt: record?.updatedAt ?? null,
    theme,
  };
}

export type ClientWebsiteTheme = {
  id: string;
  name: string;
  description: string | null;
  tokens: TweakcnTheme;
  isDefault: boolean;
  isPreset: boolean;
  updatedAt: string | null;
};

export type ClientWebsiteThemeSummary = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isPreset: boolean;
  updatedAt: string | null;
};

export type ClientWebsiteSettings = {
  id: string;
  siteTitle: string;
  colorMode: ThemeColorMode;
  maintenanceMode: boolean;
  pageVisibility: PageVisibilitySettings;
  updatedAt: string | null;
  theme: ClientWebsiteTheme;
};

export function toClientWebsiteTheme(resolved: ResolvedWebsiteTheme): ClientWebsiteTheme {
  return {
    id: resolved.id,
    name: resolved.name,
    description: resolved.description,
    tokens: deepClone(resolved.tokens),
    isDefault: resolved.isDefault,
    isPreset: resolved.isPreset,
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
  };
}

export function toClientWebsiteThemeSummary(
  resolved: ResolvedWebsiteTheme,
): ClientWebsiteThemeSummary {
  return {
    id: resolved.id,
    name: resolved.name,
    description: resolved.description,
    isDefault: resolved.isDefault,
    isPreset: resolved.isPreset,
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
  };
}

export function toClientWebsiteSettings(resolved: ResolvedWebsiteSettings): ClientWebsiteSettings {
  return {
    id: resolved.id,
    siteTitle: resolved.siteTitle,
    colorMode: resolved.colorMode,
    maintenanceMode: resolved.maintenanceMode,
    pageVisibility: resolved.pageVisibility,
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
    theme: toClientWebsiteTheme(resolved.theme),
  };
}

export async function readWebsiteSettings() {
  return prisma.websiteSettings.findUnique({
    where: { id: DEFAULT_WEBSITE_SETTINGS_ID },
    include: { theme: true },
  });
}

export async function ensureWebsiteTheme(preferredId?: string | null) {
  if (preferredId) {
    const existing = await prisma.websiteTheme.findUnique({ where: { id: preferredId } });
    if (existing) {
      return existing;
    }
  }

  const defaultTheme = await prisma.websiteTheme.findFirst({ where: { isDefault: true } });
  if (defaultTheme) {
    return defaultTheme;
  }

  return prisma.websiteTheme.upsert({
    where: { id: DEFAULT_THEME_ID },
    update: {},
    create: {
      id: DEFAULT_THEME_ID,
      name: "Sommertheater Standard",
      description: "Standard-Theme basierend auf dem aktuellen Designsystem.",
      isDefault: true,
      tokens: tokensToJson(toTweakcnTheme(DEFAULT_WEBSITE_THEME)),
    },
  });
}

export async function ensureWebsiteSettingsRecord() {
  const existing = await prisma.websiteSettings.findUnique({
    where: { id: DEFAULT_WEBSITE_SETTINGS_ID },
    include: { theme: true },
  });

  if (existing) {
    const patch: Prisma.WebsiteSettingsUpdateInput = {};
    if (!existing.themeId || !existing.theme) {
      const theme = await ensureWebsiteTheme(existing.themeId);
      patch.theme = { connect: { id: theme.id } };
    }

    const currentVisibility = sanitisePageVisibility(existing.pageVisibility);
    const needsVisibilityPatch =
      JSON.stringify(currentVisibility) !== JSON.stringify(DEFAULT_PAGE_VISIBILITY) &&
      (!existing.pageVisibility ||
        Object.keys((existing.pageVisibility as Record<string, unknown>) ?? {}).length === 0);
    if (needsVisibilityPatch) {
      patch.pageVisibility = currentVisibility as Prisma.InputJsonValue;
    }

    if (Object.keys(patch).length === 0) {
      return existing;
    }

    return prisma.websiteSettings.update({
      where: { id: existing.id },
      data: patch,
      include: { theme: true },
    });
  }

  const theme = await ensureWebsiteTheme();
  return prisma.websiteSettings.create({
    data: {
      id: DEFAULT_WEBSITE_SETTINGS_ID,
      siteTitle: DEFAULT_SITE_TITLE,
      colorMode: DEFAULT_COLOR_MODE,
      maintenanceMode: DEFAULT_MAINTENANCE_MODE,
      pageVisibility: DEFAULT_PAGE_VISIBILITY as Prisma.InputJsonValue,
      theme: { connect: { id: theme.id } },
    },
    include: { theme: true },
  });
}

export type WebsiteSettingsInput = {
  siteTitle?: string | null;
  colorMode?: ThemeColorMode | null;
  maintenanceMode?: boolean | null;
  // Unvalidiertes Client-Input; wird intern über sanitisePageVisibility normalisiert.
  pageVisibility?: unknown;
  themeId?: string | null;
};

export async function saveWebsiteSettings(input: WebsiteSettingsInput) {
  const update: Prisma.WebsiteSettingsUpdateInput = {};
  const create: Prisma.WebsiteSettingsCreateInput = {
    id: DEFAULT_WEBSITE_SETTINGS_ID,
    siteTitle: DEFAULT_SITE_TITLE,
    colorMode: DEFAULT_COLOR_MODE,
    maintenanceMode: DEFAULT_MAINTENANCE_MODE,
    pageVisibility: DEFAULT_PAGE_VISIBILITY as Prisma.InputJsonValue,
  };

  if (input.siteTitle !== undefined) {
    const title = sanitiseSiteTitle(input.siteTitle);
    update.siteTitle = title;
    create.siteTitle = title;
  }

  if (input.colorMode !== undefined) {
    const mode = sanitiseColorMode(input.colorMode);
    update.colorMode = mode;
    create.colorMode = mode;
  }

  if (input.maintenanceMode !== undefined) {
    const maintenanceMode = sanitiseMaintenanceMode(input.maintenanceMode);
    update.maintenanceMode = maintenanceMode;
    create.maintenanceMode = maintenanceMode;
  }

  if (input.pageVisibility !== undefined) {
    const pageVisibility = sanitisePageVisibility(input.pageVisibility);
    update.pageVisibility = pageVisibility as Prisma.InputJsonValue;
    create.pageVisibility = pageVisibility as Prisma.InputJsonValue;
  }

  if (input.themeId !== undefined) {
    if (input.themeId) {
      update.theme = { connect: { id: input.themeId } };
      create.theme = { connect: { id: input.themeId } };
    } else {
      update.theme = { disconnect: true };
    }
  }

  return prisma.websiteSettings.upsert({
    where: { id: DEFAULT_WEBSITE_SETTINGS_ID },
    update,
    create,
    include: { theme: true },
  });
}

export type WebsiteThemeInput = {
  name?: string | null;
  description?: string | null;
  tokens?: unknown;
};

export async function saveWebsiteTheme(id: string, input: WebsiteThemeInput) {
  const existing = await prisma.websiteTheme.findUnique({ where: { id } });

  if (existing && (existing.isDefault || PRESET_THEME_IDS.has(existing.id))) {
    throw new LockedWebsiteThemeError();
  }

  const baseName = existing?.name ?? "Unbenanntes Theme";
  const resolvedName = sanitiseCssValue(input.name ?? baseName, baseName);
  const resolvedDescription = sanitiseThemeDescription(
    input.description,
    existing?.description ?? null,
  );
  const resolvedTokens = tokensToJson(
    toTweakcnTheme(
      input.tokens !== undefined ? input.tokens : (existing?.tokens ?? DEFAULT_WEBSITE_THEME),
    ),
  );

  if (existing) {
    return prisma.websiteTheme.update({
      where: { id },
      data: {
        name: resolvedName,
        description: resolvedDescription,
        tokens: resolvedTokens,
      },
    });
  }

  return prisma.websiteTheme.create({
    data: {
      id,
      name: resolvedName,
      description: resolvedDescription,
      tokens: resolvedTokens,
      isDefault: id === DEFAULT_THEME_ID,
    },
  });
}

export type CreateWebsiteThemeOptions = {
  name?: string | null;
  description?: string | null;
  sourceThemeId?: string | null;
  /** Direkt übergebenes Theme, z. B. aus einem tweakcn-Import. */
  tokens?: TweakcnTheme | null;
};

function sortResolvedThemes(themes: ResolvedWebsiteTheme[]) {
  return [...themes].sort((a, b) => {
    if (a.isDefault && !b.isDefault) {
      return -1;
    }
    if (!a.isDefault && b.isDefault) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Legt fehlende eingebaute Themes an; vorhandene bleiben unverändert (schreibgeschützt). */
export async function ensurePresetWebsiteThemes() {
  const existingThemes = await prisma.websiteTheme.findMany({
    where: { id: { in: PRESET_THEME_DEFINITIONS.map((preset) => preset.id) } },
    select: { id: true },
  });
  const existingIds = new Set(existingThemes.map((theme) => theme.id));

  for (const preset of PRESET_THEME_DEFINITIONS) {
    if (existingIds.has(preset.id)) {
      continue;
    }
    await prisma.websiteTheme.create({
      data: {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        tokens: tokensToJson(toTweakcnTheme(preset.tokens)),
        isDefault: false,
      },
    });
  }
}

export async function listWebsiteThemes(): Promise<ClientWebsiteThemeSummary[]> {
  await ensurePresetWebsiteThemes();
  const themes = await prisma.websiteTheme.findMany();
  const resolved = themes.map((theme) => resolveWebsiteTheme(theme));
  const sorted = sortResolvedThemes(resolved);
  return sorted.map((theme) => toClientWebsiteThemeSummary(theme));
}

export async function getWebsiteTheme(id: string) {
  const record = await prisma.websiteTheme.findUnique({ where: { id } });
  if (!record) {
    return null;
  }
  return toClientWebsiteTheme(resolveWebsiteTheme(record));
}

export async function deleteWebsiteTheme(id: string) {
  const existing = await prisma.websiteTheme.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Theme nicht gefunden.");
  }
  if (existing.isDefault || PRESET_THEME_IDS.has(existing.id)) {
    throw new LockedWebsiteThemeError();
  }

  const settings = await prisma.websiteSettings.findUnique({
    where: { id: DEFAULT_WEBSITE_SETTINGS_ID },
  });
  if (settings?.themeId === id) {
    await prisma.websiteSettings.update({
      where: { id: DEFAULT_WEBSITE_SETTINGS_ID },
      data: { themeId: DEFAULT_THEME_ID },
    });
  }

  await prisma.websiteTheme.delete({ where: { id } });
  const active = await ensureWebsiteSettingsRecord();
  return {
    themes: await listWebsiteThemes(),
    activeThemeId: active.themeId ?? DEFAULT_THEME_ID,
  };
}

export async function createWebsiteTheme(
  options: CreateWebsiteThemeOptions = {},
): Promise<ClientWebsiteTheme> {
  await ensurePresetWebsiteThemes();

  const sourceId = options.sourceThemeId?.trim() ? options.sourceThemeId.trim() : null;
  const sourceTheme = sourceId
    ? await prisma.websiteTheme.findUnique({ where: { id: sourceId } })
    : null;

  const baseTokens = options.tokens ?? sourceTheme?.tokens ?? DEFAULT_WEBSITE_THEME;
  const fallbackName = sourceTheme ? `${sourceTheme.name} Kopie` : "Neues Theme";
  const newId = randomUUID();

  const created = await saveWebsiteTheme(newId, {
    name: options.name ?? fallbackName,
    description: options.description ?? sourceTheme?.description ?? null,
    tokens: baseTokens,
  });

  return toClientWebsiteTheme(resolveWebsiteTheme(created));
}
