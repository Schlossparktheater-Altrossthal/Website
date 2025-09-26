"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { hexToOklch, oklchToHex, type OklchColor } from "@/lib/color";
import { createThemeCss } from "@/lib/theme-css";
import { cn } from "@/lib/utils";
import type {
  ClientWebsiteSettings,
  ClientWebsiteTheme,
  ClientWebsiteThemeSummary,
  ThemeColorMode,
  ThemeModeKey,
  ThemeTokenAdjustment,
  ThemeTokens,
} from "@/lib/website-settings";

const LIGHT_MODE = "light" as ThemeModeKey;
const DARK_MODE = "dark" as ThemeModeKey;

const COLOR_MODE_OPTIONS: { value: ThemeColorMode; label: string }[] = [
  { value: "system", label: "Systemmodus" },
  { value: "dark", label: "Dunkelmodus" },
  { value: "light", label: "Hellmodus" },
];

const MODE_LABELS: Record<string, string> = {
  dark: "Dark",
  light: "Light",
};

const FAMILY_INHERIT_VALUE = "__inherit__";

const SEMANTIC_TOKEN_SECTION_ID = "semantic-token-advanced";

const RESERVED_PARAMETER_KEYS = new Set(["family", "description", "notes", "tags"]);

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

type FamilyFormFields = {
  l: string | number;
  c: string | number;
  h: string | number;
  alpha: string | number;
};

type FamiliesState = Record<string, Record<ThemeModeKey, FamilyFormFields>>;
type FamilyHexDraftState = Record<string, Partial<Record<ThemeModeKey, string>>>;

type TokenModeFields = {
  l: string;
  deltaL: string;
  scaleL: string;
  c: string;
  deltaC: string;
  scaleC: string;
  h: string;
  deltaH: string;
  alpha: string;
  deltaAlpha: string;
  scaleAlpha: string;
  value: string;
  family: string;
};

type TokenMetaState = {
  description?: string;
  notes?: string;
  tags?: string[];
};

type TokenFormState = Record<
  string,
  {
    family: string;
    modes: Record<ThemeModeKey, TokenModeFields>;
    meta: TokenMetaState;
  }
>;

type NumericOklch = {
  l: number;
  c: number;
  h: number;
  alpha: number;
};

type TokenAdjustment = ThemeTokenAdjustment;

type NormalisedToken = TokenMetaState &
  Partial<Record<ThemeModeKey, TokenAdjustment>> & {
    family: string;
  };

type NormalisedParameters = {
  families: Record<string, Record<ThemeModeKey, NumericOklch>>;
  tokens: Record<string, NormalisedToken>;
};

const DEFAULT_FAMILY_COLOR: NumericOklch = { l: 0.5, c: 0, h: 0, alpha: 1 };

function sortThemeSummaries(themes: ClientWebsiteThemeSummary[]): ClientWebsiteThemeSummary[] {
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

function themeToSummary(theme: ClientWebsiteTheme): ClientWebsiteThemeSummary {
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    isDefault: theme.isDefault,
    updatedAt: theme.updatedAt,
  };
}

