"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SIZE_CATEGORY_HINTS,
  SIZE_CATEGORY_LABELS,
  type SizeCategory,
  type SizeEntry,
} from "@/data/sizes";

type SizeDialogProps = {
  /** Offene Kategorie; `null` schließt den Dialog. */
  category: SizeCategory | null;
  entry: SizeEntry | null;
  /** Andere Person als die angemeldete (Kostüm-Team, Vorstand). */
  userId?: string;
  personName?: string;
  onClose: () => void;
  onSaved: (entry: SizeEntry) => void;
  onDeleted: (category: SizeCategory) => void;
};

/** Eine Konfektionsgröße eintragen, ändern oder entfernen. */
export function SizeDialog({
  category,
  entry,
  userId,
  personName,
  onClose,
  onSaved,
  onDeleted,
}: SizeDialogProps) {
  return (
    <Dialog open={category !== null} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-w-sm">
        {category ? (
          <SizeForm
            key={`${userId ?? "self"}-${category}`}
            category={category}
            entry={entry}
            userId={userId}
            personName={personName}
            onSaved={onSaved}
            onDeleted={onDeleted}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SizeForm({
  category,
  entry,
  userId,
  personName,
  onSaved,
  onDeleted,
}: Omit<SizeDialogProps, "category" | "onClose"> & { category: SizeCategory }) {
  const [size, setSize] = useState(entry?.size ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [busy, setBusy] = useState(false);

  const request = async (input: RequestInfo, init: RequestInit) => {
    setBusy(true);
    try {
      const response = await fetch(input, init);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Fehlgeschlagen");
      }
      return payload;
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const saved = await request("/api/sizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, size, note: note.trim() || undefined, userId }),
      });
      onSaved({ id: saved.id, category, size: saved.size, note: saved.note ?? null });
      toast.success("Größe gespeichert");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
    }
  };

  const remove = async () => {
    if (!entry) return;
    try {
      await request(`/api/sizes?id=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      onDeleted(category);
      toast.success("Größe entfernt");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Entfernen fehlgeschlagen");
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{SIZE_CATEGORY_LABELS[category]}</DialogTitle>
        <DialogDescription>
          {personName ? `Konfektionsgröße von ${personName}. ` : null}
          {SIZE_CATEGORY_HINTS[category]}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="size-value">Größe</Label>
        <Input
          id="size-value"
          value={size}
          maxLength={30}
          autoFocus
          required
          onChange={(event) => setSize(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="size-note">Notiz (optional)</Label>
        <Input
          id="size-note"
          value={note}
          maxLength={200}
          placeholder="z. B. fällt klein aus, lieber weit"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        {entry ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={remove}>
            Entfernen
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={busy || !size.trim()}>
          Speichern
        </Button>
      </div>
    </form>
  );
}
