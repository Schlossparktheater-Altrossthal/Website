"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CloseIcon, EditIcon, TrashIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SCRIPT_MARKER_STYLES } from "@/config/category-colors";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import type { ProductionActionResult } from "@/lib/produktionen/actions-helpers";
import {
  ANNOTATION_COLORS,
  type AnnotationColor,
  type ReaderAnnotation,
} from "@/lib/skript/annotation-types";
import type { ReaderBlock } from "@/lib/skript/reader";
import { cn } from "@/lib/utils";

import {
  anchorAnnotationAction,
  createAnnotationAction,
  deleteAnnotationAction,
  updateAnnotationAction,
} from "../actions";

/** Markierungen und Notizen im Leser (docs/Plan/skript-plan.md, Phase 8). */

export type TextSelection = {
  blockId: string;
  partIndex: number;
  start: number;
  end: number;
  quote: string;
};

const COLOR_LABEL: Record<AnnotationColor, string> = {
  gelb: "Gelb",
  gruen: "Grün",
  blau: "Blau",
  rosa: "Rosa",
};

const DATE_TIME = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Zeichenposition eines DOM-Punkts innerhalb eines Absatz-Teils (`data-part`). */
function offsetInPart(part: Element, node: Node, offset: number) {
  const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT);
  // Ein Teil kann am Satzende geteilt sein (Hinweiszeile dazwischen): Ausschnitt beginnt hier.
  let total = Number(part.getAttribute("data-part-offset") ?? 0);
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
  }
  // Punkt liegt auf einem Element statt einem Textknoten: Anfang bzw. Ende des Elements.
  return node === part && offset === 0 ? Number(part.getAttribute("data-part-offset") ?? 0) : total;
}

function partOf(node: Node | null) {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest("[data-part]") ?? null;
}

/** Aktuelle Textauswahl im Leser auf Absatz/Teil/Zeichen abbilden (nur innerhalb eines Absatzes). */
export function useTextSelection(root: React.RefObject<HTMLElement | null>, blocks: ReaderBlock[]) {
  const [selection, setSelection] = React.useState<TextSelection | null>(null);
  React.useEffect(() => {
    let timer = 0;
    const read = () => {
      const current = window.getSelection();
      if (!current || current.isCollapsed || !current.rangeCount) {
        setSelection(null);
        return;
      }
      const range = current.getRangeAt(0);
      const startPart = partOf(range.startContainer);
      if (!startPart || !root.current?.contains(startPart)) {
        setSelection(null);
        return;
      }
      const blockElement = startPart.closest("[data-block]");
      const block = blocks.find((entry) => entry.id === blockElement?.getAttribute("data-block"));
      const partIndex = Number(startPart.getAttribute("data-part"));
      const text = block?.parts[partIndex]?.text;
      if (!block || text === undefined) {
        setSelection(null);
        return;
      }
      const endPart = partOf(range.endContainer);
      const start = offsetInPart(startPart, range.startContainer, range.startOffset);
      // Über den Teil hinaus markiert: bis zum Ende dieses Teils kürzen.
      const end =
        endPart === startPart ||
        (endPart?.closest("[data-block]") === blockElement &&
          endPart?.getAttribute("data-part") === startPart.getAttribute("data-part"))
          ? offsetInPart(endPart ?? startPart, range.endContainer, range.endOffset)
          : text.length;
      const from = Math.max(0, Math.min(start, text.length));
      const to = Math.max(from, Math.min(end, text.length));
      const quote = text.slice(from, to);
      if (!quote.trim()) {
        setSelection(null);
        return;
      }
      setSelection({ blockId: block.id, partIndex, start: from, end: to, quote });
    };
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(read, 150);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.clearTimeout(timer);
    };
  }, [blocks, root]);
  const clear = React.useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);
  return [selection, clear] as const;
}

function useActionRunner() {
  const router = useRouter();
  return React.useCallback(
    async (action: Promise<ProductionActionResult>, success?: string) => {
      const result = await action;
      if (!result.ok) {
        toast.error("Das hat nicht geklappt", { description: result.error });
        return false;
      }
      if (success) toast.success(success);
      router.refresh();
      return true;
    },
    [router],
  );
}

function ColorButtons({
  value,
  onPick,
}: {
  value?: AnnotationColor | null;
  onPick: (color: AnnotationColor) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Markerfarbe">
      {ANNOTATION_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`${COLOR_LABEL[color]} markieren`}
          aria-pressed={value === color}
          onClick={() => onPick(color)}
          className={cn(
            "h-9 w-9 border border-border",
            SCRIPT_MARKER_STYLES[color],
            value === color && "outline outline-2 outline-offset-1 outline-foreground",
          )}
        />
      ))}
    </div>
  );
}

