"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { InfoIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cssColorToHex, hexToOklchValue } from "@/lib/theme/color-value";
import {
  CHART_VARIABLES,
  CORE_COLOR_VARIABLES,
  SHADOW_VARIABLES,
  SIDEBAR_VARIABLES,
  STATUS_COLOR_VARIABLES,
  THEME_COLOR_SCHEMES,
  TWEAKCN_THEME_FORMAT,
  createTweakcnThemeCss,
  toThemeRegistryItem,
  type ThemeColorScheme,
  type ThemeVariables,
  type TweakcnTheme,
} from "@/lib/theme/tweakcn";
import { cn } from "@/lib/utils";
import type {
  ClientWebsiteSettings,
  ClientWebsiteTheme,
  ClientWebsiteThemeSummary,
  ThemeColorMode,
} from "@/lib/website-settings";

const COLOR_MODE_OPTIONS: { value: ThemeColorMode; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "system", label: "System" },
];

const SCHEME_LABELS: Record<ThemeColorScheme, string> = {
  light: "Hell",
  dark: "Dunkel",
};

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const LOCKED_THEME_MESSAGE =
  "Dieses Standard-Design ist schreibgeschützt. Dupliziere es, um eigene Anpassungen vorzunehmen.";

/** Modusunabhängige Werte, die immer als Eingabefeld angeboten werden. */
const THEME_LEVEL_FIELDS: { name: string; label: string; placeholder: string }[] = [
  { name: "font-sans", label: "Schrift (sans)", placeholder: '"Outfit", sans-serif' },
  { name: "font-serif", label: "Schrift (serif)", placeholder: '"Playfair Display", serif' },
  { name: "font-mono", label: "Schrift (mono)", placeholder: '"Fira Mono", monospace' },
  { name: "radius", label: "Grund-Radius", placeholder: "0.5rem" },
  { name: "tracking-normal", label: "Laufweite", placeholder: "0em" },
];

type VariableGroup = { id: string; label: string; names: readonly string[] };

const KNOWN_GROUPS: VariableGroup[] = [
  { id: "core", label: "Grundfarben", names: CORE_COLOR_VARIABLES },
  { id: "status", label: "Statusfarben", names: STATUS_COLOR_VARIABLES },
  { id: "sidebar", label: "Seitenleiste", names: SIDEBAR_VARIABLES },
  { id: "chart", label: "Diagramme", names: CHART_VARIABLES },
  { id: "shadow", label: "Schatten", names: SHADOW_VARIABLES },
];

const KNOWN_VARIABLES = new Set(KNOWN_GROUPS.flatMap((group) => group.names));

function groupVariables(vars: ThemeVariables): VariableGroup[] {
  const other = Object.keys(vars)
    .filter((name) => !KNOWN_VARIABLES.has(name))
    .sort((a, b) => a.localeCompare(b));
  return other.length > 0
    ? [...KNOWN_GROUPS, { id: "other", label: "Weitere Variablen", names: other }]
    : KNOWN_GROUPS;
}

