"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { EditIcon, TrashIcon } from "@/components/ui/action-icons";
import type { StatItem, StatsContent } from "@/lib/website-content-schemas";

type Props = {
  contentId: string;
  initialContent: StatsContent;
};

export function StatsEditor({ contentId, initialContent }: Props) {
  const [items, setItems] = useState<StatItem[]>(initialContent.items);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<(StatItem & { index: number }) | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/website/content/${contentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error();
      toast.success("Kennzahlen gespeichert.", { duration: 3000 });
    } catch {
      toast.error("Speichern fehlgeschlagen.", { duration: 5000 });
    } finally {
      setSaving(false);
    }
  }, [contentId, items]);

  const moveItem = useCallback((index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-xs" onClick={() => moveItem(index, -1)} disabled={index === 0} aria-label="Nach oben">↑</Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-xs" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} aria-label="Nach unten">↓</Button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.label}: <span className="text-primary">{item.value}</span></p>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEditItem({ ...item, index })} aria-label="Bearbeiten">
                <EditIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Löschen" onClick={() => setDeleteIndex(index)}>
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>+ Kennzahl hinzufügen</Button>
        <AsyncButton onClick={save} isLoading={saving} size="sm">Speichern</AsyncButton>
      </div>

      <StatDialog open={addOpen} onOpenChange={setAddOpen} title="Neue Kennzahl" onSave={(item) => { setItems((prev) => [...prev, item]); setAddOpen(false); }} />
      {editItem && (
        <StatDialog open onOpenChange={(open) => !open && setEditItem(null)} title="Kennzahl bearbeiten" initialValues={editItem}
          onSave={(item) => { setItems((prev) => prev.map((it, i) => (i === editItem.index ? item : it))); setEditItem(null); }} />
      )}
      <ConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => { if (!open) setDeleteIndex(null); }}
        title="Kennzahl löschen?"
        description={deleteIndex !== null ? `"${items[deleteIndex]?.label}" wird dauerhaft entfernt.` : undefined}
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => { if (deleteIndex !== null) { setItems((prev) => prev.filter((_, i) => i !== deleteIndex)); setDeleteIndex(null); } }}
        onCancel={() => setDeleteIndex(null)}
      />
    </div>
  );
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValues?: Partial<StatItem>;
  onSave: (item: StatItem) => void;
};

function StatDialog({ open, onOpenChange, title, initialValues, onSave }: DialogProps) {
  const [label, setLabel] = useState(initialValues?.label ?? "");
  const [value, setValue] = useState(initialValues?.value ?? "");
  const [detail, setDetail] = useState(initialValues?.detail ?? "");

  const handleSave = () => {
    if (!label.trim() || !value.trim() || !detail.trim()) return;
    onSave({ label: label.trim(), value: value.trim(), detail: detail.trim() });
    setLabel(""); setValue(""); setDetail("");
  };

  return (
    <ModalFormDialog open={open} onOpenChange={onOpenChange} title={title} onSave={handleSave} saveLabel="Übernehmen">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Bezeichnung</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Gründung" />
        </div>
        <div className="space-y-1.5">
          <Label>Wert</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="z. B. 2009" />
        </div>
        <div className="space-y-1.5">
          <Label>Detail</Label>
          <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Kurze Erläuterung" />
        </div>
      </div>
    </ModalFormDialog>
  );
}
