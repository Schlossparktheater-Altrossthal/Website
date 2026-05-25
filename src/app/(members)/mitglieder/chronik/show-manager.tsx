"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heading, Text } from "@/components/ui/typography";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PlusIcon, EditIcon, TrashIcon } from "@/components/ui/action-icons";
import { ShowFormDialog } from "./show-form-dialog";
import { MetaFormDialog } from "./meta-form-dialog";
import type { ShowRecord } from "./types";

type ShowManagerProps = {
  initialShows: ShowRecord[];
};

export function ShowManager({ initialShows }: ShowManagerProps) {
  const [shows, setShows] = useState<ShowRecord[]>(initialShows);
  const [addOpen, setAddOpen] = useState(false);
  const [editShow, setEditShow] = useState<ShowRecord | null>(null);
  const [metaShow, setMetaShow] = useState<ShowRecord | null>(null);
  const [deleteShowId, setDeleteShowId] = useState<string | null>(null);

  async function handleDelete() {
    const id = deleteShowId;
    if (!id) return;
    setDeleteShowId(null);

    try {
      const res = await fetch(`/api/chronik/shows/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Löschen fehlgeschlagen.", { duration: 5000 });
        return;
      }
      setShows((prev) => prev.filter((s) => s.id !== id));
      toast.success("Produktion gelöscht.", { duration: 3000 });
    } catch {
      toast.error("Verbindungsfehler beim Löschen.", { duration: 5000 });
    }
  }

  function handleSaved(updated: ShowRecord) {
    setShows((prev) => {
      const idx = prev.findIndex((s) => s.id === updated.id);
      if (idx >= 0) {
        return prev.map((s) => (s.id === updated.id ? updated : s));
      }
      return [updated, ...prev].sort((a, b) => b.year - a.year);
    });
  }

  const deleteTarget = shows.find((s) => s.id === deleteShowId);

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading level="h2" className="text-lg font-semibold">
          Produktionen
        </Heading>
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          <PlusIcon />
          Neue Produktion
        </Button>
      </div>

      {shows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Noch keine Produktionen vorhanden.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shows.map((show) => (
            <div
              key={show.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    {show.year}
                  </span>
                  <span className="font-medium">
                    {show.title ?? <span className="italic text-muted-foreground">Kein Titel</span>}
                  </span>
                  {show.revealedAt ? (
                    <Badge variant="success">öffentlich</Badge>
                  ) : (
                    <Badge variant="muted">unveröffentlicht</Badge>
                  )}
                </div>
                {show.synopsis && (
                  <Text className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {show.synopsis}
                  </Text>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMetaShow(show)}
                  title="Meta-Daten bearbeiten"
                >
                  Meta
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditShow(show)}
                  title="Grunddaten bearbeiten"
                >
                  <EditIcon />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteShowId(show.id)}
                  title="Produktion löschen"
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ShowFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={handleSaved}
      />

      {editShow && (
        <ShowFormDialog
          key={`edit-${editShow.id}`}
          open
          onOpenChange={(open) => { if (!open) setEditShow(null); }}
          show={editShow}
          onSaved={(updated) => { handleSaved(updated); setEditShow(null); }}
        />
      )}

      {metaShow && (
        <MetaFormDialog
          key={`meta-${metaShow.id}`}
          open
          onOpenChange={(open) => { if (!open) setMetaShow(null); }}
          show={metaShow}
          onSaved={(updated) => { handleSaved(updated); setMetaShow(null); }}
        />
      )}

      <ConfirmDialog
        open={deleteShowId !== null}
        onOpenChange={(open) => { if (!open) setDeleteShowId(null); }}
        title="Produktion löschen"
        description={
          deleteTarget
            ? `„${deleteTarget.title ?? deleteTarget.year}" wird dauerhaft gelöscht. Alle verknüpften Daten (Proben, Finanzen, Besetzung usw.) werden ebenfalls entfernt.`
            : undefined
        }
        confirmLabel="Endgültig löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setDeleteShowId(null)}
      />
    </>
  );
}
