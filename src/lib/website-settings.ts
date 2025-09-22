import { designTokens } from "@/design-system";
import { prisma } from "@/lib/prisma";
import type { Prisma, WebsiteSettings, WebsiteTheme } from "@prisma/client";

export const DEFAULT_THEME_ID = "default-website-theme" as const;
export const DEFAULT_WEBSITE_SETTINGS_ID = "public" as const;
export const DEFAULT_SITE_TITLE = "Sommertheater im Schlosspark" as const;
export const DEFAULT_COLOR_MODE = "dark" as const;

export const THEME_COLOR_MODES = ["light", "dark"] as const;
export type ThemeColorMode = (typeof THEME_COLOR_MODES)[number];

export type ThemeTokens = typeof designTokens;
export type ThemeModeKey = keyof ThemeTokens["modes"];
export type ThemeTokenKey = keyof ThemeTokens["modes"]["light"];

const INTERNAL_MODE_KEYS = Object.keys(designTokens.modes) as ThemeModeKey[];
const INTERNAL_TOKEN_KEYS = Object.keys(designTokens.modes.light) as ThemeTokenKey[];

export const THEME_MODE_KEYS: ThemeModeKey[] = [...INTERNAL_MODE_KEYS];
export const THEME_TOKEN_KEYS: ThemeTokenKey[] = [...INTERNAL_TOKEN_KEYS];

function cloneThemeTokens(tokens: ThemeTokens): ThemeTokens {
  const modes = {} as ThemeTokens["modes"];
  for (const mode of Object.keys(tokens.modes) as ThemeModeKey[]) {
    modes[mode] = { ...tokens.modes[mode] };
  }
  return {
    radius: { base: tokens.radius.base },
    parameters: designTokens.parameters,
    modes,
    meta: tokens.meta ?? designTokens.meta,
  };
}

function cloneDefaultTokens(): ThemeTokens {
  return cloneThemeTokens(designTokens);
}

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

export function sanitiseThemeTokens(value: unknown): ThemeTokens {
  const base = cloneDefaultTokens();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return base;
  }

  const record = value as Record<string, unknown>;
  const radiusCandidate = record.radius;
  if (radiusCandidate && typeof radiusCandidate === "object" && !Array.isArray(radiusCandidate)) {
    const radiusRecord = radiusCandidate as Record<string, unknown>;
    base.radius.base = sanitiseCssValue(radiusRecord.base, base.radius.base);
  }

  const modesCandidate = record.modes;
  if (!modesCandidate || typeof modesCandidate !== "object" || Array.isArray(modesCandidate)) {
    return base;
  }

  const modesRecord = modesCandidate as Record<string, unknown>;
  for (const modeKey of INTERNAL_MODE_KEYS) {
    const defaultModeTokens = designTokens.modes[modeKey];
    const targetModeTokens = base.modes[modeKey];
    const candidate = modesRecord[modeKey];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      for (const tokenKey of INTERNAL_TOKEN_KEYS) {
        targetModeTokens[tokenKey] = defaultModeTokens[tokenKey];
      }
      continue;
    }

    const candidateRecord = candidate as Record<string, unknown>;
    for (const tokenKey of INTERNAL_TOKEN_KEYS) {
      targetModeTokens[tokenKey] = sanitiseCssValue(
        candidateRecord[tokenKey],
        defaultModeTokens[tokenKey],
      );
    }
  }

  return base;
}

function tokensToJson(tokens: ThemeTokens): Prisma.JsonObject {
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

export type WebsiteSettingsRecord = (WebsiteSettings & { theme: WebsiteTheme | null }) | null;

export type ResolvedWebsiteTheme = {
  id: string;
  name: string;
  description: string | null;
  tokens: ThemeTokens;
  isDefault: boolean;
  updatedAt: Date | null;
};

export type ResolvedWebsiteSettings = {
  id: string;
  siteTitle: string;
  colorMode: ThemeColorMode;
  updatedAt: Date | null;
  theme: ResolvedWebsiteTheme;
};

const FALLBACK_THEME: ResolvedWebsiteTheme = {
  id: "__design-system__",
  name: "Designsystem",
  description: "Standardfarben aus dem Designsystem.",
  tokens: cloneDefaultTokens(),
  isDefault: true,
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
    tokens: sanitiseThemeTokens(record.tokens ?? designTokens),
    isDefault: record.isDefault ?? false,
    updatedAt: record.updatedAt ?? null,
  };
}

