import { designTokens } from "@/design-system";
import { prisma } from "@/lib/prisma";
import type { Prisma, WebsiteSettings, WebsiteTheme } from "@prisma/client";

export const DEFAULT_THEME_ID = "default-website-theme" as const;
export const DEFAULT_WEBSITE_SETTINGS_ID = "public" as const;
export const DEFAULT_SITE_TITLE = "Sommertheater im Schlosspark" as const;
export const DEFAULT_COLOR_MODE = "dark" as const;

export const THEME_COLOR_MODES = ["light", "dark"] as const;
export type ThemeColorMode = (typeof THEME_COLOR_MODES)[number];

type BrandedString<Brand extends string> = string & { readonly __brand: Brand };

export type ThemeModeKey = BrandedString<"ThemeModeKey">;
export type ThemeTokenKey = BrandedString<"ThemeTokenKey">;

export type ThemeFamilyValue = {
  l: number;
  c: number;
  h: number;
  alpha?: number;
};

export type ThemeFamilies = Record<string, Record<ThemeModeKey, ThemeFamilyValue>>;

export type ThemeTokenAdjustment = {
  deltaL?: number;
  l?: number;
  scaleL?: number;
  deltaC?: number;
  c?: number;
  scaleC?: number;
  h?: number;
  deltaH?: number;
  alpha?: number;
  deltaAlpha?: number;
  scaleAlpha?: number;
  value?: string;
  family?: string;
};

export type ThemeSemanticTokenDefinition = {
  family: string;
  description?: string;
  notes?: string;
  tags?: string[];
  [mode: string]: unknown;
};

export type ThemeParameters = {
  families: ThemeFamilies;
  tokens: Record<string, ThemeSemanticTokenDefinition>;
};

export type ThemeTokens = {
  radius: { base: string };
  parameters?: ThemeParameters;
  modes: Record<ThemeModeKey, Record<ThemeTokenKey, string>>;
  meta?: Record<string, unknown>;
};

const DEFAULT_MODE_KEYS = Object.keys(designTokens.modes).map((key) => key as ThemeModeKey);

function deepClone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

const RESERVED_PARAMETER_KEYS = new Set(["family", "description", "notes", "tags"]);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sanitiseFamilyValue(
  value: unknown,
  fallback: { l: number; c: number; h: number; alpha?: number },
) {
  const base = {
    l: typeof fallback.l === "number" ? clamp(fallback.l, 0, 1) : 0.5,
    c: typeof fallback.c === "number" ? Math.max(fallback.c, 0) : 0,
    h: typeof fallback.h === "number" ? fallback.h : 0,
    alpha: typeof fallback.alpha === "number" ? clamp(fallback.alpha, 0, 1) : 1,
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return base;
  }

  const record = value as Record<string, unknown>;
  const l = Number(record.l);
  if (Number.isFinite(l)) {
    base.l = clamp(l, 0, 1);
  }

  const c = Number(record.c);
  if (Number.isFinite(c)) {
    base.c = Math.max(c, 0);
  }

  const h = Number(record.h);
  if (Number.isFinite(h)) {
    base.h = h;
  }

  const alpha = Number(record.alpha);
  if (Number.isFinite(alpha)) {
    base.alpha = clamp(alpha, 0, 1);
  }

  return base;
}

function sanitiseFamilies(
  value: unknown,
  fallbackFamilies: ThemeFamilies,
): ThemeFamilies {
  const result: ThemeFamilies = {};
  const fallbackRecord = fallbackFamilies ?? {};
  const candidateRecord =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const familyNames = new Set<string>([
    ...Object.keys(fallbackRecord),
    ...Object.keys(candidateRecord),
  ]);

  for (const familyName of familyNames) {
    const fallbackModes = fallbackRecord[familyName] ?? {};
    const candidateModesRaw = candidateRecord[familyName];
    const candidateModes =
      candidateModesRaw && typeof candidateModesRaw === "object" && !Array.isArray(candidateModesRaw)
        ? (candidateModesRaw as Record<string, unknown>)
        : {};

    const modeNames = new Set<ThemeModeKey>(DEFAULT_MODE_KEYS);
    for (const key of Object.keys(fallbackModes)) {
      modeNames.add(key as ThemeModeKey);
    }
    for (const key of Object.keys(candidateModes)) {
      modeNames.add(key as ThemeModeKey);
    }

    const modeRecord: Record<ThemeModeKey, ThemeFamilyValue> = {};
    for (const modeKey of modeNames) {
      const fallbackValue = fallbackModes[modeKey] ?? { l: 0.5, c: 0, h: 0, alpha: 1 };
      const candidateValue = candidateModes[modeKey];
      modeRecord[modeKey] = sanitiseFamilyValue(candidateValue, fallbackValue);
    }

    result[familyName] = modeRecord;
  }

  return result;
}