/**
 * Leiste unten, sobald Text markiert oder ein Absatz angetippt ist: Marker setzen oder Notiz
 * schreiben. Auf dem Handy bleibt das System-Menü der Textauswahl oben frei.
 */
export function AnnotationBar({
  versionId,
  selection,
  blockId,
  onNote,
  onDone,
}: {
  versionId: string;
  selection: TextSelection | null;
  blockId: string | null;
  onNote: () => void;
  onDone: () => void;
}) {
  const run = useActionRunner();
  const [busy, setBusy] = React.useState(false);
  const target = selection?.blockId ?? blockId;
  if (!target) return null;
  const mark = async (color: AnnotationColor) => {
    setBusy(true);
    const ok = await run(
      createAnnotationAction({
        versionId,
        blockId: target,
        kind: "highlight",
        color,
        ...(selection
          ? { partIndex: selection.partIndex, start: selection.start, end: selection.end }
          : {}),
      }),
    );
    setBusy(false);
    if (ok) onDone();
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4" aria-busy={busy}>
      <span className="w-full truncate text-xs text-muted-foreground sm:w-auto sm:max-w-[16rem]">
        {selection ? `„${selection.quote}“` : "Ganzer Absatz"}
      </span>
      <ColorButtons onPick={(color) => void mark(color)} />
      <Button variant="outline" onClick={onNote} disabled={busy}>
        <EditIcon aria-hidden /> Notiz
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Abbrechen"
        onClick={onDone}
        className="ml-auto"
      >
        <CloseIcon aria-hidden />
      </Button>
    </div>
  );
}

export type EditorState =
  | { mode: "create"; blockId: string; selection: TextSelection | null }
  | { mode: "edit"; annotation: ReaderAnnotation };

/** Notiz schreiben oder eine eigene Markierung/Notiz bearbeiten. */
export function AnnotationEditor({
  versionId,
  state,
  onClose,
}: {
  versionId: string;
  state: EditorState | null;
  onClose: () => void;
}) {
  const run = useActionRunner();
  const annotation = state?.mode === "edit" ? state.annotation : null;
  const [body, setBody] = React.useState(annotation?.body ?? "");
  const [color, setColor] = React.useState<AnnotationColor | null>(annotation?.color ?? null);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const quote = state?.mode === "create" ? state.selection?.quote : annotation?.quote;
  const isHighlight = annotation?.kind === "highlight";

  const save = async () => {
    if (!state) return;
    setBusy(true);
    const ok =
      state.mode === "create"
        ? await run(
            createAnnotationAction({
              versionId,
              blockId: state.blockId,
              kind: "note",
              body,
              ...(state.selection
                ? {
                    partIndex: state.selection.partIndex,
                    start: state.selection.start,
                    end: state.selection.end,
                  }
                : {}),
            }),
            "Notiz gespeichert",
          )
        : await run(
            updateAnnotationAction(versionId, state.annotation.id, {
              body: body || null,
              ...(isHighlight && color ? { color } : {}),
            }),
            "Gespeichert",
          );
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <>
      <BottomSheet
        open={!!state}
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={isHighlight ? "Markierung" : annotation ? "Notiz" : "Neue Notiz"}
        description="Nur für dich sichtbar"
        showDescription
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {annotation ? (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <TrashIcon aria-hidden /> Löschen
              </Button>
            ) : null}
            <AsyncButton
              className="ml-auto"
              isLoading={busy}
              loadingText="Speichert …"
              disabled={!isHighlight && !body.trim()}
              onClick={() => void save()}
            >
              Speichern
            </AsyncButton>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          {quote ? (
            <p className="border-l-2 border-border bg-muted px-2 py-1 text-muted-foreground">
              „{quote}“
            </p>
          ) : (
            <p className="text-muted-foreground">Gilt für den ganzen Absatz.</p>
          )}
          {annotation?.state === "changed" ? (
            <div className="border-l-2 border-warning bg-warning/10 px-2 py-1">
              <p className="font-medium">Der Absatz hat sich in dieser Fassung geändert.</p>
              <p className="text-muted-foreground">Vorher: „{annotation.previousText}“</p>
            </div>
          ) : null}
          {isHighlight ? <ColorButtons value={color} onPick={setColor} /> : null}
          <label className="block space-y-1">
            <span className="font-medium">{isHighlight ? "Notiz (optional)" : "Notiz"}</span>
            <textarea
              autoFocus={!isHighlight}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              maxLength={4000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-base"
              placeholder="z. B. Betonung auf „nie“, hier zur Rampe gehen …"
            />
          </label>
          {annotation ? (
            <p className="text-xs text-muted-foreground">
              Angelegt {DATE_TIME.format(new Date(annotation.createdAt))}
              {annotation.updatedAt !== annotation.createdAt
                ? ` · geändert ${DATE_TIME.format(new Date(annotation.updatedAt))}`
                : ""}
            </p>
          ) : null}
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={isHighlight ? "Markierung löschen?" : "Notiz löschen?"}
        description="Das lässt sich nicht rückgängig machen."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!annotation) return;
          setConfirmDelete(false);
          void run(deleteAnnotationAction(versionId, annotation.id), "Gelöscht").then((ok) => {
            if (ok) onClose();
          });
        }}
      />
    </>
  );
}

