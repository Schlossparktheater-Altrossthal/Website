"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createThemeCss } from "@/lib/theme-css";
import type {
  ClientWebsiteSettings,
  ThemeColorMode,
  ThemeModeKey,
  ThemeTokenKey,
  ThemeTokens,
} from "@/lib/website-settings";

const LIGHT_MODE: ThemeModeKey = "light";
const DARK_MODE: ThemeModeKey = "dark";

const COLOR_MODE_OPTIONS: { value: ThemeColorMode; label: string }[] = [
  { value: "dark", label: "Dunkelmodus" },
  { value: "light", label: "Hellmodus" },
];

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

type ModeValuesState = Record<ThemeModeKey, Record<ThemeTokenKey, string>>;

type WebsiteThemeSettingsManagerProps = {
  initialSettings: ClientWebsiteSettings;
};

function buildModeValues(modes: ThemeTokens["modes"]): ModeValuesState {
  const result = {} as ModeValuesState;
  for (const mode of Object.keys(modes) as ThemeModeKey[]) {
    result[mode] = { ...(modes[mode] as Record<ThemeTokenKey, string>) };
  }
  return result;
}

function formatTokenLabel(token: string) {
  return token
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function WebsiteThemeSettingsManager({ initialSettings }: WebsiteThemeSettingsManagerProps) {
  const [snapshot, setSnapshot] = useState<ClientWebsiteSettings>(initialSettings);
  const [siteTitle, setSiteTitle] = useState(initialSettings.siteTitle);
  const [colorMode, setColorMode] = useState<ThemeColorMode>(initialSettings.colorMode);
  const [themeName, setThemeName] = useState(initialSettings.theme.name);
  const [themeDescription, setThemeDescription] = useState(initialSettings.theme.description ?? "");
  const [radius, setRadius] = useState(initialSettings.theme.tokens.radius.base);
  const [modeValues, setModeValues] = useState<ModeValuesState>(() =>
    buildModeValues(initialSettings.theme.tokens.modes),
  );
  const [isSaving, setIsSaving] = useState(false);

  const tokenKeys = useMemo(
    () => Object.keys(snapshot.theme.tokens.modes[LIGHT_MODE]) as ThemeTokenKey[],
    [snapshot],
  );

  const previewTokens = useMemo(() => {
    const modes = {} as ThemeTokens["modes"];
    for (const mode of Object.keys(modeValues) as ThemeModeKey[]) {
      modes[mode] = { ...modeValues[mode] } as ThemeTokens["modes"][ThemeModeKey];
    }
    return {
      radius: { base: radius },
      modes,
      parameters: snapshot.theme.tokens.parameters,
      meta: snapshot.theme.tokens.meta,
    } satisfies ThemeTokens;
  }, [modeValues, radius, snapshot.theme.tokens.meta, snapshot.theme.tokens.parameters]);

  const lastSavedIso = snapshot.theme.updatedAt ?? snapshot.updatedAt;
  const lastSavedLabel = lastSavedIso
    ? UPDATED_AT_FORMATTER.format(new Date(lastSavedIso))
    : "Noch nie gespeichert";

  const isDirty = useMemo(() => {
    const normalizedSiteTitle = siteTitle.trim();
    if (normalizedSiteTitle !== snapshot.siteTitle.trim()) {
      return true;
    }
    if (colorMode !== snapshot.colorMode) {
      return true;
    }
    if (themeName.trim() !== snapshot.theme.name.trim()) {
      return true;
    }
    if ((themeDescription ?? "").trim() !== (snapshot.theme.description ?? "").trim()) {
      return true;
    }
    if (radius.trim() !== snapshot.theme.tokens.radius.base.trim()) {
      return true;
    }
    for (const mode of Object.keys(snapshot.theme.tokens.modes) as ThemeModeKey[]) {
      const snapshotTokens = snapshot.theme.tokens.modes[mode];
      const currentTokens = modeValues[mode];
      for (const token of Object.keys(snapshotTokens) as ThemeTokenKey[]) {
        if (currentTokens[token] !== snapshotTokens[token]) {
          return true;
        }
      }
    }
    return false;
  }, [siteTitle, colorMode, themeName, themeDescription, radius, modeValues, snapshot]);

  useEffect(() => {
    const styleElement = document.getElementById("website-theme-style") as HTMLStyleElement | null;
    if (!styleElement) {
      return;
    }
    styleElement.textContent = createThemeCss(previewTokens);
  }, [previewTokens]);

  useEffect(() => {
    const savedCss = createThemeCss(snapshot.theme.tokens);
    return () => {
      const styleElement = document.getElementById("website-theme-style") as HTMLStyleElement | null;
      if (!styleElement) {
        return;
      }
      styleElement.textContent = savedCss;
    };
  }, [snapshot]);

  useEffect(() => {
    const root = document.documentElement;
    if (colorMode === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, [colorMode]);

  useEffect(() => {
    const root = document.documentElement;
    return () => {
      if (snapshot.colorMode === "dark") {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }
    };
  }, [snapshot.colorMode]);

  function applySettings(next: ClientWebsiteSettings, updateSnapshot = false) {
    setSiteTitle(next.siteTitle);
    setColorMode(next.colorMode);
    setThemeName(next.theme.name);
    setThemeDescription(next.theme.description ?? "");
    setRadius(next.theme.tokens.radius.base);
    setModeValues(buildModeValues(next.theme.tokens.modes));
    if (updateSnapshot) {
      setSnapshot(next);
    }
  }

  function handleTokenChange(mode: ThemeModeKey, token: ThemeTokenKey, value: string) {
    setModeValues((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [token]: value,
      },
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/website/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            siteTitle,
            colorMode,
          },
          theme: {
            id: snapshot.theme.id,
            name: themeName,
            description: themeDescription.length > 0 ? themeDescription : null,
            tokens: previewTokens,
          },
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

      applySettings(data.settings as ClientWebsiteSettings, true);
      toast.success("Website-Theme gespeichert.");
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Theme-Farben</CardTitle>
          <p className="text-sm text-muted-foreground">
            Passe die Farbwerte für Light- und Dark-Mode an. Änderungen werden live angewendet.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
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
          <Tabs defaultValue={LIGHT_MODE}>
            <TabsList>
              <TabsTrigger value={LIGHT_MODE}>Light</TabsTrigger>
              <TabsTrigger value={DARK_MODE}>Dark</TabsTrigger>
            </TabsList>
            <TabsContent value={LIGHT_MODE} className="space-y-4 pt-4">
              {tokenKeys.map((token) => (
                <div key={`light-${token}`} className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Label className="flex items-center gap-3 text-sm font-medium">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60"
                      style={{ backgroundColor: modeValues[LIGHT_MODE][token] }}
                    />
                    {formatTokenLabel(token)}
                  </Label>
                  <Input
                    value={modeValues[LIGHT_MODE][token]}
                    onChange={(event) => handleTokenChange(LIGHT_MODE, token, event.target.value)}
                  />
                </div>
              ))}
            </TabsContent>
            <TabsContent value={DARK_MODE} className="space-y-4 pt-4">
              {tokenKeys.map((token) => (
                <div key={`dark-${token}`} className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Label className="flex items-center gap-3 text-sm font-medium">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60"
                      style={{ backgroundColor: modeValues[DARK_MODE][token] }}
                    />
                    {formatTokenLabel(token)}
                  </Label>
                  <Input
                    value={modeValues[DARK_MODE][token]}
                    onChange={(event) => handleTokenChange(DARK_MODE, token, event.target.value)}
                  />
                </div>
              ))}
            </TabsContent>
          </Tabs>
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
            onClick={() => applySettings(snapshot)}
            disabled={isSaving || !isDirty}
          >
            Änderungen verwerfen
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            data-state={isSaving ? "loading" : undefined}
          >
            {isSaving ? "Speichern…" : "Theme speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}