type SanitisedAdjustment = ThemeTokenAdjustment;

function sanitiseAdjustment(
  value: unknown,
  fallback: Record<string, unknown> | undefined,
): SanitisedAdjustment {
  const result: SanitisedAdjustment = {};
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const base = fallback && typeof fallback === "object" && !Array.isArray(fallback)
    ? fallback
    : {};

  const numericKeys = [
    "deltaL",
    "l",
    "scaleL",
    "deltaC",
    "c",
    "scaleC",
    "h",
    "deltaH",
    "alpha",
    "deltaAlpha",
    "scaleAlpha",
  ] as const;
  for (const key of numericKeys) {
    const candidateValue = Number(candidate[key]);
    if (Number.isFinite(candidateValue)) {
      const valueToSet =
        key === "alpha"
          ? clamp(candidateValue, 0, 1)
          : key === "c"
            ? Math.max(candidateValue, 0)
            : candidateValue;
      switch (key) {
        case "deltaL":
          result.deltaL = valueToSet;
          break;
        case "l":
          result.l = valueToSet;
          break;
        case "scaleL":
          result.scaleL = valueToSet;
          break;
        case "deltaC":
          result.deltaC = valueToSet;
          break;
        case "c":
          result.c = valueToSet;
          break;
        case "scaleC":
          result.scaleC = valueToSet;
          break;
        case "h":
          result.h = valueToSet;
          break;
        case "deltaH":
          result.deltaH = valueToSet;
          break;
        case "alpha":
          result.alpha = valueToSet;
          break;
        case "deltaAlpha":
          result.deltaAlpha = valueToSet;
          break;
        case "scaleAlpha":
          result.scaleAlpha = valueToSet;
          break;
      }
      continue;
    }

    const fallbackValue = Number((base as Record<string, unknown>)[key]);
    if (Number.isFinite(fallbackValue)) {
      const valueToSet =
        key === "alpha"
          ? clamp(fallbackValue, 0, 1)
          : key === "c"
            ? Math.max(fallbackValue, 0)
            : fallbackValue;
      switch (key) {
        case "deltaL":
          result.deltaL = valueToSet;
          break;
        case "l":
          result.l = valueToSet;
          break;
        case "scaleL":
          result.scaleL = valueToSet;
          break;
        case "deltaC":
          result.deltaC = valueToSet;
          break;
        case "c":
          result.c = valueToSet;
          break;
        case "scaleC":
          result.scaleC = valueToSet;
          break;
        case "h":
          result.h = valueToSet;
          break;
        case "deltaH":
          result.deltaH = valueToSet;
          break;
        case "alpha":
          result.alpha = valueToSet;
          break;
        case "deltaAlpha":
          result.deltaAlpha = valueToSet;
          break;
        case "scaleAlpha":
          result.scaleAlpha = valueToSet;
          break;
      }
    }
  }

  const candidateValue = candidate.value ?? (base as Record<string, unknown>).value;
  if (typeof candidateValue === "string" && candidateValue.trim()) {
    result.value = candidateValue.trim().slice(0, 200);
  }

  const familyOverride = candidate.family ?? (base as Record<string, unknown>).family;
  if (typeof familyOverride === "string" && familyOverride.trim()) {
    result.family = familyOverride.trim();
  }

  return result;
}

function sanitiseTokenDefinition(
  value: unknown,
  fallback: ThemeSemanticTokenDefinition | undefined,
): ThemeSemanticTokenDefinition {
  const baseRecord = fallback && typeof fallback === "object" && !Array.isArray(fallback)
    ? (fallback as Record<string, unknown>)
    : {};
  const candidateRecord = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  const result: Record<string, unknown> = {};

  const fallbackFamily = typeof baseRecord.family === "string" && baseRecord.family.trim()
    ? baseRecord.family.trim()
    : "neutral";
  if (typeof candidateRecord.family === "string" && candidateRecord.family.trim()) {
    result.family = candidateRecord.family.trim();
  } else {
    result.family = fallbackFamily;
  }

  const description = candidateRecord.description ?? baseRecord.description;
  if (typeof description === "string" && description.trim()) {
    result.description = description.trim().slice(0, 200);
  }

  const notes = candidateRecord.notes ?? baseRecord.notes;
  if (typeof notes === "string" && notes.trim()) {
    result.notes = notes.trim();
  }

  const tags = candidateRecord.tags ?? baseRecord.tags;
  if (Array.isArray(tags)) {
    result.tags = tags
      .map((tag) => (typeof tag === "string" ? tag.trim() : String(tag)))
      .filter(Boolean)
      .slice(0, 20);
  }

  const modeKeys = new Set<string>();
  for (const key of Object.keys(baseRecord)) {
    if (!RESERVED_PARAMETER_KEYS.has(key)) {
      modeKeys.add(key);
    }
  }
  for (const key of Object.keys(candidateRecord)) {
    if (!RESERVED_PARAMETER_KEYS.has(key)) {
      modeKeys.add(key);
    }
  }

  for (const modeKey of Array.from(modeKeys)) {
    const sanitised = sanitiseAdjustment(
      candidateRecord[modeKey],
      baseRecord[modeKey] as Record<string, unknown> | undefined,
    );
    if (Object.keys(sanitised).length > 0) {
      result[modeKey] = sanitised;
    }
  }

  return result as ThemeSemanticTokenDefinition;
}