/**
 * Notizen, die nach einer neuen Fassung eine Entscheidung brauchen: Absatz geändert oder
 * gestrichen. „Passt so“ bestätigt am aktuellen Platz, „Anderen Absatz“ startet das Zuordnen.
 */
export function AnnotationReview({
  versionId,
  open,
  onOpenChange,
  annotations,
  blocks,
  onPick,
}: {
  versionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annotations: ReaderAnnotation[];
  blocks: Map<string, ReaderBlock>;
  onPick: (annotationId: string) => void;
}) {
  const run = useActionRunner();
  const [deleting, setDeleting] = React.useState<string | null>(null);
  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Notizen prüfen"
        description="Diese Notizen hängen an Text, der sich in dieser Fassung geändert hat oder gestrichen wurde."
        showDescription
      >
        {annotations.length ? (
          <ul className="space-y-3 text-sm">
            {annotations.map((annotation) => {
              const block = annotation.blockId ? blocks.get(annotation.blockId) : undefined;
              return (
                <li
                  key={annotation.id}
                  className="space-y-2 border-l-[3px] border-warning bg-muted p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {annotation.state === "orphaned" ? "Absatz gestrichen" : "Absatz geändert"} ·{" "}
                    {annotation.kind === "note"
                      ? "Notiz"
                      : annotation.kind === "ink"
                        ? "Zeichnung"
                        : "Markierung"}
                  </p>
                  {annotation.body ? (
                    <p className="whitespace-pre-wrap break-words font-medium">{annotation.body}</p>
                  ) : null}
                  <p className="text-muted-foreground">
                    Vorher: <del>„{annotation.previousText}“</del>
                  </p>
                  {block ? <p>Jetzt: „{block.parts.map((part) => part.text).join(" ")}“</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {block ? (
                      <AsyncButtonAction
                        label="Passt so"
                        action={() =>
                          run(
                            anchorAnnotationAction(versionId, annotation.id, block.id),
                            "Übernommen",
                          )
                        }
                      />
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => onPick(annotation.id)}>
                      Anderen Absatz wählen
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(annotation.id)}>
                      <TrashIcon aria-hidden /> Löschen
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">Alles geprüft.</p>
        )}
      </BottomSheet>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(value) => (value ? undefined : setDeleting(null))}
        title="Löschen?"
        description="Das lässt sich nicht rückgängig machen."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void run(deleteAnnotationAction(versionId, deleting), "Gelöscht");
          setDeleting(null);
        }}
      />
    </>
  );
}

function AsyncButtonAction({ label, action }: { label: string; action: () => Promise<boolean> }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <AsyncButton
      size="sm"
      isLoading={busy}
      loadingText="…"
      onClick={async () => {
        setBusy(true);
        await action();
        setBusy(false);
      }}
    >
      {label}
    </AsyncButton>
  );
}

/** Hinweisleiste beim Neu-Zuordnen: nächster angetippter Absatz wird der neue Platz. */
export function PickBar({
  versionId,
  annotationId,
  blockId,
  onDone,
}: {
  versionId: string;
  annotationId: string;
  blockId: string | null;
  onDone: () => void;
}) {
  const run = useActionRunner();
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm sm:px-4">
      <span className="min-w-0 flex-1">
        {blockId ? "Diesen Absatz übernehmen?" : "Tippe auf den Absatz, zu dem die Notiz gehört."}
      </span>
      {blockId ? (
        <AsyncButton
          size="sm"
          isLoading={busy}
          loadingText="…"
          onClick={async () => {
            setBusy(true);
            const ok = await run(
              anchorAnnotationAction(versionId, annotationId, blockId),
              "Zugeordnet",
            );
            setBusy(false);
            if (ok) onDone();
          }}
        >
          Hierhin
        </AsyncButton>
      ) : null}
      <Button variant="ghost" size="sm" onClick={onDone}>
        Abbrechen
      </Button>
    </div>
  );
}
