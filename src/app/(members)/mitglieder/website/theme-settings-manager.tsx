"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PlusIcon, UploadIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormSaveBar } from "@/components/ui/form-save-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { summarizeClientWebsiteTheme } from "@/lib/theme/swatches";
import {
  createTweakcnThemeCss,
  toThemeRegistryItem,
  type ThemeColorScheme,
  type TweakcnTheme,
} from "@/lib/theme/tweakcn";
import type {
  ClientWebsiteSettings,
  ClientWebsiteTheme,
  ClientWebsiteThemeSummary,
  ThemeColorMode,
} from "@/lib/website-settings";

import { ThemeEditor } from "./theme-editor";
import { ThemeGallery } from "./theme-gallery";
import { ThemeImportDialog } from "./theme-import-dialog";
import { buildTheme, sortThemeSummaries, toFileSlug, upsertSummary } from "./theme-utils";

const COLOR_MODE_OPTIONS: { value: ThemeColorMode; label: string }[] = [
  { value: "system", label: "Wie Gerät" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

async function requestJson(url: string, init: RequestInit, fallbackError: string) {
  const response = await fetch(url, {
    ...init,
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : fallbackError);
  }
  return data;
}

function errorToast(error: unknown, fallback: string) {
  console.error(error);
  toast.error(error instanceof Error ? error.message : fallback);
}

function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export type WebsiteThemeSettingsManagerProps = {
  initialSettings: ClientWebsiteSettings;
  initialThemes: ClientWebsiteThemeSummary[];
};

export function WebsiteThemeSettingsManager({
  initialSettings,
  initialThemes,
}: WebsiteThemeSettingsManagerProps) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);

  // Allgemeine Einstellungen
  const [site, setSite] = useState({
    siteTitle: initialSettings.siteTitle,
    colorMode: initialSettings.colorMode,
    activeThemeId: initialSettings.theme.id,
  });
  const [siteTitle, setSiteTitle] = useState(initialSettings.siteTitle);
  const [savingSite, setSavingSite] = useState(false);

  // Themes
  const [themes, setThemes] = useState(() =>
    upsertSummary(
      sortThemeSummaries(initialThemes),
      summarizeClientWebsiteTheme(initialSettings.theme),
    ),
  );
  const [loaded, setLoaded] = useState<Record<string, ClientWebsiteTheme>>({
    [initialSettings.theme.id]: initialSettings.theme,
  });
  const [current, setCurrent] = useState<ClientWebsiteTheme>(initialSettings.theme);
  const [draft, setDraft] = useState<TweakcnTheme>(initialSettings.theme.tokens);
  const [name, setName] = useState(initialSettings.theme.name);
  const [description, setDescription] = useState(initialSettings.theme.description ?? "");
  const [scheme, setScheme] = useState<ThemeColorScheme>(
    initialSettings.colorMode === "dark" ? "dark" : "light",
  );
  const [savingTheme, setSavingTheme] = useState(false);

  // Dialoge
  const [importOpen, setImportOpen] = useState(false);
  const [exportTheme, setExportTheme] = useState<ClientWebsiteTheme | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);

  const locked = current.isPreset || current.isDefault;
  const builtDraft = useMemo(() => buildTheme(draft), [draft]);
  const themeDirty =
    !locked &&
    (name.trim() !== current.name.trim() ||
      description.trim() !== (current.description ?? "").trim() ||
      JSON.stringify(builtDraft) !== JSON.stringify(buildTheme(current.tokens)));

  const exportCss = useMemo(
    () => (exportTheme ? createTweakcnThemeCss(exportTheme.tokens) : ""),
    [exportTheme],
  );

  const deleteTheme = themes.find((theme) => theme.id === deleteId) ?? null;

  function remember(theme: ClientWebsiteTheme) {
    setLoaded((prev) => ({ ...prev, [theme.id]: theme }));
    setThemes((prev) => upsertSummary(prev, summarizeClientWebsiteTheme(theme)));
  }

  function openInEditor(theme: ClientWebsiteTheme) {
    setCurrent(theme);
    setDraft(theme.tokens);
    setName(theme.name);
    setDescription(theme.description ?? "");
    // Mobil liegt der Editor unter der Galerie.
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  async function loadTheme(id: string) {
    if (loaded[id]) return loaded[id];
    const data = await requestJson(
      `/api/website/themes/${id}`,
      {},
      "Theme konnte nicht geladen werden.",
    );
    const theme = data.theme as ClientWebsiteTheme;
    remember(theme);
    return theme;
  }

  async function selectTheme(id: string, force = false) {
    if (id === current.id) return;
    if (themeDirty && !force) {
      setPendingSelectId(id);
      return;
    }
    try {
      openInEditor(await loadTheme(id));
    } catch (error) {
      errorToast(error, "Theme konnte nicht geladen werden.");
    }
  }

  async function saveSite(patch: {
    siteTitle?: string;
    colorMode?: ThemeColorMode;
    themeId?: string;
  }) {
    setSavingSite(true);
    try {
      const data = await requestJson(
        "/api/website/settings",
        { method: "PUT", body: JSON.stringify({ settings: patch }) },
        "Einstellungen konnten nicht gespeichert werden.",
      );
      const next = data.settings as ClientWebsiteSettings;
      setSite({
        siteTitle: next.siteTitle,
        colorMode: next.colorMode,
        activeThemeId: next.theme.id,
      });
      setSiteTitle(next.siteTitle);
      router.refresh();
      return true;
    } catch (error) {
      errorToast(error, "Einstellungen konnten nicht gespeichert werden.");
      return false;
    } finally {
      setSavingSite(false);
    }
  }

  async function activate(id: string) {
    if (await saveSite({ themeId: id })) {
      toast.success("Theme ist jetzt für alle aktiv.");
    }
  }

  async function toggleMemberSelectable(id: string, value: boolean) {
    try {
      const data = await requestJson(
        `/api/website/themes/${id}`,
        { method: "PUT", body: JSON.stringify({ memberSelectable: value }) },
        "Freigabe konnte nicht geändert werden.",
      );
      const theme = data.theme as ClientWebsiteTheme;
      remember(theme);
      if (theme.id === current.id)
        setCurrent((prev) => ({ ...prev, memberSelectable: theme.memberSelectable }));
      toast.success(
        value
          ? `„${theme.name}“ ist im Profil wählbar.`
          : `„${theme.name}“ ist nicht mehr wählbar.`,
      );
    } catch (error) {
      errorToast(error, "Freigabe konnte nicht geändert werden.");
    }
  }

  async function createTheme(sourceThemeId?: string) {
    try {
      const data = await requestJson(
        "/api/website/themes",
        { method: "POST", body: JSON.stringify(sourceThemeId ? { sourceThemeId } : {}) },
        "Theme konnte nicht angelegt werden.",
      );
      const theme = data.theme as ClientWebsiteTheme;
      remember(theme);
      openInEditor(theme);
      toast.success(sourceThemeId ? "Kopie angelegt." : "Neues Theme angelegt.");
    } catch (error) {
      errorToast(error, "Theme konnte nicht angelegt werden.");
    }
  }

  async function openExport(id: string) {
    try {
      const theme = await loadTheme(id);
      // Beim gerade bearbeiteten Theme den aktuellen Entwurf exportieren.
      setExportTheme(id === current.id ? { ...theme, name, tokens: builtDraft } : theme);
    } catch (error) {
      errorToast(error, "Theme konnte nicht geladen werden.");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      const data = await requestJson(
        `/api/website/themes/${id}`,
        { method: "DELETE" },
        "Theme konnte nicht gelöscht werden.",
      );
      setThemes(sortThemeSummaries(data.themes ?? []));
      setLoaded((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (current.id === id) {
        const fallback = data.activeThemeId ?? site.activeThemeId;
        openInEditor(await loadTheme(fallback));
      }
      toast.success("Theme gelöscht.");
    } catch (error) {
      errorToast(error, "Theme konnte nicht gelöscht werden.");
    }
  }

  async function saveTheme() {
    setSavingTheme(true);
    try {
      const data = await requestJson(
        `/api/website/themes/${current.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            tokens: builtDraft,
          }),
        },
        "Theme konnte nicht gespeichert werden.",
      );
      const theme = data.theme as ClientWebsiteTheme;
      remember(theme);
      openInEditor(theme);
      toast.success("Theme gespeichert.");
      // Aktives oder von Mitgliedern gewähltes Theme: Seite neu rendern.
      router.refresh();
    } catch (error) {
      errorToast(error, "Theme konnte nicht gespeichert werden.");
    } finally {
      setSavingTheme(false);
    }
  }

  const titleDirty = siteTitle.trim() !== site.siteTitle.trim();
  const activeName = themes.find((theme) => theme.id === site.activeThemeId)?.name ?? "–";

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <form
            className="space-y-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (titleDirty) {
                void saveSite({ siteTitle: siteTitle.trim() }).then(
                  (ok) => ok && toast.success("Titel gespeichert."),
                );
              }
            }}
          >
            <Label htmlFor="site-title">Titel der Seite</Label>
            <div className="flex gap-2">
              <Input
                id="site-title"
                value={siteTitle}
                maxLength={160}
                onChange={(event) => setSiteTitle(event.target.value)}
              />
              {titleDirty ? (
                <AsyncButton type="submit" isLoading={savingSite} loadingText="…">
                  Speichern
                </AsyncButton>
              ) : null}
            </div>
          </form>
          <div className="space-y-1">
            <Label id="site-mode-label">Standard für alle</Label>
            <SegmentedControl
              aria-label="Standard-Farbmodus für alle"
              size="md"
              fullWidth
              value={site.colorMode}
              onValueChange={(colorMode) => {
                setSite((prev) => ({ ...prev, colorMode }));
                void saveSite({ colorMode });
              }}
              options={COLOR_MODE_OPTIONS}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Mitglieder können Farbmodus und – falls freigegeben – ein Theme im Profil unter
          „Darstellung“ selbst wählen.
        </p>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto min-w-0">
            <h2 className="text-base font-semibold text-foreground">Themes</h2>
            <p className="text-sm text-muted-foreground">
              Aktiv für alle: <span className="font-medium text-foreground">{activeName}</span>
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void createTheme()}>
            <PlusIcon />
            Neu
          </Button>
          <Button type="button" onClick={() => setImportOpen(true)}>
            <UploadIcon />
            Importieren
          </Button>
        </div>
        <ThemeGallery
          themes={themes}
          activeThemeId={site.activeThemeId}
          selectedThemeId={current.id}
          actions={{
            onSelect: (id) => void selectTheme(id),
            onActivate: (id) => void activate(id),
            onToggleMemberSelectable: (id, value) => void toggleMemberSelectable(id, value),
            onDuplicate: (id) => void createTheme(id),
            onExport: (id) => void openExport(id),
            onDelete: setDeleteId,
          }}
        />
      </Card>

      <div ref={editorRef} className="scroll-mt-20">
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">
                {locked ? current.name : name || "Unbenannt"}
              </h2>
              <div className="mt-1 flex flex-wrap gap-1">
                {current.id === site.activeThemeId ? (
                  <Badge variant="success" size="sm">
                    Aktiv
                  </Badge>
                ) : null}
                {current.memberSelectable ? (
                  <Badge variant="info" size="sm">
                    Wählbar
                  </Badge>
                ) : null}
                {locked ? (
                  <Badge variant="muted" size="sm">
                    Vorlage
                  </Badge>
                ) : null}
              </div>
            </div>
            {current.id !== site.activeThemeId ? (
              <AsyncButton
                type="button"
                variant="outline"
                isLoading={savingSite}
                loadingText="Aktiviere…"
                disabled={themeDirty}
                title={themeDirty ? "Erst speichern" : undefined}
                onClick={() => void activate(current.id)}
              >
                Für alle aktivieren
              </AsyncButton>
            ) : null}
          </div>
          <ThemeEditor
            draft={draft}
            onDraftChange={setDraft}
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            locked={locked}
            onDuplicate={() => void createTheme(current.id)}
            scheme={scheme}
            onSchemeChange={setScheme}
          />
          {locked ? null : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveTheme();
              }}
            >
              <FormSaveBar
                dirty={themeDirty}
                submitting={savingTheme}
                onReset={() => openInEditor(current)}
                submitLabel="Theme speichern"
              />
            </form>
          )}
        </Card>
      </div>

      <ThemeImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(theme) => {
          remember(theme);
          openInEditor(theme);
        }}
      />

      <ModalFormDialog
        open={exportTheme !== null}
        onOpenChange={(open) => !open && setExportTheme(null)}
        title={`„${exportTheme?.name ?? ""}“ exportieren`}
        description="Das CSS passt als theme.css ins Drupal-Theme und lässt sich in tweakcn unter „Import“ einfügen. Das JSON ist ein shadcn-Registry-Item."
        contentClassName="sm:max-w-2xl"
        footer={
          exportTheme ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(exportCss)
                    .then(() => toast.success("CSS kopiert."))
                    .catch(() => toast.error("Kopieren nicht möglich – bitte manuell markieren."))
                }
              >
                CSS kopieren
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadFile(exportCss, "theme.css", "text/css")}
              >
                theme.css
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadFile(
                    JSON.stringify(
                      toThemeRegistryItem(toFileSlug(exportTheme.name), exportTheme.tokens),
                      null,
                      2,
                    ) + "\n",
                    `${toFileSlug(exportTheme.name)}.json`,
                    "application/json",
                  )
                }
              >
                JSON
              </Button>
            </>
          ) : null
        }
      >
        <Textarea readOnly value={exportCss} rows={12} className="font-mono text-xs" />
      </ModalFormDialog>

      <ConfirmDialog
        open={deleteTheme !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={`„${deleteTheme?.name ?? ""}“ löschen?`}
        description="Das Theme wird endgültig entfernt. Mitglieder, die es gewählt hatten, sehen wieder das Theme der Seite."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={pendingSelectId !== null}
        onOpenChange={(open) => !open && setPendingSelectId(null)}
        title="Änderungen verwerfen?"
        description={`„${current.name}“ hat ungespeicherte Änderungen. Wenn du ein anderes Theme öffnest, gehen sie verloren.`}
        confirmLabel="Verwerfen"
        cancelLabel="Weiter bearbeiten"
        variant="destructive"
        onConfirm={() => {
          const id = pendingSelectId;
          setPendingSelectId(null);
          if (id) void selectTheme(id, true);
        }}
        onCancel={() => setPendingSelectId(null)}
      />
    </div>
  );
}