function sortThemeSummaries(themes: ClientWebsiteThemeSummary[]): ClientWebsiteThemeSummary[] {
  return [...themes].sort((a, b) => {
    if (a.isDefault && !b.isDefault) {
      return -1;
    }
    if (!a.isDefault && b.isDefault) {
      return 1;
    }
    if (a.isPreset && !b.isPreset) {
      return -1;
    }
    if (!a.isPreset && b.isPreset) {
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
    isPreset: theme.isPreset,
    updatedAt: theme.updatedAt,
  };
}

function toFileSlug(name: string) {
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

function buildTheme(draft: TweakcnTheme): TweakcnTheme {
  return {
    format: TWEAKCN_THEME_FORMAT,
    theme: compactVariables(draft.theme),
    light: compactVariables(draft.light),
    dark: compactVariables(draft.dark),
  };
}

type VariableFieldProps = {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
};

function VariableField({ id, name, value, onChange }: VariableFieldProps) {
  const hex = cssColorToHex(value);
  const isShadow = name.startsWith("shadow");
  return (
    <div className="flex items-center gap-2">
      {isShadow ? null : (
        <input
          type="color"
          aria-label={`Farbe für ${name} wählen`}
          className={cn(
            "h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5",
            !hex && "cursor-not-allowed opacity-40",
          )}
          value={hex ?? "#000000"}
          disabled={!hex}
          title={
            hex ? undefined : "Kein fester Farbwert (z. B. var(…)) – bitte als Text bearbeiten"
          }
          onChange={(event) => {
            const next = hexToOklchValue(event.target.value);
            if (next) {
              onChange(next);
            }
          }}
        />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor={id} className="font-mono text-xs">
          --{name}
        </Label>
        <Input
          id={id}
          value={value}
          maxLength={400}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}

export type WebsiteThemeSettingsManagerProps = {
  initialSettings: ClientWebsiteSettings;
  initialThemes: ClientWebsiteThemeSummary[];
};

export function WebsiteThemeSettingsManager({
  initialSettings,
  initialThemes,
}: WebsiteThemeSettingsManagerProps) {
  const mergedThemeSummaries = sortThemeSummaries(
    Array.from(
      new Map([
        ...initialThemes.map((theme) => [theme.id, theme] as const),
        [initialSettings.theme.id, themeToSummary(initialSettings.theme)] as const,
      ]).values(),
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
  const [availableThemes, setAvailableThemes] =
    useState<ClientWebsiteThemeSummary[]>(mergedThemeSummaries);
  const [themeBaselines, setThemeBaselines] = useState<Record<string, ClientWebsiteTheme>>({
    [initialSettings.theme.id]: initialSettings.theme,
  });
  const [currentTheme, setCurrentTheme] = useState<ClientWebsiteTheme>(initialSettings.theme);
  const themeEditingLocked = currentTheme.isDefault || currentTheme.isPreset;
  const [themeName, setThemeName] = useState(initialSettings.theme.name);
  const [themeDescription, setThemeDescription] = useState(initialSettings.theme.description ?? "");
  const [draft, setDraft] = useState<TweakcnTheme>(initialSettings.theme.tokens);
  const [editScheme, setEditScheme] = useState<ThemeColorScheme>("light");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTheme, setIsLoadingTheme] = useState(false);
  const [isCreatingTheme, setIsCreatingTheme] = useState(false);
  const [isDuplicatingTheme, setIsDuplicatingTheme] = useState(false);
  const [isDeletingTheme, setIsDeletingTheme] = useState(false);
  const [isActivatingTheme, setIsActivatingTheme] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSource, setImportSource] = useState("");
  const [importName, setImportName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const activeThemeSummary = useMemo(
    () => availableThemes.find((theme) => theme.id === siteSnapshot.activeThemeId),
    [availableThemes, siteSnapshot.activeThemeId],
  );

  const previewTheme = useMemo(() => buildTheme(draft), [draft]);
  const previewCss = useMemo(
    () => createTweakcnThemeCss(previewTheme, { resolveFonts: true }),
    [previewTheme],
  );
  const exportCss = useMemo(() => createTweakcnThemeCss(previewTheme), [previewTheme]);
  const exportJson = useMemo(
    () => JSON.stringify(toThemeRegistryItem(toFileSlug(themeName), previewTheme), null, 2) + "\n",
    [themeName, previewTheme],
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
    return JSON.stringify(previewTheme) !== JSON.stringify(buildTheme(currentTheme.tokens));
  }, [
    siteTitle,
    colorMode,
    themeName,
    themeDescription,
    previewTheme,
    siteSnapshot,
    currentTheme,
    maintenanceMode,
  ]);

  const renameDisabled = isRenaming || isSaving || isLoadingTheme || themeEditingLocked;

  useEffect(() => {
    const styleElement = document.getElementById("website-theme-style") as HTMLStyleElement | null;
    if (!styleElement) {
      return;
    }
    styleElement.textContent = previewCss;
  }, [previewCss]);

  useEffect(() => {
    const savedCss = createTweakcnThemeCss(currentTheme.tokens, { resolveFonts: true });
    return () => {
      const styleElement = document.getElementById(
        "website-theme-style",
      ) as HTMLStyleElement | null;
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

  function populateFormFromTheme(theme: ClientWebsiteTheme) {
    setThemeName(theme.name);
    setThemeDescription(theme.description ?? "");
    setDraft(theme.tokens);
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

  function handleThemeVariableChange(name: string, value: string) {
    setDraft((prev) => ({ ...prev, theme: { ...prev.theme, [name]: value } }));
  }

  function handleSchemeVariableChange(scheme: ThemeColorScheme, name: string, value: string) {
    setDraft((prev) => ({ ...prev, [scheme]: { ...prev[scheme], [name]: value } }));
  }

  function addThemeToList(theme: ClientWebsiteTheme) {
    setAvailableThemes((prev) => {
      const map = new Map(prev.map((entry) => [entry.id, entry] as const));
      map.set(theme.id, themeToSummary(theme));
      return sortThemeSummaries(Array.from(map.values()));
    });
  }

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!importSource.trim()) {
      toast.error("Bitte CSS, JSON oder einen tweakcn-Link einfügen.");
      return;
    }
    setIsImporting(true);
    try {
      const response = await fetch("/api/website/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importSource,
          ...(importName.trim().length >= 2 ? { name: importName.trim() } : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.theme) {
        throw new Error(data?.error ?? "Theme konnte nicht importiert werden.");
      }
      const theme = data.theme as ClientWebsiteTheme;
      addThemeToList(theme);
      applyThemeBaseline(theme);
      setImportDialogOpen(false);
      setImportSource("");
      setImportName("");
      toast.success(`Theme „${theme.name}“ importiert. Zum Übernehmen aktivieren.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Theme konnte nicht importiert werden.");
    } finally {
      setIsImporting(false);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} kopiert.`);
    } catch (error) {
      console.error(error);
      toast.error("Kopieren nicht möglich – bitte manuell markieren.");
    }
  }

  function downloadFile(content: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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
    if (themeEditingLocked) {
      toast.info("Standard-Designs können nicht umbenannt werden. Bitte dupliziere das Theme.");
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
    if (themeEditingLocked) {
      toast.error("Standard-Designs können nicht umbenannt werden.");
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

  async function handleDeleteThemeClick() {
    if (themeEditingLocked) {
      toast.error("Standard-Designs können nicht gelöscht werden.");
      return;
    }

    if (
      !window.confirm(
        `Theme "${currentTheme.name}" wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`,
      )
    ) {
      return;
    }

    setIsDeletingTheme(true);
    try {
      const response = await fetch(`/api/website/themes/${currentTheme.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Theme konnte nicht gelöscht werden.",
        );
      }

      const themes = sortThemeSummaries(payload.themes ?? []);
      setAvailableThemes(themes);
      const fallbackId = payload.activeThemeId ?? themes[0]?.id;
      if (fallbackId) {
        await handleThemeSelect(fallbackId);
      }
      setSiteSnapshot((prev) => ({
        ...prev,
        activeThemeId: payload.activeThemeId ?? prev.activeThemeId,
      }));
      toast.success("Theme wurde gelöscht.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Theme konnte nicht gelöscht werden.");
    } finally {
      setIsDeletingTheme(false);
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

      const payload: Record<string, unknown> = {
        settings: settingsPayload,
        activateTheme,
      };

      if (!themeEditingLocked) {
        payload.theme = {
          id: currentTheme.id,
          name: themeName,
          description: themeDescription.length > 0 ? themeDescription : null,
          tokens: previewTheme,
        };
      }

      const response = await fetch("/api/website/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

      toast.success(
        activateTheme ? "Theme gespeichert und aktiviert." : "Website-Theme gespeichert.",
      );
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
                    {theme.isDefault ? " • Standard" : theme.isPreset ? " • Standarddesign" : ""}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
              disabled={isImporting || isSaving}
            >
              Importieren (tweakcn)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExportDialogOpen(true)}
              disabled={isLoadingTheme}
            >
              Exportieren
            </Button>
            {themeEditingLocked ? (
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
                    Standard-Designs können nicht umbenannt werden.
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
                isActivatingTheme ||
                isSaving ||
                isLoadingTheme ||
                currentTheme.id === siteSnapshot.activeThemeId
              }
              data-state={isActivatingTheme ? "loading" : undefined}
            >
              {isActivatingTheme ? "Aktiviere…" : "Theme aktivieren"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteThemeClick}
              disabled={isDeletingTheme || isSaving || isLoadingTheme || themeEditingLocked}
              data-state={isDeletingTheme ? "loading" : undefined}
            >
              {isDeletingTheme ? "Lösche…" : "Theme löschen"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Aktives Theme:{" "}
              <span className="font-medium text-foreground">
                {activeThemeSummary?.name ?? "Unbekannt"}
              </span>
            </span>
            {themeEditingLocked ? (
              <Badge variant="outline">
                {currentTheme.isDefault ? "Standard" : "Standarddesign"}
              </Badge>
            ) : null}
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
              <Select
                value={colorMode}
                onValueChange={(value) => setColorMode(value as ThemeColorMode)}
              >
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Theme-Werte</CardTitle>
          <p className="text-sm text-muted-foreground">
            Werte im tweakcn-/shadcn-Format. Am einfachsten auf{" "}
            <a
              href="https://tweakcn.com/editor/theme"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              tweakcn.com
            </a>{" "}
            gestalten und importieren. Leere Felder werden beim Speichern automatisch ergänzt.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {themeEditingLocked ? (
            <div className="flex items-start gap-3 rounded-md border border-border/70 bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
              <InfoIcon className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Standard-Design geschützt</p>
                <p>{LOCKED_THEME_MESSAGE}</p>
              </div>
            </div>
          ) : null}
          <fieldset
            className={cn(
              "space-y-8",
              themeEditingLocked && "pointer-events-none select-none opacity-60",
            )}
            aria-disabled={themeEditingLocked}
            disabled={themeEditingLocked}
          >
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
                <Label htmlFor="theme-description">Beschreibung</Label>
                <Textarea
                  id="theme-description"
                  value={themeDescription}
                  onChange={(event) => setThemeDescription(event.target.value)}
                  rows={1}
                  maxLength={500}
                  placeholder="Optionaler Hinweis zum Theme"
                />
              </div>
            </div>

            <section className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Schrift & Form</h3>
                <p className="text-sm text-muted-foreground">
                  Gilt für hell und dunkel. Verfügbare Schriften: Geist, Outfit, Inter, Playfair
                  Display, Fira Mono – andere fallen auf die Systemschrift zurück.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {THEME_LEVEL_FIELDS.map((field) => (
                  <div key={field.name} className="space-y-1">
                    <Label htmlFor={`theme-var-${field.name}`}>{field.label}</Label>
                    <Input
                      id={`theme-var-${field.name}`}
                      value={draft.theme[field.name] ?? ""}
                      maxLength={400}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        handleThemeVariableChange(field.name, event.target.value)
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
            </section>

            <Tabs
              value={editScheme}
              onValueChange={(value) => setEditScheme(value as ThemeColorScheme)}
              className="space-y-4"
            >
              <TabsList>
                {THEME_COLOR_SCHEMES.map((scheme) => (
                  <TabsTrigger key={scheme} value={scheme}>
                    {SCHEME_LABELS[scheme]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {THEME_COLOR_SCHEMES.map((scheme) => (
                <TabsContent key={scheme} value={scheme} className="space-y-6">
                  {groupVariables(draft[scheme]).map((group) => (
                    <section key={group.id} className="space-y-3">
                      <h3 className="text-base font-semibold">{group.label}</h3>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {group.names.map((name) => (
                          <VariableField
                            key={name}
                            id={`${scheme}-var-${name}`}
                            name={name}
                            value={draft[scheme][name] ?? ""}
                            onChange={(value) => handleSchemeVariableChange(scheme, name, value)}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </fieldset>
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
                Vergib einen neuen Namen für{" "}
                <span className="font-medium text-foreground">{currentTheme.name}</span>.
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

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Theme importieren</DialogTitle>
              <DialogDescription>
                Link von tweakcn.com (z. B. https://tweakcn.com/r/themes/amethyst-haze.json), den
                CSS-Code aus „Code“ auf tweakcn oder eine Drupal-theme.css einfügen. Es wird ein
                neues Theme angelegt; aktiv wird es erst, wenn du es aktivierst.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="theme-import-source">CSS, JSON oder tweakcn-Link</Label>
              <Textarea
                id="theme-import-source"
                value={importSource}
                onChange={(event) => setImportSource(event.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder={":root {\n  --background: oklch(1 0 0);\n  …\n}\n.dark { … }"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme-import-name">Name (optional)</Label>
              <Input
                id="theme-import-name"
                value={importName}
                maxLength={120}
                onChange={(event) => setImportName(event.target.value)}
                placeholder="Wird sonst aus dem Registry-Namen übernommen"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={isImporting}
                data-state={isImporting ? "loading" : undefined}
              >
                {isImporting ? "Importiere…" : "Importieren"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Theme exportieren</DialogTitle>
            <DialogDescription>
              Das CSS passt als theme.css ins Drupal-Theme und lässt sich in tweakcn unter „Import“
              einfügen. Das JSON ist ein shadcn-Registry-Item. Exportiert wird der aktuelle
              Bearbeitungsstand.
            </DialogDescription>
          </DialogHeader>
          <Textarea readOnly value={exportCss} rows={12} className="font-mono text-xs" />
          <DialogFooter className="flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => copyToClipboard(exportCss, "CSS")}
            >
              CSS kopieren
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadFile(exportCss, "theme.css", "text/css")}
            >
              theme.css herunterladen
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadFile(exportJson, `${toFileSlug(themeName)}.json`, "application/json")
              }
            >
              JSON herunterladen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
