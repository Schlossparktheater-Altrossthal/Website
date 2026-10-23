"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ThemePreviewCard } from "@/components/theme/theme-preview-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClientWebsiteThemeSummary, ThemeColorMode } from "@/lib/website-settings";

type Appearance = {
  colorMode: ThemeColorMode | null;
  themeId: string | null;
  site: { colorMode: ThemeColorMode; theme: ClientWebsiteThemeSummary };
  themes: ClientWebsiteThemeSummary[];
};

const MODE_OPTIONS: { value: ThemeColorMode; label: string }[] = [
  { value: "system", label: "Wie Gerät" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

const MODE_LABELS: Record<ThemeColorMode, string> = {
  system: "wie Gerät",
  light: "hell",
  dark: "dunkel",
};

const SITE_THEME = "__site__";

/** Profil-Bereich „Darstellung“: eigener Farbmodus und Theme, sofort sichtbar. */
export function AppearanceSection() {
  const router = useRouter();
  const [data, setData] = React.useState<Appearance | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/appearance", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as Appearance;
        if (!cancelled) setData(json);
      })
      .catch((error) => {
        console.error("[AppearanceSection] load failed", error);
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (next: Pick<Appearance, "colorMode" | "themeId">, themeChanged: boolean) => {
    if (!data) return;
    const previous = data;
    setData({ ...data, ...next });
    // Farbmodus sofort umschalten; ColorModeScript reagiert auf das Attribut.
    document.documentElement.setAttribute(
      "data-color-mode",
      next.colorMode ?? previous.site.colorMode,
    );
    try {
      const response = await fetch("/api/profile/appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      // Das Theme rendert das Layout auf dem Server; neu laden, damit es überall gilt.
      if (themeChanged) router.refresh();
    } catch (error) {
      console.error("[AppearanceSection] save failed", error);
      setData(previous);
      document.documentElement.setAttribute(
        "data-color-mode",
        previous.colorMode ?? previous.site.colorMode,
      );
      toast.error("Darstellung konnte nicht gespeichert werden.", {
        description: error instanceof Error ? error.message : undefined,
        duration: 5000,
      });
    }
  };

  if (loadFailed) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Die Darstellung konnte nicht geladen werden. Bitte lade die Seite neu.
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const effectiveMode = data.colorMode ?? data.site.colorMode;
  const selectedTheme = data.themeId ?? SITE_THEME;

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Hell oder dunkel</h3>
          <p className="text-sm text-muted-foreground">
            „Wie Gerät“ folgt der Einstellung deines Handys oder Computers.
          </p>
        </div>
        <SegmentedControl
          aria-label="Farbmodus"
          size="md"
          fullWidth
          value={effectiveMode}
          onValueChange={(colorMode) => void save({ colorMode, themeId: data.themeId }, false)}
          options={MODE_OPTIONS}
        />
        <div className="flex min-h-9 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {data.colorMode ? (
            <>
              <span>Eigene Wahl. Vorgabe der Seite: {MODE_LABELS[data.site.colorMode]}.</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => void save({ colorMode: null, themeId: data.themeId }, false)}
              >
                Vorgabe verwenden
              </Button>
            </>
          ) : (
            <span>Du nutzt die Vorgabe der Seite.</span>
          )}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Farbschema</h3>
          <p className="text-sm text-muted-foreground">
            Gilt nur für dich und nur im Mitgliederbereich.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <ThemePreviewCard
            name="Wie die Seite"
            description={data.site.theme.name}
            swatches={data.site.theme.swatches}
            radius={data.site.theme.radius}
            selected={selectedTheme === SITE_THEME}
            onSelect={() => void save({ colorMode: data.colorMode, themeId: null }, true)}
            badges={
              <Badge variant="muted" size="sm">
                Standard
              </Badge>
            }
          />
          {data.themes
            .filter((theme) => theme.id !== data.site.theme.id)
            .map((theme) => (
              <ThemePreviewCard
                key={theme.id}
                name={theme.name}
                description={theme.description}
                swatches={theme.swatches}
                radius={theme.radius}
                selected={selectedTheme === theme.id}
                onSelect={() => void save({ colorMode: data.colorMode, themeId: theme.id }, true)}
              />
            ))}
        </div>
        {data.themes.filter((theme) => theme.id !== data.site.theme.id).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Bisher sind keine weiteren Farbschemata freigegeben.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