function formatTokenLabel(token: string) {
  return token
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFamilyLabel(name: string) {
  if (!name.includes("-")) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatModeLabel(mode: string) {
  return mode
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getModeLabel(mode: ThemeModeKey) {
  return MODE_LABELS[mode] ?? formatModeLabel(mode);
}

function toInputValue(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) {
    return "";
  }
  return `${value}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toPrecision(value: number, precision: number) {
  return Number.parseFloat(value.toFixed(precision));
}

function wrapHue(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  let result = value % 360;
  if (result < 0) {
    result += 360;
  }
  return result;
}

function formatOklchValue(value: NumericOklch) {
  const l = toPrecision(clamp(value.l, 0, 1), 3);
  const c = toPrecision(Math.max(value.c, 0), 3);
  const h = toPrecision(wrapHue(value.h), 1);
  const alpha = clamp(value.alpha, 0, 1);
  const prefix = `oklch(${l} ${c} ${h}`;
  return alpha >= 0 && alpha < 1 ? `${prefix} / ${toPrecision(alpha, 2)})` : `${prefix})`;
}

function toFormNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number.parseFloat(value.toFixed(6));
}

function sortModeKeys(keys: ThemeModeKey[]): ThemeModeKey[] {
  const priority = (mode: ThemeModeKey) => {
    if (mode === LIGHT_MODE) {
      return 0;
    }
    if (mode === DARK_MODE) {
      return 1;
    }
    return 2;
  };
  return [...keys].sort((a, b) => {
    const order = priority(a) - priority(b);
    if (order !== 0) {
      return order;
    }
    return a.localeCompare(b);
  });
}

function deriveModeKeysFromTokens(tokens: ThemeTokens): ThemeModeKey[] {
  const modeSet = new Set<ThemeModeKey>(
    Object.keys(tokens.modes).map((key) => key as ThemeModeKey),
  );
  modeSet.add(LIGHT_MODE);
  modeSet.add(DARK_MODE);
  const parameterTokens = tokens.parameters?.tokens ?? {};
  for (const definition of Object.values(parameterTokens) as Record<string, unknown>[]) {
    if (!definition || typeof definition !== "object") {
      continue;
    }
    for (const key of Object.keys(definition)) {
      if (!RESERVED_PARAMETER_KEYS.has(key)) {
        modeSet.add(key as ThemeModeKey);
      }
    }
  }
  return sortModeKeys(Array.from(modeSet));
}

function createFamilyFormState(
  parameters: ThemeTokens["parameters"] | undefined,
  modeKeys: ThemeModeKey[],
): FamiliesState {
  const familiesRecord = (parameters?.families ?? {}) as Record<string, unknown>;
  const names = Object.keys(familiesRecord).sort((a, b) => a.localeCompare(b));
  const state: FamiliesState = {};
  for (const familyName of names) {
    const modes = familiesRecord[familyName] as Record<string, unknown> | undefined;
    state[familyName] = {} as Record<ThemeModeKey, FamilyFormFields>;
    for (const mode of modeKeys) {
      const data = modes?.[mode] as { l?: number; c?: number; h?: number; alpha?: number } | undefined;
      state[familyName][mode] = {
        l: toInputValue(data?.l ?? 0.5),
        c: toInputValue(data?.c ?? 0),
        h: toInputValue(data?.h ?? 0),
        alpha: toInputValue(data?.alpha ?? 1),
      };
    }
  }
  return state;
}

function createTokenFormState(
  parameters: ThemeTokens["parameters"] | undefined,
  modeKeys: ThemeModeKey[],
): TokenFormState {
  const tokensRecord = (parameters?.tokens ?? {}) as Record<string, unknown>;
  const names = Object.keys(tokensRecord).sort((a, b) => a.localeCompare(b));
  const state: TokenFormState = {};
  for (const tokenName of names) {
    const definition = tokensRecord[tokenName] ?? {};
    const definitionRecord = definition as Record<string, unknown>;
    const modes: Record<ThemeModeKey, TokenModeFields> = {} as Record<ThemeModeKey, TokenModeFields>;
    for (const mode of modeKeys) {
      const rawAdjustments = definitionRecord[mode];
      if (typeof rawAdjustments === "string") {
        modes[mode] = {
          l: "",
          deltaL: "",
          scaleL: "",
          c: "",
          deltaC: "",
          scaleC: "",
          h: "",
          deltaH: "",
          alpha: "",
          deltaAlpha: "",
          scaleAlpha: "",
          value: rawAdjustments,
          family: "",
        };
        continue;
      }

      const adjustments =
        rawAdjustments && typeof rawAdjustments === "object" && !Array.isArray(rawAdjustments)
          ? (rawAdjustments as Record<string, unknown>)
          : undefined;

      modes[mode] = {
        l: toInputValue(typeof adjustments?.l === "number" ? (adjustments.l as number) : undefined),
        deltaL: toInputValue(typeof adjustments?.deltaL === "number" ? (adjustments.deltaL as number) : undefined),
        scaleL: toInputValue(typeof adjustments?.scaleL === "number" ? (adjustments.scaleL as number) : undefined),
        c: toInputValue(typeof adjustments?.c === "number" ? (adjustments.c as number) : undefined),
        deltaC: toInputValue(typeof adjustments?.deltaC === "number" ? (adjustments.deltaC as number) : undefined),
        scaleC: toInputValue(typeof adjustments?.scaleC === "number" ? (adjustments.scaleC as number) : undefined),
        h: toInputValue(typeof adjustments?.h === "number" ? (adjustments.h as number) : undefined),
        deltaH: toInputValue(typeof adjustments?.deltaH === "number" ? (adjustments.deltaH as number) : undefined),
        alpha: toInputValue(typeof adjustments?.alpha === "number" ? (adjustments.alpha as number) : undefined),
        deltaAlpha: toInputValue(
          typeof adjustments?.deltaAlpha === "number" ? (adjustments.deltaAlpha as number) : undefined,
        ),
        scaleAlpha: toInputValue(
          typeof adjustments?.scaleAlpha === "number" ? (adjustments.scaleAlpha as number) : undefined,
        ),
        value: typeof adjustments?.value === "string" ? (adjustments.value as string) : "",
        family: typeof adjustments?.family === "string" ? (adjustments.family as string) : "",
      };
    }

    const meta: TokenMetaState = {};
    const descriptionValue = definitionRecord.description;
    if (typeof descriptionValue === "string") {
      meta.description = descriptionValue;
    }
    const notesValue = definitionRecord.notes;
    if (typeof notesValue === "string") {
      meta.notes = notesValue;
    }
    const tagsValue = definitionRecord.tags;
    if (Array.isArray(tagsValue)) {
      meta.tags = tagsValue
        .map((tag) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
        .filter((tag) => tag.length > 0);
    }

    const familyValue = definitionRecord.family;
    state[tokenName] = {
      family: typeof familyValue === "string" ? familyValue : "",
      modes,
      meta,
    };
  }
  return state;
}

function parseNumberWithFallback(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveFamilyNumber(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    return parseNumberWithFallback(value, fallback);
  }
  return fallback;
}

function parseAdjustmentValue(value: string | undefined, fallback?: number): number | undefined {
  if (value === undefined) {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseFloat(trimmed);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function parseOverrideString(value: string | undefined, fallback?: string): string | undefined {
  if (value === undefined) {
    return fallback?.trim() ? fallback.trim() : undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normaliseParameters(tokens: ThemeTokens, modeKeys: ThemeModeKey[]): NormalisedParameters {
  const families: Record<string, Record<ThemeModeKey, NumericOklch>> = {};
  const familiesSource = (tokens.parameters?.families ?? {}) as Record<string, unknown>;
  const familyNames = Object.keys(familiesSource).sort((a, b) => a.localeCompare(b));
  for (const familyName of familyNames) {
    const modesRecord = familiesSource[familyName] as Record<string, unknown> | undefined;
    families[familyName] = {} as Record<ThemeModeKey, NumericOklch>;
    for (const mode of modeKeys) {
      const data = modesRecord?.[mode] as { l?: number; c?: number; h?: number; alpha?: number } | undefined;
      families[familyName][mode] = {
        l: typeof data?.l === "number" ? data.l : 0.5,
        c: typeof data?.c === "number" ? data.c : 0,
        h: typeof data?.h === "number" ? data.h : 0,
        alpha: typeof data?.alpha === "number" ? data.alpha : 1,
      };
    }
  }

  const tokensResult: Record<string, NormalisedToken> = {};
  const parameterTokens = (tokens.parameters?.tokens ?? {}) as Record<string, unknown>;
  const tokenNames = Object.keys(parameterTokens).sort((a, b) => a.localeCompare(b));
  for (const tokenName of tokenNames) {
    const definition = parameterTokens[tokenName] ?? {};
    const definitionRecord = definition as Record<string, unknown>;

    const entry: NormalisedToken = {
      family:
        typeof definitionRecord.family === "string" && definitionRecord.family.trim()
          ? definitionRecord.family.trim()
          : "neutral",
    };

    const descriptionValue = definitionRecord.description;
    if (typeof descriptionValue === "string") {
      entry.description = descriptionValue;
    }
    const notesValue = definitionRecord.notes;
    if (typeof notesValue === "string") {
      entry.notes = notesValue;
    }
    const tagsValue = definitionRecord.tags;
    if (Array.isArray(tagsValue)) {
      entry.tags = tagsValue
        .map((tag) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
        .filter((tag) => tag.length > 0);
    }

    for (const mode of modeKeys) {
      const adjustments = definitionRecord[mode];
      if (!adjustments) {
        continue;
      }
      if (typeof adjustments === "string") {
        entry[mode] = { value: adjustments };
        continue;
      }
      if (typeof adjustments === "object" && !Array.isArray(adjustments)) {
        const record = adjustments as Record<string, unknown>;
        const normalised: TokenAdjustment = {};
        if (typeof record.l === "number") {
          normalised.l = record.l;
        }
        if (typeof record.deltaL === "number") {
          normalised.deltaL = record.deltaL;
        }
        if (typeof record.scaleL === "number") {
          normalised.scaleL = record.scaleL;
        }
        if (typeof record.c === "number") {
          normalised.c = record.c;
        }
        if (typeof record.deltaC === "number") {
          normalised.deltaC = record.deltaC;
        }
        if (typeof record.scaleC === "number") {
          normalised.scaleC = record.scaleC;
        }
        if (typeof record.h === "number") {
          normalised.h = record.h;
        }
        if (typeof record.deltaH === "number") {
          normalised.deltaH = record.deltaH;
        }
        if (typeof record.alpha === "number") {
          normalised.alpha = record.alpha;
        }
        if (typeof record.deltaAlpha === "number") {
          normalised.deltaAlpha = record.deltaAlpha;
        }
        if (typeof record.scaleAlpha === "number") {
          normalised.scaleAlpha = record.scaleAlpha;
        }
        if (typeof record.value === "string" && record.value.trim()) {
          normalised.value = record.value.trim();
        }
        if (typeof record.family === "string" && record.family.trim()) {
          normalised.family = record.family.trim();
        }
        if (Object.keys(normalised).length > 0) {
          entry[mode] = normalised;
        }
      }
    }

    tokensResult[tokenName] = entry;
  }

  return { families, tokens: tokensResult };
}

function buildNormalisedParameters(
  familiesState: FamiliesState,
  tokensState: TokenFormState,
  modeKeys: ThemeModeKey[],
  fallback: NormalisedParameters,
): NormalisedParameters {
  const families: Record<string, Record<ThemeModeKey, NumericOklch>> = {};
  const familyNames = Array.from(
    new Set([...Object.keys(fallback.families), ...Object.keys(familiesState)]),
  ).sort((a, b) => a.localeCompare(b));

  for (const familyName of familyNames) {
    const fallbackModes = fallback.families[familyName];
    const formModes = familiesState[familyName];
    families[familyName] = {} as Record<ThemeModeKey, NumericOklch>;
    for (const mode of modeKeys) {
      const fallbackValue = fallbackModes?.[mode] ?? DEFAULT_FAMILY_COLOR;
      const formValue = formModes?.[mode];
      families[familyName][mode] = {
        l: resolveFamilyNumber(formValue?.l, fallbackValue.l),
        c: resolveFamilyNumber(formValue?.c, fallbackValue.c),
        h: resolveFamilyNumber(formValue?.h, fallbackValue.h),
        alpha: resolveFamilyNumber(formValue?.alpha, fallbackValue.alpha),
      };
    }
  }

  const tokens: Record<string, NormalisedToken> = {};
  const tokenNames = Array.from(
    new Set([...Object.keys(fallback.tokens), ...Object.keys(tokensState)]),
  ).sort((a, b) => a.localeCompare(b));

  for (const tokenName of tokenNames) {
    const formToken = tokensState[tokenName];
    const fallbackToken = fallback.tokens[tokenName];
    const entry: NormalisedToken = {
      family: formToken?.family.trim().length
        ? formToken.family.trim()
        : fallbackToken?.family ?? "neutral",
    };

    const descriptionValue = formToken?.meta.description ?? fallbackToken?.description;
    if (descriptionValue !== undefined) {
      entry.description = descriptionValue;
    }
    const notesValue = formToken?.meta.notes ?? fallbackToken?.notes;
    if (notesValue !== undefined) {
      entry.notes = notesValue;
    }
    const tagsValue = formToken?.meta.tags ?? fallbackToken?.tags;
    if (tagsValue && tagsValue.length > 0) {
      entry.tags = [...tagsValue];
    }

    for (const mode of modeKeys) {
      const formMode = formToken?.modes?.[mode];
      const fallbackMode = fallbackToken?.[mode];
      const adjustments: TokenAdjustment = {};
      const deltaL = parseAdjustmentValue(formMode?.deltaL, fallbackMode?.deltaL);
      if (deltaL !== undefined) {
        adjustments.deltaL = deltaL;
      }
      const scaleLValue = parseAdjustmentValue(formMode?.scaleL, fallbackMode?.scaleL);
      if (scaleLValue !== undefined) {
        adjustments.scaleL = scaleLValue;
      }
      const lValue = parseAdjustmentValue(formMode?.l, fallbackMode?.l);
      if (lValue !== undefined) {
        adjustments.l = lValue;
      }
      const deltaCValue = parseAdjustmentValue(formMode?.deltaC, fallbackMode?.deltaC);
      if (deltaCValue !== undefined) {
        adjustments.deltaC = deltaCValue;
      }
      const cValue = parseAdjustmentValue(formMode?.c, fallbackMode?.c);
      if (cValue !== undefined) {
        adjustments.c = cValue;
      }
      const scaleCValue = parseAdjustmentValue(formMode?.scaleC, fallbackMode?.scaleC);
      if (scaleCValue !== undefined) {
        adjustments.scaleC = scaleCValue;
      }
      const hValue = parseAdjustmentValue(formMode?.h, fallbackMode?.h);
      if (hValue !== undefined) {
        adjustments.h = hValue;
      }
      const deltaHValue = parseAdjustmentValue(formMode?.deltaH, fallbackMode?.deltaH);
      if (deltaHValue !== undefined) {
        adjustments.deltaH = deltaHValue;
      }
      const alphaValue = parseAdjustmentValue(formMode?.alpha, fallbackMode?.alpha);
      if (alphaValue !== undefined) {
        adjustments.alpha = alphaValue;
      }
      const deltaAlphaValue = parseAdjustmentValue(formMode?.deltaAlpha, fallbackMode?.deltaAlpha);
      if (deltaAlphaValue !== undefined) {
        adjustments.deltaAlpha = deltaAlphaValue;
      }
      const scaleAlphaValue = parseAdjustmentValue(formMode?.scaleAlpha, fallbackMode?.scaleAlpha);
      if (scaleAlphaValue !== undefined) {
        adjustments.scaleAlpha = scaleAlphaValue;
      }
      const valueOverride = parseOverrideString(formMode?.value, fallbackMode?.value);
      if (valueOverride) {
        adjustments.value = valueOverride;
      }
      const familyOverride = parseOverrideString(formMode?.family, fallbackMode?.family);
      if (familyOverride) {
        adjustments.family = familyOverride;
      }

      if (Object.keys(adjustments).length > 0) {
        entry[mode] = adjustments;
      }
    }

    tokens[tokenName] = entry;
  }

  return { families, tokens };
}

function resolveThemeModes(
  parameters: NormalisedParameters,
  modeKeys: ThemeModeKey[],
): Record<ThemeModeKey, Record<string, string>> {
  const modeSet = new Set<ThemeModeKey>(modeKeys);
  modeSet.add(LIGHT_MODE);
  modeSet.add(DARK_MODE);
  for (const token of Object.values(parameters.tokens)) {
    for (const key of Object.keys(token)) {
      if (!RESERVED_PARAMETER_KEYS.has(key)) {
        modeSet.add(key as ThemeModeKey);
      }
    }
  }
  const sortedModes = sortModeKeys(Array.from(modeSet));
  const fallbackMode = sortedModes.includes(LIGHT_MODE)
    ? LIGHT_MODE
    : sortedModes[0];
  const resolved: Record<ThemeModeKey, Record<string, string>> = {} as Record<ThemeModeKey, Record<string, string>>;

  for (const mode of sortedModes) {
    resolved[mode] = {};
  }

  for (const mode of sortedModes) {
    for (const tokenName of Object.keys(parameters.tokens).sort((a, b) => a.localeCompare(b))) {
      const definition = parameters.tokens[tokenName];
      const baseFamily = definition.family;
      const adjustments = (definition[mode] ?? {}) as TokenAdjustment;
      const familyName = adjustments.family ?? baseFamily;
      const familyModes = parameters.families[familyName] ?? parameters.families[baseFamily];
      const baseColour =
        familyModes?.[mode]
          ?? (fallbackMode && familyModes ? familyModes[fallbackMode] : undefined)
          ?? (familyModes ? Object.values(familyModes)[0] : undefined);
      if (!baseColour) {
        resolved[mode][tokenName] = "transparent";
        continue;
      }

      if (typeof adjustments.value === "string" && adjustments.value.trim()) {
        resolved[mode][tokenName] = adjustments.value.trim();
        continue;
      }

      const colour: NumericOklch = { ...baseColour };
      if (typeof adjustments.l === "number") {
        colour.l = adjustments.l;
      }
      if (typeof adjustments.deltaL === "number") {
        colour.l += adjustments.deltaL;
      }
      if (typeof adjustments.scaleL === "number") {
        colour.l *= adjustments.scaleL;
      }
      if (typeof adjustments.c === "number") {
        colour.c = adjustments.c;
      }
      if (typeof adjustments.deltaC === "number") {
        colour.c += adjustments.deltaC;
      }
      if (typeof adjustments.scaleC === "number") {
        colour.c *= adjustments.scaleC;
      }
      if (typeof adjustments.h === "number") {
        colour.h = adjustments.h;
      }
      if (typeof adjustments.deltaH === "number") {
        colour.h += adjustments.deltaH;
      }
      if (typeof adjustments.alpha === "number") {
        colour.alpha = adjustments.alpha;
      }
      if (typeof adjustments.deltaAlpha === "number") {
        colour.alpha += adjustments.deltaAlpha;
      }
      if (typeof adjustments.scaleAlpha === "number") {
        colour.alpha *= adjustments.scaleAlpha;
      }

      resolved[mode][tokenName] = formatOklchValue(colour);
    }
  }

  return resolved;
}

export type WebsiteThemeSettingsManagerProps = {
  initialSettings: ClientWebsiteSettings;
  initialThemes: ClientWebsiteThemeSummary[];
};

export function WebsiteThemeSettingsManager({ initialSettings, initialThemes }: WebsiteThemeSettingsManagerProps) {
  const mergedThemeSummaries = sortThemeSummaries(
    Array.from(
      new Map(
        [
          ...initialThemes.map((theme) => [theme.id, theme] as const),
          [initialSettings.theme.id, themeToSummary(initialSettings.theme)] as const,
        ],
      ).values(),
    ),
  );

  const [siteSnapshot, setSiteSnapshot] = useState(() => ({
    id: initialSettings.id,
    siteTitle: initialSettings.siteTitle,
    colorMode: initialSettings.colorMode,
    updatedAt: initialSettings.updatedAt,
    activeThemeId: initialSettings.theme.id,
    maintenanceMode: initialSettings.maintenanceMode,
  }));
  const [siteTitle, setSiteTitle] = useState(initialSettings.siteTitle);
  const [colorMode, setColorMode] = useState<ThemeColorMode>(initialSettings.colorMode);
  const [maintenanceMode, setMaintenanceMode] = useState(initialSettings.maintenanceMode);
  const [availableThemes, setAvailableThemes] = useState<ClientWebsiteThemeSummary[]>(mergedThemeSummaries);
  const [themeBaselines, setThemeBaselines] = useState<Record<string, ClientWebsiteTheme>>({
    [initialSettings.theme.id]: initialSettings.theme,
  });
  const [currentTheme, setCurrentTheme] = useState<ClientWebsiteTheme>(initialSettings.theme);
  const [themeName, setThemeName] = useState(initialSettings.theme.name);
  const [themeDescription, setThemeDescription] = useState(initialSettings.theme.description ?? "");
  const [radius, setRadius] = useState(initialSettings.theme.tokens.radius.base);
  const [familiesState, setFamiliesState] = useState<FamiliesState>(() =>
    createFamilyFormState(
      initialSettings.theme.tokens.parameters,
      deriveModeKeysFromTokens(initialSettings.theme.tokens),
    ),
  );
  const [tokensState, setTokensState] = useState<TokenFormState>(() =>
    createTokenFormState(
      initialSettings.theme.tokens.parameters,
      deriveModeKeysFromTokens(initialSettings.theme.tokens),
    ),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [familyHexDrafts, setFamilyHexDrafts] = useState<FamilyHexDraftState>({});
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});
  const [showSemanticTokens, setShowSemanticTokens] = useState(false);
  const [isLoadingTheme, setIsLoadingTheme] = useState(false);
  const [isCreatingTheme, setIsCreatingTheme] = useState(false);
  const [isDuplicatingTheme, setIsDuplicatingTheme] = useState(false);
  const [isActivatingTheme, setIsActivatingTheme] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const activeThemeSummary = useMemo(
    () => availableThemes.find((theme) => theme.id === siteSnapshot.activeThemeId),
    [availableThemes, siteSnapshot.activeThemeId],
  );

  const modeKeys = useMemo(
    () => deriveModeKeysFromTokens(currentTheme.tokens),
    [currentTheme.tokens],
  );

  const fallbackParameters = useMemo(
    () => normaliseParameters(currentTheme.tokens, modeKeys),
    [currentTheme.tokens, modeKeys],
  );

  const formParameters = useMemo(
    () => buildNormalisedParameters(familiesState, tokensState, modeKeys, fallbackParameters),
    [familiesState, tokensState, modeKeys, fallbackParameters],
  );

  const parameters = useMemo<NormalisedParameters>(
    () =>
      showSemanticTokens
        ? formParameters
        : {
            ...formParameters,
            tokens: fallbackParameters.tokens,
          },
    [showSemanticTokens, formParameters, fallbackParameters],
  );

  const previewModes = useMemo(
    () => resolveThemeModes(parameters, modeKeys),
    [parameters, modeKeys],
  );

  const previewTokens = useMemo<ThemeTokens>(
    () =>
      ({
        radius: { base: radius },
        parameters: parameters as unknown as ThemeTokens["parameters"],
        modes: previewModes as unknown as ThemeTokens["modes"],
        meta: {
          ...(currentTheme.tokens.meta ?? {}),
          modes: modeKeys,
        },
      }) as ThemeTokens,
    [parameters, previewModes, radius, currentTheme.tokens.meta, modeKeys],
  );

  const lastSavedIso = currentTheme.updatedAt ?? siteSnapshot.updatedAt;
  const lastSavedLabel = lastSavedIso
    ? UPDATED_AT_FORMATTER.format(new Date(lastSavedIso))
    : "Noch nie gespeichert";

  const isDirty = useMemo(() => {
    if (siteTitle.trim() !== siteSnapshot.siteTitle.trim()) {
      return true;
    }
    if (colorMode !== siteSnapshot.colorMode) {
      return true;
    }
    if (maintenanceMode !== siteSnapshot.maintenanceMode) {
      return true;
    }
    if (themeName.trim() !== currentTheme.name.trim()) {
      return true;
    }
    if ((themeDescription ?? "").trim() !== (currentTheme.description ?? "").trim()) {
      return true;
    }
    if (radius.trim() !== currentTheme.tokens.radius.base.trim()) {
      return true;
    }
    const familiesChanged =
      JSON.stringify(formParameters.families) !== JSON.stringify(fallbackParameters.families);
    if (familiesChanged) {
      return true;
    }
    const tokensChanged =
      JSON.stringify(formParameters.tokens) !== JSON.stringify(fallbackParameters.tokens);
    if (showSemanticTokens && tokensChanged) {
      return true;
    }
    return false;
  }, [
    siteTitle,
    colorMode,
    themeName,
    themeDescription,
    radius,
    formParameters,
    fallbackParameters,
    showSemanticTokens,
    siteSnapshot,
    currentTheme,
    maintenanceMode,
  ]);

  const renameDisabled = isRenaming || isSaving || isLoadingTheme || currentTheme.isDefault;

  useEffect(() => {
    const styleElement = document.getElementById("website-theme-style") as HTMLStyleElement | null;
    if (!styleElement) {
      return;
    }
    styleElement.textContent = createThemeCss(previewTokens);
  }, [previewTokens]);

  useEffect(() => {
    const savedCss = createThemeCss(currentTheme.tokens);
    return () => {
      const styleElement = document.getElementById("website-theme-style") as HTMLStyleElement | null;
      if (!styleElement) {
        return;
      }
      styleElement.textContent = savedCss;
    };
  }, [currentTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-color-mode", colorMode);
  }, [colorMode]);

  useEffect(() => {
    const modeOnUnmount = siteSnapshot.colorMode;
    return () => {
      document.documentElement.setAttribute("data-color-mode", modeOnUnmount);
    };
  }, [siteSnapshot.colorMode]);

  const familyNames = useMemo(
    () => Object.keys(familiesState).sort((a, b) => a.localeCompare(b)),
    [familiesState],
  );
  const tokenNames = useMemo(
    () => Object.keys(tokensState).sort((a, b) => a.localeCompare(b)),
    [tokensState],
  );

  function clearFamilyHexDraft(familyName: string, mode: ThemeModeKey) {
    setFamilyHexDrafts((prev) => {
      const familyDraft = prev[familyName];
      if (!familyDraft || familyDraft[mode] === undefined) {
        return prev;
      }
      const nextFamily = { ...familyDraft };
      delete nextFamily[mode];
      const nextState = { ...prev };
      if (Object.keys(nextFamily).length > 0) {
        nextState[familyName] = nextFamily;
      } else {
        delete nextState[familyName];
      }
      return nextState;
    });
  }

  function applyFamilyOklch(familyName: string, mode: ThemeModeKey, colour: OklchColor) {
    const nextColour: NumericOklch = {
      l: toFormNumber(clamp(colour.l, 0, 1)),
      c: toFormNumber(Math.max(colour.c, 0)),
      h: toFormNumber(wrapHue(colour.h)),
      alpha: toFormNumber(clamp(colour.alpha ?? 1, 0, 1)),
    };
    setFamiliesState((prev) => ({
      ...prev,
      [familyName]: {
        ...(prev[familyName] ?? {}),
        [mode]: {
          l: nextColour.l,
          c: nextColour.c,
          h: nextColour.h,
          alpha: nextColour.alpha,
        },
      },
    }));
  }

  function handleFamilyColorInput(familyName: string, mode: ThemeModeKey, hexValue: string) {
    const parsed = hexToOklch(hexValue);
    if (!parsed) {
      return;
    }
    applyFamilyOklch(familyName, mode, parsed);
    clearFamilyHexDraft(familyName, mode);
  }

  function handleFamilyHexInput(familyName: string, mode: ThemeModeKey, hexValue: string) {
    setFamilyHexDrafts((prev) => ({
      ...prev,
      [familyName]: {
        ...(prev[familyName] ?? {}),
        [mode]: hexValue,
      },
    }));
    const parsed = hexToOklch(hexValue);
    if (!parsed) {
      return;
    }
    applyFamilyOklch(familyName, mode, parsed);
    clearFamilyHexDraft(familyName, mode);
  }

  function handleFamilyHexBlur(familyName: string, mode: ThemeModeKey, hexValue: string) {
    const parsed = hexToOklch(hexValue);
    if (!parsed) {
      clearFamilyHexDraft(familyName, mode);
    }
  }

  function populateFormFromTheme(theme: ClientWebsiteTheme) {
    setThemeName(theme.name);
    setThemeDescription(theme.description ?? "");
    setRadius(theme.tokens.radius.base);
    const nextModeKeys = deriveModeKeysFromTokens(theme.tokens);
    setFamiliesState(createFamilyFormState(theme.tokens.parameters, nextModeKeys));
    setTokensState(createTokenFormState(theme.tokens.parameters, nextModeKeys));
    setFamilyHexDrafts({});
    setExpandedFamilies({});
  }

  function applyThemeBaseline(theme: ClientWebsiteTheme, { updateMap = true } = {}) {
    if (updateMap) {
      setThemeBaselines((prev) => ({
        ...prev,
        [theme.id]: theme,
      }));
    }
    setCurrentTheme(theme);
    populateFormFromTheme(theme);
  }

  function resetToBaseline() {
    setSiteTitle(siteSnapshot.siteTitle);
    setColorMode(siteSnapshot.colorMode);
    setMaintenanceMode(siteSnapshot.maintenanceMode);
    populateFormFromTheme(currentTheme);
  }

  function handleFamilyChange(
    familyName: string,
    mode: ThemeModeKey,
    field: keyof FamilyFormFields,
    value: string,
  ) {
    setFamiliesState((prev) => ({
      ...prev,
      [familyName]: {
        ...(prev[familyName] ?? {}),
        [mode]: {
          ...(prev[familyName]?.[mode] ?? { l: "", c: "", h: "", alpha: "" }),
          [field]: value,
        },
      },
    }));
    clearFamilyHexDraft(familyName, mode);
  }

  function handleTokenFamilyChange(tokenName: string, family: string) {
    setTokensState((prev) => ({
      ...prev,
      [tokenName]: {
        ...(prev[tokenName] ?? { family: "", modes: {} as Record<ThemeModeKey, TokenModeFields>, meta: {} }),
        family,
      },
    }));
  }

  function handleTokenAdjustmentChange(
    tokenName: string,
    mode: ThemeModeKey,
    field: keyof TokenModeFields,
    value: string,
  ) {
    setTokensState((prev) => ({
      ...prev,
      [tokenName]: {
        ...(prev[tokenName] ?? {
          family: "",
          modes: {} as Record<ThemeModeKey, TokenModeFields>,
          meta: {},
        }),
        modes: {
          ...(prev[tokenName]?.modes ?? {}),
          [mode]: {
            ...(prev[tokenName]?.modes?.[mode] ?? {
              l: "",
              deltaL: "",
              scaleL: "",
              c: "",
              deltaC: "",
              scaleC: "",
              h: "",
              deltaH: "",
              alpha: "",
              deltaAlpha: "",
              scaleAlpha: "",
              value: "",
              family: "",
            }),
            [field]: value,
          },
        },
      },
    }));
  }

  async function handleThemeSelect(themeId: string) {
    if (themeId === currentTheme.id) {
      return;
    }
    const cachedTheme = themeBaselines[themeId];
    if (cachedTheme) {
      applyThemeBaseline(cachedTheme, { updateMap: false });
      return;
    }

    setIsLoadingTheme(true);
    try {
      const response = await fetch(`/api/website/themes/${themeId}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.theme) {
        const message = data?.error ?? "Theme konnte nicht geladen werden.";
        throw new Error(message);
      }

      const theme = data.theme as ClientWebsiteTheme;
      setAvailableThemes((prev) => {
        const map = new Map(prev.map((entry) => [entry.id, entry] as const));
        map.set(theme.id, themeToSummary(theme));
        return sortThemeSummaries(Array.from(map.values()));
      });
      applyThemeBaseline(theme);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Theme konnte nicht geladen werden.");
    } finally {
      setIsLoadingTheme(false);
    }
  }

  async function handleCreateThemeClick() {
    setIsCreatingTheme(true);
    try {
      const response = await fetch("/api/website/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.theme) {
        const message = data?.error ?? "Theme konnte nicht erstellt werden.";
        throw new Error(message);
      }
      const theme = data.theme as ClientWebsiteTheme;
      setAvailableThemes((prev) => {
        const map = new Map(prev.map((entry) => [entry.id, entry] as const));
        map.set(theme.id, themeToSummary(theme));
        return sortThemeSummaries(Array.from(map.values()));
      });
      applyThemeBaseline(theme);
      toast.success("Neues Theme angelegt.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Theme konnte nicht erstellt werden.");
    } finally {
      setIsCreatingTheme(false);
    }
  }

  async function handleDuplicateThemeClick() {
    setIsDuplicatingTheme(true);
    try {
      const response = await fetch("/api/website/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceThemeId: currentTheme.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.theme) {
        const message = data?.error ?? "Theme konnte nicht dupliziert werden.";
        throw new Error(message);
      }
      const theme = data.theme as ClientWebsiteTheme;
      setAvailableThemes((prev) => {
        const map = new Map(prev.map((entry) => [entry.id, entry] as const));
        map.set(theme.id, themeToSummary(theme));
        return sortThemeSummaries(Array.from(map.values()));
      });
      applyThemeBaseline(theme);
      toast.success("Theme dupliziert.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Theme konnte nicht dupliziert werden.");
    } finally {
      setIsDuplicatingTheme(false);
    }
  }

  function openRenameDialog() {
    if (currentTheme.isDefault) {
      toast.info("Das Standard-Theme kann nicht umbenannt werden.");
      return;
    }
    setRenameValue(themeName);
    setRenameDialogOpen(true);
  }

  async function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameValue.trim()) {
      toast.error("Der Theme-Name darf nicht leer sein.");
      return;
    }
    if (currentTheme.isDefault) {
      toast.error("Das Standard-Theme kann nicht umbenannt werden.");
      setRenameDialogOpen(false);
      return;
    }
    setIsRenaming(true);
    try {
      const response = await fetch(`/api/website/themes/${currentTheme.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.theme) {
        const message = data?.error ?? "Theme konnte nicht umbenannt werden.";
        throw new Error(message);
      }
      const theme = data.theme as ClientWebsiteTheme;
      setRenameValue(theme.name);
      setAvailableThemes((prev) => {
        const map = new Map(prev.map((entry) => [entry.id, entry] as const));
        map.set(theme.id, themeToSummary(theme));
        return sortThemeSummaries(Array.from(map.values()));
      });
      applyThemeBaseline(theme);
      toast.success("Theme umbenannt.");
      setRenameDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Theme konnte nicht umbenannt werden.");
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleActivateThemeClick() {
    setIsActivatingTheme(true);
    try {
      const response = await fetch("/api/website/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { themeId: currentTheme.id },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.settings) {
        const message = data?.error ?? "Theme konnte nicht aktiviert werden.";
        throw new Error(message);
      }
      const nextSettings = data.settings as ClientWebsiteSettings;
      setSiteSnapshot({
        id: nextSettings.id,
        siteTitle: nextSettings.siteTitle,
        colorMode: nextSettings.colorMode,
        updatedAt: nextSettings.updatedAt,
        activeThemeId: nextSettings.theme.id,
        maintenanceMode: nextSettings.maintenanceMode,
      });
      setSiteTitle(nextSettings.siteTitle);
      setColorMode(nextSettings.colorMode);
      setMaintenanceMode(nextSettings.maintenanceMode);
      setAvailableThemes((prev) => {
        const map = new Map(prev.map((entry) => [entry.id, entry] as const));
        map.set(nextSettings.theme.id, themeToSummary(nextSettings.theme));
        return sortThemeSummaries(Array.from(map.values()));
      });
      if (nextSettings.theme.id === currentTheme.id) {
        applyThemeBaseline(nextSettings.theme);
      }
      toast.success("Theme aktiviert.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Theme konnte nicht aktiviert werden.");
    } finally {
      setIsActivatingTheme(false);
    }
  }

  async function handleSave(activateTheme = currentTheme.id === siteSnapshot.activeThemeId) {
    setIsSaving(true);
    try {
      const settingsPayload: Record<string, unknown> = {
        siteTitle,
        colorMode,
        maintenanceMode,
      };
      if (activateTheme) {
        settingsPayload.themeId = currentTheme.id;
      }

      const response = await fetch("/api/website/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: settingsPayload,
          theme: {
            id: currentTheme.id,
            name: themeName,
            description: themeDescription.length > 0 ? themeDescription : null,
            tokens: {
              radius: { base: radius },
              parameters,
              modes: previewModes,
              meta: {
                ...(currentTheme.tokens.meta ?? {}),
                modes: modeKeys,
                generatedAt: new Date().toISOString(),
              },
            },
          },
          activateTheme,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error ?? "Die Einstellungen konnten nicht gespeichert werden.";
        throw new Error(message);
      }

      if (!data?.settings) {
        throw new Error("Die Einstellungen konnten nicht gespeichert werden.");
      }

      const nextSettings = data.settings as ClientWebsiteSettings;
      const savedTheme = (data.theme as ClientWebsiteTheme | undefined) ?? null;
      const activeTheme = nextSettings.theme;

      setSiteSnapshot({
        id: nextSettings.id,
        siteTitle: nextSettings.siteTitle,
        colorMode: nextSettings.colorMode,
        updatedAt: nextSettings.updatedAt,
        activeThemeId: nextSettings.theme.id,
        maintenanceMode: nextSettings.maintenanceMode,
      });
      setSiteTitle(nextSettings.siteTitle);
      setColorMode(nextSettings.colorMode);
      setMaintenanceMode(nextSettings.maintenanceMode);

      setAvailableThemes((prev) => {
        const map = new Map(prev.map((theme) => [theme.id, theme] as const));
        map.set(activeTheme.id, themeToSummary(activeTheme));
        if (savedTheme) {
          map.set(savedTheme.id, themeToSummary(savedTheme));
        }
        return sortThemeSummaries(Array.from(map.values()));
      });

      if (savedTheme && savedTheme.id === currentTheme.id) {
        applyThemeBaseline(savedTheme);
      } else if (activeTheme.id === currentTheme.id) {
        applyThemeBaseline(activeTheme);
      } else {
        populateFormFromTheme(currentTheme);
      }

      toast.success(activateTheme ? "Theme gespeichert und aktiviert." : "Website-Theme gespeichert.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Theme-Verwaltung</CardTitle>
          <p className="text-sm text-muted-foreground">
            Verwalte mehrere Themes, lege Varianten an und aktiviere die gewünschte Gestaltung.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="theme-select">Theme auswählen</Label>
            <Select
              value={currentTheme.id}
              onValueChange={handleThemeSelect}
              disabled={isLoadingTheme || isCreatingTheme || isDuplicatingTheme || isSaving}
            >
              <SelectTrigger id="theme-select">
                <SelectValue placeholder="Theme auswählen" />
              </SelectTrigger>
              <SelectContent>
                {availableThemes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.name}
                    {theme.id === siteSnapshot.activeThemeId ? " • Aktiv" : ""}
                    {theme.isDefault ? " • Standard" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={handleCreateThemeClick}
              disabled={isCreatingTheme || isDuplicatingTheme || isSaving}
              data-state={isCreatingTheme ? "loading" : undefined}
            >
              {isCreatingTheme ? "Theme wird erstellt…" : "Neues Theme"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDuplicateThemeClick}
              disabled={isDuplicatingTheme || isCreatingTheme || isSaving}
              data-state={isDuplicatingTheme ? "loading" : undefined}
            >
              {isDuplicatingTheme ? "Theme wird dupliziert…" : "Theme duplizieren"}
            </Button>
            {currentTheme.isDefault ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openRenameDialog}
                        disabled={renameDisabled}
                        data-state={isRenaming ? "loading" : undefined}
                      >
                        Umbenennen
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="center" className="max-w-xs text-center">
                    Standard-Themes können nicht umbenannt werden.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={openRenameDialog}
                disabled={renameDisabled}
                data-state={isRenaming ? "loading" : undefined}
              >
                Umbenennen
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleActivateThemeClick}
              disabled={
                isActivatingTheme
                || isSaving
                || isLoadingTheme
                || currentTheme.id === siteSnapshot.activeThemeId
              }
              data-state={isActivatingTheme ? "loading" : undefined}
            >
              {isActivatingTheme ? "Aktiviere…" : "Theme aktivieren"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Aktives Theme:{" "}
              <span className="font-medium text-foreground">
                {activeThemeSummary?.name ?? "Unbekannt"}
              </span>
            </span>
            {currentTheme.isDefault ? <Badge variant="outline">Standard</Badge> : null}
            <Badge variant={currentTheme.id === siteSnapshot.activeThemeId ? "default" : "outline"}>
              {currentTheme.id === siteSnapshot.activeThemeId ? "Aktuell ausgewählt" : "Inaktiv"}
            </Badge>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Allgemeine Einstellungen</CardTitle>
          <p className="text-sm text-muted-foreground">
            Lege den sichtbaren Seitentitel und den bevorzugten Standardmodus fest.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="site-title">Website-Titel</Label>
              <Input
                id="site-title"
                value={siteTitle}
                maxLength={160}
                onChange={(event) => setSiteTitle(event.target.value)}
                placeholder="Sommertheater im Schlosspark"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color-mode">Standardmodus</Label>
              <Select value={colorMode} onValueChange={(value) => setColorMode(value as ThemeColorMode)}>
                <SelectTrigger id="color-mode">
                  <SelectValue placeholder="Modus wählen" />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Wartungsmodus</p>
                <p className="text-xs text-muted-foreground">
                  Blendet die öffentliche Website aus. Angemeldete Mitglieder behalten weiterhin vollen Zugriff.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={maintenanceMode}
                onClick={() => setMaintenanceMode((prev) => !prev)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  maintenanceMode
                    ? "border-warning/60 bg-warning/70"
                    : "border-border/70 bg-background",
                )}
              >
                <span className="sr-only">Wartungsmodus umschalten</span>
                <span
                  aria-hidden
                  className={cn(
                    "inline-block h-5 w-5 rounded-full bg-background shadow transition-transform",
                    maintenanceMode ? "translate-x-5" : "translate-x-1",
                  )}
                />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={maintenanceMode ? "warning" : "muted"}>
                {maintenanceMode ? "Aktiv" : "Deaktiviert"}
              </Badge>
              <span className="text-muted-foreground">
                {maintenanceMode
                  ? "Besucher sehen eine Wartungsmeldung, der Login bleibt erreichbar."
                  : "Die Website ist öffentlich sichtbar."}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Parametrische Theme-Farben</CardTitle>
          <p className="text-sm text-muted-foreground">
            Steuere zuerst die OKLCH-Basiswerte der Farbfamilien und passe anschließend die semantischen Token pro Modus an.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="theme-name">Theme-Name</Label>
              <Input
                id="theme-name"
                value={themeName}
                maxLength={120}
                onChange={(event) => setThemeName(event.target.value)}
                placeholder="z. B. Sommertheater Standard"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme-radius">Grund-Radius</Label>
              <Input
                id="theme-radius"
                value={radius}
                maxLength={60}
                onChange={(event) => setRadius(event.target.value)}
                placeholder="0.625rem"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme-description">Beschreibung</Label>
            <Textarea
              id="theme-description"
              value={themeDescription}
              onChange={(event) => setThemeDescription(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Optionaler Hinweis zum Theme"
            />
          </div>

          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">Farbfamilien</h3>
              <p className="text-sm text-muted-foreground">
                Definiere die OKLCH-Ausgangswerte pro Familie und Modus. Diese Werte bilden die Grundlage für alle Ableitungen.
              </p>
            </div>
            <div className="space-y-4">
              {familyNames.map((family) => {
                const isAdvancedVisible = expandedFamilies[family] ?? false;
                return (
                  <div key={family} className="space-y-4 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-medium">{formatFamilyLabel(family)}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setExpandedFamilies((prev) => ({
                              ...prev,
                              [family]: !isAdvancedVisible,
                            }))
                          }
                        >
                          <span>Erweitert</span>
                          {isAdvancedVisible ? (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          )}
                        </Button>
                        <div className="flex gap-2">
                          {modeKeys.map((mode) => {
                            const previewColour =
                              parameters.families[family]?.[mode] ??
                              fallbackParameters.families[family]?.[mode] ??
                              DEFAULT_FAMILY_COLOR;
                            return (
                              <span
                                key={`${family}-${mode}-swatch`}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60"
                                style={{
                                  backgroundColor: formatOklchValue(previewColour),
                                }}
                                aria-label={`${formatFamilyLabel(family)} ${getModeLabel(mode)} Vorschau`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {modeKeys.map((mode) => {
                        const modeState = familiesState[family]?.[mode];
                        const baseId = `${family}-${mode}`;
                        const resolvedColour =
                          parameters.families[family]?.[mode] ??
                          fallbackParameters.families[family]?.[mode] ??
                          DEFAULT_FAMILY_COLOR;
                        const showAlpha = (resolvedColour.alpha ?? 1) < 0.999;
                        const hexDraft = familyHexDrafts[family]?.[mode];
                        const hexValue =
                          hexDraft ??
                          oklchToHex(resolvedColour, {
                            includeAlpha: showAlpha,
                          });
                        const colorInputValue = oklchToHex(
                          { ...resolvedColour, alpha: 1 },
                          { includeAlpha: false },
                        );
                        return (
                          <div key={`${family}-${mode}`} className="space-y-3 rounded-md border p-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {getModeLabel(mode)}
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label htmlFor={`${baseId}-hex`} className="text-xs">
                                  Hex-Farbe
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id={`${baseId}-color`}
                                    type="color"
                                    value={colorInputValue}
                                    aria-label={`${formatFamilyLabel(family)} ${getModeLabel(mode)} Farbwahl`}
                                    className="h-10 w-12 min-w-[3rem] cursor-pointer rounded-md px-1 py-1"
                                    onChange={(event) =>
                                      handleFamilyColorInput(family, mode, event.target.value)
                                    }
                                  />
                                  <Input
                                    id={`${baseId}-hex`}
                                    value={hexValue}
                                    onChange={(event) =>
                                      handleFamilyHexInput(family, mode, event.target.value)
                                    }
                                    onBlur={(event) =>
                                      handleFamilyHexBlur(family, mode, event.target.value)
                                    }
                                    placeholder="#RRGGBB"
                                    spellCheck={false}
                                    autoComplete="off"
                                    className="font-mono uppercase"
                                  />
                                </div>
                              </div>
                              {isAdvancedVisible ? (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label htmlFor={`${baseId}-l`} className="text-xs">
                                      L
                                    </Label>
                                    <Input
                                      id={`${baseId}-l`}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="1"
                                      value={modeState?.l ?? ""}
                                      onChange={(event) =>
                                        handleFamilyChange(family, mode, "l", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`${baseId}-c`} className="text-xs">
                                      Chroma
                                    </Label>
                                    <Input
                                      id={`${baseId}-c`}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={modeState?.c ?? ""}
                                      onChange={(event) =>
                                        handleFamilyChange(family, mode, "c", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`${baseId}-h`} className="text-xs">
                                      Hue
                                    </Label>
                                    <Input
                                      id={`${baseId}-h`}
                                      type="number"
                                      step="0.1"
                                      value={modeState?.h ?? ""}
                                      onChange={(event) =>
                                        handleFamilyChange(family, mode, "h", event.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label htmlFor={`${baseId}-alpha`} className="text-xs">
                                      Alpha
                                    </Label>
                                    <Input
                                      id={`${baseId}-alpha`}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="1"
                                      value={modeState?.alpha ?? ""}
                                      onChange={(event) =>
                                        handleFamilyChange(family, mode, "alpha", event.target.value)
                                      }
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Semantische Token</h3>
                <p className="text-sm text-muted-foreground">
                  {showSemanticTokens
                    ? "Weise jeder Rolle eine Farbfamilie zu und definiere bei Bedarf Modus-spezifische Anpassungen. Manuelle Werte überschreiben die automatische Ableitung aus den Farbfamilien."
                    : "Im einfachen Modus werden die Farben der Farbfamilien automatisch auf alle Tokens angewandt. Öffne den erweiterten Modus, um einzelne Tokens gezielt zu überschreiben."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowSemanticTokens((prev) => !prev)}
                  className={cn(
                    "text-xs font-semibold hover:text-foreground",
                    showSemanticTokens ? "text-foreground" : "text-muted-foreground",
                  )}
                  aria-expanded={showSemanticTokens}
                  aria-controls={SEMANTIC_TOKEN_SECTION_ID}
                  aria-pressed={showSemanticTokens}
                  data-state={showSemanticTokens ? "open" : "closed"}
                >
                  {showSemanticTokens ? (
                    <>
                      <ChevronDown className="h-4 w-4" aria-hidden />
                      <span>Erweiterten Modus verbergen</span>
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4" aria-hidden />
                      <span>Erweiterten Modus anzeigen</span>
                    </>
                  )}
                </Button>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Info className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Hinweis zum erweiterten Modus</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-left" side="bottom" align="end">
                      Manuelle Anpassungen im erweiterten Modus überschreiben die automatische Ableitung aus den Farbfamilien. Lass den Modus ausgeblendet, wenn alle Tokens den Familienwert übernehmen sollen.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            {showSemanticTokens ? (
              <div id={SEMANTIC_TOKEN_SECTION_ID} className="space-y-6">
                {tokenNames.map((token) => {
                  const tokenState = tokensState[token];
                  return (
                    <div key={token} className="space-y-4 rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">{formatTokenLabel(token)}</Label>
                          <p className="text-xs text-muted-foreground">
                            Basisfamilie und Ableitungen für {formatTokenLabel(token)}.
                          </p>
                        </div>
                        <Select
                          value={tokenState?.family ?? ""}
                          onValueChange={(value) => handleTokenFamilyChange(token, value)}
                        >
                          <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Familie wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {familyNames.map((family) => (
                              <SelectItem key={`${token}-${family}`} value={family}>
                                {formatFamilyLabel(family)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {modeKeys.map((mode) => {
                          const modeState = tokenState?.modes?.[mode];
                          const baseId = `${token}-${mode}`;
                          return (
                            <div key={`${token}-${mode}`} className="space-y-3 rounded-md border p-3">
                              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                <span>{getModeLabel(mode)}</span>
                                <span
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60"
                                  style={{ backgroundColor: previewModes[mode]?.[token] ?? "transparent" }}
                                  aria-label={`${formatTokenLabel(token)} ${getModeLabel(mode)} Vorschau`}
                                />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <Label htmlFor={`${baseId}-l`} className="text-xs">
                                    L
                                  </Label>
                                  <Input
                                    id={`${baseId}-l`}
                                    type="number"
                                    step="0.01"
                                    value={modeState?.l ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "l", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`${baseId}-deltaL`} className="text-xs">
                                    ΔL
                                  </Label>
                                  <Input
                                    id={`${baseId}-deltaL`}
                                    type="number"
                                    step="0.01"
                                    value={modeState?.deltaL ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "deltaL", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                  <Label htmlFor={`${baseId}-scaleL`} className="text-xs">
                                    Scale L
                                  </Label>
                                  <Input
                                    id={`${baseId}-scaleL`}
                                    type="number"
                                    step="0.01"
                                    value={modeState?.scaleL ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "scaleL", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`${baseId}-c`} className="text-xs">
                                    Chroma
                                  </Label>
                                  <Input
                                    id={`${baseId}-c`}
                                    type="number"
                                    step="0.01"
                                    value={modeState?.c ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "c", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`${baseId}-deltaC`} className="text-xs">
                                    ΔChroma
                                  </Label>
                                  <Input
                                    id={`${baseId}-deltaC`}
                                    type="number"
                                    step="0.01"
                                    value={modeState?.deltaC ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "deltaC", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                  <Label htmlFor={`${baseId}-scaleC`} className="text-xs">
                                    Scale Chroma
                                  </Label>
                                  <Input
                                    id={`${baseId}-scaleC`}
                                    type="number"
                                    step="0.01"
                                    value={modeState?.scaleC ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "scaleC", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`${baseId}-h`} className="text-xs">
                                    Hue
                                  </Label>
                                  <Input
                                    id={`${baseId}-h`}
                                    type="number"
                                    step="0.1"
                                    value={modeState?.h ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "h", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`${baseId}-deltaH`} className="text-xs">
                                    ΔHue
                                  </Label>
                                  <Input
                                    id={`${baseId}-deltaH`}
                                    type="number"
                                    step="0.1"
                                    value={modeState?.deltaH ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "deltaH", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`${baseId}-alpha`} className="text-xs">
                                    Alpha
                                  </Label>
                                  <Input
                                    id={`${baseId}-alpha`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    value={modeState?.alpha ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "alpha", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label htmlFor={`${baseId}-deltaAlpha`} className="text-xs">
                                    ΔAlpha
                                  </Label>
                                  <Input
                                    id={`${baseId}-deltaAlpha`}
                                    type="number"
                                    step="0.01"
                                    value={modeState?.deltaAlpha ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "deltaAlpha", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                  <Label htmlFor={`${baseId}-scaleAlpha`} className="text-xs">
                                    Scale Alpha
                                  </Label>
                                  <Input
                                    id={`${baseId}-scaleAlpha`}
                                    type="number"
                                    step="0.01"
                                    value={modeState?.scaleAlpha ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "scaleAlpha", event.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                  <Label htmlFor={`${baseId}-value`} className="text-xs">
                                    Direktwert
                                  </Label>
                                  <Input
                                    id={`${baseId}-value`}
                                    value={modeState?.value ?? ""}
                                    onChange={(event) =>
                                      handleTokenAdjustmentChange(token, mode, "value", event.target.value)
                                    }
                                    placeholder="Optionaler CSS-Wert, überschreibt LCH"
                                  />
                                </div>
                                <div className="space-y-1 sm:col-span-2">
                                  <Label htmlFor={`${baseId}-family`} className="text-xs">
                                    Familien-Override
                                  </Label>
                                  <Select
                                    value={
                                      modeState?.family && modeState.family.trim().length > 0
                                        ? modeState.family
                                        : FAMILY_INHERIT_VALUE
                                    }
                                    onValueChange={(value) =>
                                      handleTokenAdjustmentChange(
                                        token,
                                        mode,
                                        "family",
                                        value === FAMILY_INHERIT_VALUE ? "" : value,
                                      )
                                    }
                                  >
                                    <SelectTrigger id={`${baseId}-family`}>
                                      <SelectValue placeholder="Basis nutzen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={FAMILY_INHERIT_VALUE}>Basisfamilie verwenden</SelectItem>
                                      {familyNames.map((familyOption) => (
                                        <SelectItem key={`${baseId}-family-${familyOption}`} value={familyOption}>
                                          {formatFamilyLabel(familyOption)}
                                        </SelectItem>
                                      ))}
                                      {modeState?.family && modeState.family.trim().length > 0 &&
                                      !familyNames.includes(modeState.family) ? (
                                        <SelectItem value={modeState.family}>{modeState.family}</SelectItem>
                                      ) : null}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Zuletzt gespeichert: <span className="font-medium text-foreground">{lastSavedLabel}</span>
        </p>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={resetToBaseline}
            disabled={isSaving || !isDirty || isLoadingTheme}
          >
            Änderungen verwerfen
          </Button>
          {currentTheme.id !== siteSnapshot.activeThemeId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={isSaving || !isDirty || isLoadingTheme}
              data-state={isSaving ? "loading" : undefined}
            >
              {isSaving ? "Speichern…" : "Speichern & aktivieren"}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving || !isDirty || isLoadingTheme}
            data-state={isSaving ? "loading" : undefined}
          >
            {isSaving ? "Speichern…" : "Theme speichern"}
          </Button>
        </div>
      </div>
      <Dialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          setRenameDialogOpen(open);
          if (!open) {
            setRenameValue(themeName);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Theme umbenennen</DialogTitle>
              <DialogDescription>
                Vergib einen neuen Namen für <span className="font-medium text-foreground">{currentTheme.name}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="theme-rename">Neuer Theme-Name</Label>
              <Input
                id="theme-rename"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                maxLength={120}
                placeholder="Theme-Bezeichnung"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameDialogOpen(false)}
                disabled={isRenaming}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={isRenaming}
                data-state={isRenaming ? "loading" : undefined}
              >
                {isRenaming ? "Speichern…" : "Umbenennen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
