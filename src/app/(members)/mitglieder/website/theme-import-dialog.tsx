"use client";

import * as React from "react";
import { toast } from "sonner";

import { ThemeMiniPreview } from "@/components/theme/theme-preview-card";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { TextLink } from "@/components/ui/text-link";
import { Textarea } from "@/components/ui/textarea";
import type { ThemeSwatches } from "@/lib/theme/swatches";
import type { ClientWebsiteTheme } from "@/lib/website-settings";

type Preview = { suggestedName: string | null; swatches: ThemeSwatches; radius: string };

async function postTheme(body: Record<string, unknown>) {
  const response = await fetch("/api/website/themes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Import fehlgeschlagen.");
  }
  return data;
}

/**
 * Import in zwei Schritten: erst prüfen und Vorschau zeigen, dann anlegen. Nimmt jeden
 * tweakcn-Link (Vorlage, Community, eigenes Theme, Editor) sowie JSON oder CSS an.
 */
export function ThemeImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (theme: ClientWebsiteTheme) => void;
}) {
  const [source, setSource] = React.useState("");
  const [name, setName] = React.useState("");
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setSource("");
    setName("");
    setPreview(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const loadPreview = async () => {
    if (!source.trim()) {
      toast.error("Bitte einen Link, JSON oder CSS einfügen.");
      return;
    }
    setBusy(true);
    try {
      const data = await postTheme({ importSource: source, previewOnly: true });
      const next = data.preview as Preview;
      setPreview(next);
      if (!name.trim() && next.suggestedName) setName(next.suggestedName);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const importTheme = async () => {
    setBusy(true);
    try {
      const data = await postTheme({
        importSource: source,
        ...(name.trim().length >= 2 ? { name: name.trim() } : {}),
      });
      const theme = data.theme as ClientWebsiteTheme;
      onImported(theme);
      toast.success(`„${theme.name}“ importiert.`);
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Theme importieren"
      description="Ein neues Theme wird angelegt. Für alle sichtbar wird es erst, wenn du es aktivierst."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Abbrechen
          </Button>
          {preview ? (
            <AsyncButton
              type="button"
              isLoading={busy}
              loadingText="Importiere…"
              onClick={importTheme}
            >
              Importieren
            </AsyncButton>
          ) : (
            <AsyncButton type="button" isLoading={busy} loadingText="Prüfe…" onClick={loadPreview}>
              Vorschau
            </AsyncButton>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="theme-import-source">Link, JSON oder CSS</Label>
          <Textarea
            id="theme-import-source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setPreview(null);
            }}
            rows={4}
            className="font-mono text-xs"
            placeholder="https://tweakcn.com/themes/…"
          />
          <p className="text-xs text-muted-foreground">
            Funktioniert mit Vorlagen,{" "}
            <TextLink href="https://tweakcn.com/community" target="_blank" rel="noreferrer">
              Community-Themes
            </TextLink>
            , eigenen gespeicherten Themes und Editor-Links von tweakcn.com – oder den Code aus
            „Code“ (CSS/JSON) einfügen.
          </p>
        </div>
        {preview ? (
          <div className="space-y-3">
            <ThemeMiniPreview
              swatches={preview.swatches}
              radius={preview.radius}
              className="h-28"
            />
            <div className="space-y-2">
              <Label htmlFor="theme-import-name">Name</Label>
              <Input
                id="theme-import-name"
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder="Importiertes Theme"
              />
            </div>
          </div>
        ) : null}
      </div>
    </ModalFormDialog>
  );
}
