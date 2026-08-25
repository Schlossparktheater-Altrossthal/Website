"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { TrashIcon } from "@/components/ui/action-icons";
import type { ParagraphsContent } from "@/lib/website-content-schemas";

type Props = {
  contentId: string;
  initialContent: ParagraphsContent;
};

export function ParagraphsEditor({ contentId, initialContent }: Props) {
  const [paragraphs, setParagraphs] = useState<string[]>(initialContent.paragraphs);
  const [saving, setSaving] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/website/content/${contentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paragraphs }),
      });
      if (!res.ok) throw new Error();
      toast.success("Text gespeichert.", { duration: 3000 });
    } catch {
      toast.error("Speichern fehlgeschlagen.", { duration: 5000 });
    } finally {
      setSaving(false);
    }
  }, [contentId, paragraphs]);

  const updateParagraph = useCallback((index: number, value: string) => {
    setParagraphs((prev) => prev.map((p, i) => (i === index ? value : p)));
  }, []);

  const deleteParagraph = useCallback((index: number) => {
    setParagraphs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addParagraph = useCallback(() => {
    setParagraphs((prev) => [...prev, ""]);
  }, []);

  const moveParagraph = useCallback((index: number, direction: -1 | 1) => {
    setParagraphs((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  return (
    <div className="space-y-3">
      {paragraphs.map((p, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex flex-col gap-1 pt-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-xs"
              onClick={() => moveParagraph(index, -1)}
              disabled={index === 0}
              aria-label="Nach oben"
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-xs"
              onClick={() => moveParagraph(index, 1)}
              disabled={index === paragraphs.length - 1}
              aria-label="Nach unten"
            >
              ↓
            </Button>
          </div>
          <Textarea
            className="flex-1 resize-none"
            rows={3}
            value={p}
            onChange={(e) => updateParagraph(index, e.target.value)}
            placeholder={`Absatz ${index + 1}`}
          />
          <Button
            variant="ghost"
            size="icon"
            className="mt-2 shrink-0"
            aria-label="Absatz löschen"
            onClick={() => setDeleteIndex(index)}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addParagraph}>
          + Absatz hinzufügen
        </Button>
        <AsyncButton onClick={save} isLoading={saving} size="sm">
          Speichern
        </AsyncButton>
      </div>
      <ConfirmDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIndex(null);
        }}
        title="Absatz löschen?"
        description="Dieser Absatz wird dauerhaft entfernt."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => {
          if (deleteIndex !== null) {
            deleteParagraph(deleteIndex);
            setDeleteIndex(null);
          }
        }}
        onCancel={() => setDeleteIndex(null)}
      />
    </div>
  );
}
