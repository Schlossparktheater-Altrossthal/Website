"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EditIcon, PlusIcon, RefreshIcon, TrashIcon } from "@/components/ui/action-icons";
import type { PhotoConsentPurposeAdminEntry, PhotoConsentShowOption } from "@/types/photo-consent";

const AUDIENCE_LABELS: Record<PhotoConsentPurposeAdminEntry["appliesTo"], string> = {
  both: "Alle",
  adult: "Volljährig",
  minor: "Minderjährig",
};

type PurposeFormState = {
  label: string;
  description: string;
  appliesTo: PhotoConsentPurposeAdminEntry["appliesTo"];
  isRefusal: boolean;
  sortOrder: number;
};

const EMPTY_FORM: PurposeFormState = {
  label: "",
  description: "",
  appliesTo: "both",
  isRefusal: false,
  sortOrder: 0,
};

export function PhotoConsentPurposesPanel() {
  const [entries, setEntries] = useState<PhotoConsentPurposeAdminEntry[]>([]);
  const [shows, setShows] = useState<PhotoConsentShowOption[]>([]);
  const [showId, setShowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<PhotoConsentPurposeAdminEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PurposeFormState>(EMPTY_FORM);
  const [deactivateTarget, setDeactivateTarget] = useState<PhotoConsentPurposeAdminEntry | null>(
    null,
  );

  const loadShows = useCallback(async () => {
    try {
      const response = await fetch("/api/photo-consents/admin", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) return;
      const list: PhotoConsentShowOption[] = Array.isArray(data?.shows) ? data.shows : [];
      setShows(list);
      setShowId(
        (prev) =>
          prev ??
          (typeof data?.showId === "string" && data.showId !== "all"
            ? data.showId
            : (list[0]?.id ?? null)),
      );
    } catch {
      // Bereits der Ladevorgang der Punkte meldet Netzwerkfehler.
    }
  }, []);

  const loadPurposes = useCallback(async (targetShowId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/photo-consents/purposes?showId=${encodeURIComponent(targetShowId)}`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Zwecke konnten nicht geladen werden");
        return;
      }
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch {
      setError("Netzwerkfehler beim Laden der Zwecke");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShows();
  }, [loadShows]);

  useEffect(() => {
    if (showId) {
      void loadPurposes(showId);
    }
  }, [showId, loadPurposes]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, sortOrder: entries.length });
    setCreating(true);
  };

  const openEdit = (entry: PhotoConsentPurposeAdminEntry) => {
    setForm({
      label: entry.label,
      description: entry.description ?? "",
      appliesTo: entry.appliesTo,
      isRefusal: entry.isRefusal,
      sortOrder: entry.sortOrder,
    });
    setEditing(entry);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    if (showId) void loadPurposes(showId);
  };

  const save = async () => {
    if (!showId || !form.label.trim()) {
      toast.error("Bitte gib einen Namen an");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        showId,
        label: form.label.trim(),
        description: form.description.trim() || null,
        appliesTo: form.appliesTo,
        isRefusal: form.isRefusal,
        sortOrder: form.sortOrder,
      };
      const response = await fetch("/api/photo-consents/purposes", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Speichern fehlgeschlagen");
        return;
      }
      toast.success(editing ? "Punkt aktualisiert" : "Punkt angelegt");
      closeForm();
    } catch {
      toast.error("Netzwerkfehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    setDeactivateTarget(null);
    try {
      const response = await fetch(
        `/api/photo-consents/purposes?id=${encodeURIComponent(target.id)}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Deaktivieren fehlgeschlagen");
        return;
      }
      toast.success("Punkt deaktiviert");
      if (showId) void loadPurposes(showId);
    } catch {
      toast.error("Netzwerkfehler beim Deaktivieren");
    }
  };

  return (
    <Card className="border border-border/70 bg-card">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Verwendungszwecke</h2>
            <p className="text-xs text-muted-foreground">
              Diese Punkte kreuzt das Mitglied bei der Fotoerlaubnis an. Sie gelten je Produktion.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={showId ?? ""} onValueChange={(value) => setShowId(value)}>
              <SelectTrigger className="h-9 w-52" aria-label="Produktion auswählen">
                <SelectValue placeholder="Produktion" />
              </SelectTrigger>
              <SelectContent>
                {shows.map((show) => (
                  <SelectItem key={show.id} value={show.id}>
                    {show.title} ({show.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => showId && void loadPurposes(showId)}
              disabled={loading}
            >
              <RefreshIcon className="mr-1 h-4 w-4" aria-hidden="true" />
              Aktualisieren
            </Button>
            <Button type="button" size="sm" onClick={openCreate} disabled={!showId}>
              <PlusIcon className="mr-1 h-4 w-4" aria-hidden="true" />
              Punkt hinzufügen
            </Button>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Lade Zwecke …</p>
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Für diese Produktion sind noch keine Zwecke angelegt.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{entry.label}</span>
                    <Badge variant="outline">{AUDIENCE_LABELS[entry.appliesTo]}</Badge>
                    {entry.isRefusal ? <Badge variant="muted">Ablehnung</Badge> : null}
                    {!entry.isActive ? <Badge variant="muted">Inaktiv</Badge> : null}
                  </div>
                  {entry.description ? (
                    <p className="text-xs text-muted-foreground">{entry.description}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground/80">
                    Code: {entry.code} · {entry.choiceCount} Auswahlen
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button type="button" size="xs" variant="ghost" onClick={() => openEdit(entry)}>
                    <EditIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Bearbeiten</span>
                  </Button>
                  {entry.isActive ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => setDeactivateTarget(entry)}
                    >
                      <TrashIcon className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Deaktivieren</span>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ModalFormDialog
        title={editing ? "Punkt bearbeiten" : "Punkt hinzufügen"}
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) closeForm();
        }}
        onSave={() => void save()}
        saveLabel={saving ? "Speichern …" : "Speichern"}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="purpose-label">
              Name
            </label>
            <Input
              id="purpose-label"
              value={form.label}
              onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="purpose-description">
              Beschreibung (optional)
            </label>
            <Textarea
              id="purpose-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={2}
              maxLength={400}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Zielgruppe</span>
              <Select
                value={form.appliesTo}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    appliesTo: value as PurposeFormState["appliesTo"],
                  }))
                }
              >
                <SelectTrigger aria-label="Zielgruppe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Alle</SelectItem>
                  <SelectItem value="adult">Volljährig</SelectItem>
                  <SelectItem value="minor">Minderjährig</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="purpose-order">
                Reihenfolge
              </label>
              <Input
                id="purpose-order"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    sortOrder: Number.parseInt(event.target.value, 10) || 0,
                  }))
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.isRefusal}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isRefusal: event.target.checked }))
              }
              className="h-4 w-4"
            />
            Ablehnungs-Punkt („gar nicht“: schließt alle anderen aus)
          </label>
        </div>
      </ModalFormDialog>

      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        title="Punkt deaktivieren?"
        description="Der Punkt wird bei neuen Einwilligungen nicht mehr angezeigt. Bestehende Auswahlen bleiben erhalten."
        confirmLabel="Deaktivieren"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => void deactivate()}
        onCancel={() => setDeactivateTarget(null)}
      />
    </Card>
  );
}
