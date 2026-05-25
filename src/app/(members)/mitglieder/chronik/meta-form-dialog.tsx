"use client";

import { useState } from "react";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heading } from "@/components/ui/typography";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlusIcon, TrashIcon } from "@/components/ui/action-icons";
import type { ShowRecord, ShowMeta, CastEntry } from "./types";

type MetaFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  show: ShowRecord;
  onSaved: (show: ShowRecord) => void;
};

type CastRow = {
  role: string;
  playersText: string;
};

function castEntriesToRows(cast: CastEntry[] | null | undefined): CastRow[] {
  if (!Array.isArray(cast) || cast.length === 0) return [];
  return cast.map((entry) => ({
    role: entry.role,
    playersText: entry.players.join(", "),
  }));
}

function rowsToCastEntries(rows: CastRow[]): CastEntry[] {
  return rows
    .filter((row) => row.role.trim().length > 0)
    .map((row) => ({
      role: row.role.trim(),
      players: row.playersText
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    }))
    .filter((entry) => entry.players.length > 0);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMeta(value: unknown): ShowRecord["meta"] {
  if (!isPlainObject(value)) return null;
  return value as ShowRecord["meta"];
}

type ShowApiResponse = {
  show?: {
    id: string;
    year: number;
    title: string | null;
    synopsis: string | null;
    dates: unknown;
    posterUrl: string | null;
    revealedAt: string | null;
    meta: unknown;
  };
  error?: string;
};

function serializeDates(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (value !== null && value !== undefined) return JSON.stringify(value);
  return null;
}

export function MetaFormDialog({ open, onOpenChange, show, onSaved }: MetaFormDialogProps) {
  const m = show.meta;

  const [author, setAuthor] = useState(m?.author ?? "");
  const [director, setDirector] = useState(m?.director ?? "");
  const [venue, setVenue] = useState(m?.venue ?? "");
  const [organizer, setOrganizer] = useState(m?.organizer ?? "");
  const [transport, setTransport] = useState(m?.transport ?? "");
  const [ticketInfo, setTicketInfo] = useState(m?.ticket_info ?? "");
  const [castRows, setCastRows] = useState<CastRow[]>(() => castEntriesToRows(m?.cast));
  const [deleteCastIndex, setDeleteCastIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function addCastRow() {
    setCastRows((prev) => [...prev, { role: "", playersText: "" }]);
  }

  function updateCastRow(index: number, field: keyof CastRow, value: string) {
    setCastRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function confirmDeleteCastRow() {
    if (deleteCastIndex === null) return;
    setCastRows((prev) => prev.filter((_, i) => i !== deleteCastIndex));
    setDeleteCastIndex(null);
  }

  async function handleSave() {
    setSaving(true);

    const castEntries = rowsToCastEntries(castRows);

    const existingMeta: Record<string, unknown> = isPlainObject(m) ? { ...m } : {};

    const updatedMeta: ShowMeta = {
      ...existingMeta,
      author: author.trim() || null,
      director: director.trim() || null,
      venue: venue.trim() || null,
      organizer: organizer.trim() || null,
      transport: transport.trim() || null,
      ticket_info: ticketInfo.trim() || null,
      cast: castEntries.length > 0 ? castEntries : null,
    };

    const payload = { meta: updatedMeta };

    try {
      const res = await fetch(`/api/chronik/shows/${encodeURIComponent(show.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as ShowApiResponse;

      if (!res.ok || !data.show) {
        toast.error(data.error ?? "Speichern fehlgeschlagen.", { duration: 5000 });
        return;
      }

      const saved: ShowRecord = {
        id: data.show.id,
        year: data.show.year,
        title: data.show.title,
        synopsis: data.show.synopsis,
        dates: serializeDates(data.show.dates),
        posterUrl: data.show.posterUrl,
        revealedAt: data.show.revealedAt,
        meta: parseMeta(data.show.meta),
      };

      onSaved(saved);
      toast.success("Meta-Daten gespeichert.", { duration: 3000 });
      onOpenChange(false);
    } catch {
      toast.error("Verbindungsfehler beim Speichern.", { duration: 5000 });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Meta-Daten – {show.title ?? show.year}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-4">
              <Heading level="h3" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Allgemein
              </Heading>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="meta-author">Autor</Label>
                  <Input
                    id="meta-author"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Autor des Stücks"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meta-director">Regie</Label>
                  <Input
                    id="meta-director"
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    placeholder="Regisseur/in"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meta-venue">Spielort</Label>
                <Input
                  id="meta-venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="z.B. Kulturhalle Altrossthal"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meta-organizer">Veranstalter</Label>
                <Input
                  id="meta-organizer"
                  value={organizer}
                  onChange={(e) => setOrganizer(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meta-transport">Anreise</Label>
                <Input
                  id="meta-transport"
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                  placeholder="Hinweis zur Anreise"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meta-ticket">Ticketinfo</Label>
                <Input
                  id="meta-ticket"
                  value={ticketInfo}
                  onChange={(e) => setTicketInfo(e.target.value)}
                  placeholder="z.B. Eintritt frei"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Heading level="h3" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Besetzung
                </Heading>
                <Button variant="outline" size="sm" type="button" onClick={addCastRow}>
                  <PlusIcon />
                  Rolle
                </Button>
              </div>

              {castRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Besetzung eingetragen.</p>
              ) : (
                <div className="space-y-2">
                  {castRows.map((row, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        className="w-36 shrink-0"
                        value={row.role}
                        onChange={(e) => updateCastRow(i, "role", e.target.value)}
                        placeholder="Rolle"
                        aria-label={`Rolle ${i + 1}`}
                      />
                      <Input
                        className="min-w-0 flex-1"
                        value={row.playersText}
                        onChange={(e) => updateCastRow(i, "playersText", e.target.value)}
                        placeholder="Name1, Name2"
                        aria-label={`Darsteller für Rolle ${i + 1}`}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteCastIndex(i)}
                        title="Rolle entfernen"
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <AsyncButton isLoading={saving} onClick={handleSave}>
              Speichern
            </AsyncButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteCastIndex !== null}
        onOpenChange={(open) => { if (!open) setDeleteCastIndex(null); }}
        title="Rolle entfernen"
        description={
          deleteCastIndex !== null
            ? `„${castRows[deleteCastIndex]?.role || "Unbenannte Rolle"}" wird aus der Besetzung entfernt.`
            : undefined
        }
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={confirmDeleteCastRow}
        onCancel={() => setDeleteCastIndex(null)}
      />
    </>
  );
}