function sanitiseParameters(value: unknown, fallback: ThemeParameters): ThemeParameters {
  const base = deepClone(fallback ?? {});

  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  base.families = sanitiseFamilies(candidate.families, fallback.families);

  const fallbackTokensRecord = (fallback.tokens ?? {}) as Record<
    string,
    ThemeSemanticTokenDefinition
  >;
  const candidateTokens = candidate.tokens && typeof candidate.tokens === "object" && !Array.isArray(candidate.tokens)
    ? (candidate.tokens as Record<string, unknown>)
    : {};

  const tokenNames = new Set<string>([
    ...Object.keys(fallbackTokensRecord),
    ...Object.keys(candidateTokens),
  ]);

  const resultTokens: Record<string, ThemeSemanticTokenDefinition> = {};
  for (const tokenName of Array.from(tokenNames)) {
    resultTokens[tokenName] = sanitiseTokenDefinition(
      candidateTokens[tokenName],
      fallbackTokensRecord[tokenName] as ThemeSemanticTokenDefinition | undefined,
    );
  }

  base.tokens = resultTokens as ThemeParameters["tokens"];

  return base;
}

function cloneThemeTokens(tokens: ThemeTokens | typeof designTokens): ThemeTokens {
  const clone = deepClone(tokens) as ThemeTokens;
  if (!clone.parameters && designTokens.parameters) {
    clone.parameters = deepClone(designTokens.parameters);
  }
  if (!clone.meta && designTokens.meta) {
    clone.meta = deepClone(designTokens.meta);
  }
  return clone;
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

  if (base.parameters) {
    base.parameters = sanitiseParameters(record.parameters, base.parameters);
  }

  const modesCandidate = record.modes;
  if (modesCandidate && typeof modesCandidate === "object" && !Array.isArray(modesCandidate)) {
    const modesRecord = modesCandidate as Record<string, unknown>;
    const defaultModes = designTokens.modes as Record<string, Record<string, string>>;
    const modeNames = new Set<ThemeModeKey>(DEFAULT_MODE_KEYS);
    for (const key of Object.keys(modesRecord)) {
      modeNames.add(key as ThemeModeKey);
    }

    for (const modeKey of modeNames) {
      const candidate = modesRecord[modeKey];
      const fallbackRecord = (base.modes[modeKey] as Record<string, string> | undefined)
        ?? (defaultModes[modeKey] as Record<string, string> | undefined)
        ?? {};

      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        base.modes[modeKey] = { ...fallbackRecord } as Record<ThemeTokenKey, string>;
        continue;
      }

      const candidateRecord = candidate as Record<string, unknown>;
      const tokenNames = new Set<ThemeTokenKey>(
        Object.keys(fallbackRecord).map((key) => key as ThemeTokenKey),
      );
      for (const key of Object.keys(candidateRecord)) {
        tokenNames.add(key as ThemeTokenKey);
      }

      const resolvedTokens: Record<ThemeTokenKey, string> = {};
      for (const tokenKey of tokenNames) {
        const fallbackValue = fallbackRecord[tokenKey];
        const fallbackString =
          typeof fallbackValue === "string" && fallbackValue.trim().length > 0
            ? fallbackValue
            : "transparent";
        resolvedTokens[tokenKey] = sanitiseCssValue(candidateRecord[tokenKey], fallbackString);
      }

      base.modes[modeKey] = resolvedTokens;
    }
  }

  const metaCandidate = record.meta;
  if (metaCandidate && typeof metaCandidate === "object" && !Array.isArray(metaCandidate)) {
    const metaRecord = metaCandidate as Record<string, unknown>;
    base.meta = { ...(base.meta ?? {}), ...metaRecord } as ThemeTokens["meta"];
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
