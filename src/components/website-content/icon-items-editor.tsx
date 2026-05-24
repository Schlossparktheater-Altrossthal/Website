"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EditIcon, TrashIcon } from "@/components/ui/action-icons";
import { AVAILABLE_ICON_NAMES, type IconItem, type IconItemsContent } from "@/lib/website-content-schemas";

type Props = {
  contentId: string;
  initialContent: IconItemsContent;
};

export function IconItemsEditor({ contentId, initialContent }: Props) {
  const [items, setItems] = useState<IconItem[]>(initialContent.items);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<(IconItem & { index: number }) | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/website/content/${contentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error();
      toast.success("Einträge gespeichert.", { duration: 3000 });
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
              <p className="text-xs font-mono text-muted-foreground">{item.icon}</p>
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEditItem({ ...item, index })} aria-label="Bearbeiten">
                <EditIcon className="h-4 w-4" />
              </Button>
              <ConfirmDialog
                trigger={<Button variant="ghost" size="icon" aria-label="Löschen"><TrashIcon className="h-4 w-4" /></Button>}
                title="Eintrag löschen?"
                description={`"${item.title}" wird dauerhaft entfernt.`}
                confirmLabel="Löschen"
                onConfirm={() => setItems((prev) => prev.filter((_, i) => i !== index))}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>+ Eintrag hinzufügen</Button>
        <AsyncButton onClick={save} loading={saving} size="sm">Speichern</AsyncButton>
      </div>

      <IconItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Neuer Eintrag"
        onSave={(item) => { setItems((prev) => [...prev, item]); setAddOpen(false); }}
      />

      {editItem && (
        <IconItemDialog
          open
          onOpenChange={(open) => !open && setEditItem(null)}
          title="Eintrag bearbeiten"
          initialValues={editItem}
          onSave={(item) => { setItems((prev) => prev.map((it, i) => (i === editItem.index ? item : it))); setEditItem(null); }}
        />
      )}
    </div>
  );
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValues?: Partial<IconItem>;
  onSave: (item: IconItem) => void;
};

function IconItemDialog({ open, onOpenChange, title, initialValues, onSave }: DialogProps) {
  const [icon, setIcon] = useState(initialValues?.icon ?? AVAILABLE_ICON_NAMES[0]);
  const [itemTitle, setItemTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");

  const handleSave = () => {
    if (!icon || !itemTitle.trim() || !description.trim()) return;
    onSave({ icon, title: itemTitle.trim(), description: description.trim() });
    setIcon(AVAILABLE_ICON_NAMES[0]); setItemTitle(""); setDescription("");
  };

  return (
    <ModalFormDialog open={open} onOpenChange={onOpenChange} title={title} onSave={handleSave} saveLabel="Übernehmen">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Icon</Label>
          <Select value={icon} onValueChange={setIcon}>
            <SelectTrigger>
              <SelectValue placeholder="Icon wählen" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_ICON_NAMES.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Titel</Label>
          <Input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} placeholder="Bezeichnung" />
        </div>
        <div className="space-y-1.5">
          <Label>Beschreibung</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kurze Beschreibung..." rows={3} />
        </div>
      </div>
    </ModalFormDialog>
  );
}