export function resolveWebsiteSettings(record: WebsiteSettingsRecord): ResolvedWebsiteSettings {
  const theme = resolveWebsiteTheme(record?.theme ?? null);
  return {
    id: record?.id ?? DEFAULT_WEBSITE_SETTINGS_ID,
    siteTitle: record ? sanitiseSiteTitle(record.siteTitle) : DEFAULT_SITE_TITLE,
    colorMode: record ? sanitiseColorMode(record.colorMode) : DEFAULT_COLOR_MODE,
    updatedAt: record?.updatedAt ?? null,
    theme,
  };
}

export type ClientWebsiteTheme = {
  id: string;
  name: string;
  description: string | null;
  tokens: ThemeTokens;
  updatedAt: string | null;
};

export type ClientWebsiteSettings = {
  id: string;
  siteTitle: string;
  colorMode: ThemeColorMode;
  updatedAt: string | null;
  theme: ClientWebsiteTheme;
};

export function toClientWebsiteSettings(resolved: ResolvedWebsiteSettings): ClientWebsiteSettings {
  return {
    id: resolved.id,
    siteTitle: resolved.siteTitle,
    colorMode: resolved.colorMode,
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
    theme: {
      id: resolved.theme.id,
      name: resolved.theme.name,
      description: resolved.theme.description,
      tokens: cloneThemeTokens(resolved.theme.tokens),
      updatedAt: resolved.theme.updatedAt ? resolved.theme.updatedAt.toISOString() : null,
    },
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
      tokens: tokensToJson(cloneDefaultTokens()),
    },
  });
}

export async function ensureWebsiteSettingsRecord() {
  const existing = await prisma.websiteSettings.findUnique({
    where: { id: DEFAULT_WEBSITE_SETTINGS_ID },
    include: { theme: true },
  });

  if (existing) {
    if (existing.themeId && existing.theme) {
      return existing;
    }
    const theme = await ensureWebsiteTheme(existing.themeId);
    return prisma.websiteSettings.update({
      where: { id: existing.id },
      data: { theme: { connect: { id: theme.id } } },
      include: { theme: true },
    });
  }

  const theme = await ensureWebsiteTheme();
  return prisma.websiteSettings.create({
    data: {
      id: DEFAULT_WEBSITE_SETTINGS_ID,
      siteTitle: DEFAULT_SITE_TITLE,
      colorMode: DEFAULT_COLOR_MODE,
      theme: { connect: { id: theme.id } },
    },
    include: { theme: true },
  });
}

export type WebsiteSettingsInput = {
  siteTitle?: string | null;
  colorMode?: ThemeColorMode | null;
  themeId?: string | null;
};

export async function saveWebsiteSettings(input: WebsiteSettingsInput) {
  const update: Prisma.WebsiteSettingsUpdateInput = {};
  const create: Prisma.WebsiteSettingsCreateInput = {
    id: DEFAULT_WEBSITE_SETTINGS_ID,
    siteTitle: DEFAULT_SITE_TITLE,
    colorMode: DEFAULT_COLOR_MODE,
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

  const baseName = existing?.name ?? "Unbenanntes Theme";
  const resolvedName = sanitiseCssValue(input.name ?? baseName, baseName);
  const resolvedDescription = sanitiseThemeDescription(input.description, existing?.description ?? null);
  const resolvedTokens = input.tokens !== undefined
    ? tokensToJson(sanitiseThemeTokens(input.tokens))
    : tokensToJson(sanitiseThemeTokens(existing?.tokens ?? cloneDefaultTokens()));

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
