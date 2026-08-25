"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { EditIcon, TrashIcon } from "@/components/ui/action-icons";
import type { FaqContent, FaqItem } from "@/lib/website-content-schemas";

type Props = {
  contentId: string;
  initialContent: FaqContent;
};

export function FaqEditor({ contentId, initialContent }: Props) {
  const [items, setItems] = useState<FaqItem[]>(initialContent.items);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<(FaqItem & { index: number }) | null>(null);
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
      toast.success("FAQ gespeichert.", { duration: 3000 });
    } catch {
      toast.error("Speichern fehlgeschlagen.", { duration: 5000 });
    } finally {
      setSaving(false);
    }
  }, [contentId, items]);

  const handleAdd = useCallback((item: FaqItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const handleEdit = useCallback((item: FaqItem, index: number) => {
    setItems((prev) => prev.map((it, i) => (i === index ? item : it)));
  }, []);

  const handleDelete = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

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
          <div
            key={index}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-xs"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                aria-label="Nach oben"
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-xs"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Nach unten"
              >
                ↓
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.question}</p>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.answer}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditItem({ ...item, index })}
                aria-label="Bearbeiten"
              >
                <EditIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Löschen"
                onClick={() => setDeleteIndex(index)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          + Frage hinzufügen
        </Button>
        <AsyncButton onClick={save} isLoading={saving} size="sm">
          Speichern
        </AsyncButton>
      </div>

      <FaqItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Neue Frage"
        onSave={(item) => {
          handleAdd(item);
          setAddOpen(false);
        }}
      />

      {editItem && (
        <FaqItemDialog
          open
          onOpenChange={(open) => !open && setEditItem(null)}
          title="Frage bearbeiten"
          initialValues={editItem}
          onSave={(item) => {
            handleEdit(item, editItem.index);
            setEditItem(null);
          }}
        />
      )}
      <ConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIndex(null);
        }}
        title="Frage löschen?"
        description={
          deleteIndex !== null
            ? `"${items[deleteIndex]?.question}" wird dauerhaft entfernt.`
            : undefined
        }
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => {
          if (deleteIndex !== null) handleDelete(deleteIndex);
          setDeleteIndex(null);
        }}
        onCancel={() => setDeleteIndex(null)}
      />
    </div>
  );
}

type FaqItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValues?: Partial<FaqItem>;
  onSave: (item: FaqItem) => void;
};

function FaqItemDialog({ open, onOpenChange, title, initialValues, onSave }: FaqItemDialogProps) {
  const [question, setQuestion] = useState(initialValues?.question ?? "");
  const [answer, setAnswer] = useState(initialValues?.answer ?? "");

  const handleSave = () => {
    if (!question.trim() || !answer.trim()) return;
    onSave({ question: question.trim(), answer: answer.trim() });
    setQuestion("");
    setAnswer("");
  };

  return (
    <ModalFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      onSave={handleSave}
      saveLabel="Übernehmen"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Frage</Label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Was möchten Besucher wissen?"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Antwort</Label>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Die Antwort auf die Frage..."
            rows={4}
          />
        </div>
      </div>
    </ModalFormDialog>
  );
}
