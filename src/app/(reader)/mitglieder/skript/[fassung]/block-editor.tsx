"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import type { ReaderBlock, ReaderRole } from "@/lib/skript/reader";
import { roleKey, splitSpeakerRoles } from "@/lib/skript/roles";
import type { CueCategory, ScriptPart } from "@/lib/skript/types";
import { cn } from "@/lib/utils";

import { deleteBlockAction, insertBlockAction, saveBlockAction } from "../edit-actions";
import { CUE_STYLE } from "../shared";

/**
 * Absatz korrigieren (docs/Plan/skript-plan.md, Phase 10): Art, Sprecher und Teile. In einer
 * freigegebenen Fassung legt das erste Speichern eine Kopie „(bearbeitet)“ als Entwurf an.
 */

type PartKind = ScriptPart["kind"];
type DraftPart = { key: string; kind: PartKind; text: string; category: CueCategory };

export type BlockEditorState = { mode: "edit" | "insert"; block: ReaderBlock };

const PART_KINDS: { value: PartKind; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "direction", label: "Regie" },
  { value: "cue", label: "Hinweis" },
];

const newKey = () => Math.random().toString(36).slice(2);

function toDraft(parts: ScriptPart[]): DraftPart[] {
  return parts.map((part) => ({
    key: newKey(),
    kind: part.kind,
    text: part.text,
    category: part.kind === "cue" ? part.category : "technik",
  }));
}

export function BlockEditor({
  state,
  onClose,
  versionId,
  released,
  roles,
}: {
  state: BlockEditorState | null;
  onClose: () => void;
  versionId: string;
  released: boolean;
  roles: ReaderRole[];
}) {
  return (
    <BottomSheet
      open={!!state}
      onOpenChange={(open) => !open && onClose()}
      title={state?.mode === "insert" ? "Neuer Absatz danach" : "Absatz bearbeiten"}
      description={
        released
          ? "Die freigegebene Fassung bleibt unverändert – gespeichert wird in einer bearbeiteten Kopie (Entwurf)."
          : "Änderungen gelten im Entwurf; freigegeben wird über „Fassung prüfen“."
      }
      showDescription
      className="sm:max-w-2xl"
    >
      {state ? (
        <EditorForm
          key={`${state.mode}:${state.block.id}`}
          state={state}
          onClose={onClose}
          versionId={versionId}
          released={released}
          roles={roles}
        />
      ) : null}
    </BottomSheet>
  );
}

function EditorForm({
  state,
  onClose,
  versionId,
  released,
  roles,
}: {
  state: BlockEditorState;
  onClose: () => void;
  versionId: string;
  released: boolean;
  roles: ReaderRole[];
}) {
  const router = useRouter();
  const insert = state.mode === "insert";
  const [kind, setKind] = React.useState<ReaderBlock["kind"]>(insert ? "speech" : state.block.kind);
  const [speaker, setSpeaker] = React.useState(insert ? "" : (state.block.speaker ?? ""));
  const [parts, setParts] = React.useState<DraftPart[]>(() =>
    insert
      ? [{ key: newKey(), kind: "text", text: "", category: "technik" }]
      : toDraft(state.block.parts),
  );
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [allRoles, setAllRoles] = React.useState(false);
  // Erst die Rollen dieser Szene – das ganze Stück ist am Handy eine lange Liste.
  const sceneRoles = roles.filter((role) => role.sceneIds.includes(state.block.sceneId));
  const shownRoles = allRoles || !sceneRoles.length ? roles : sceneRoles;

  const speakerKeys = new Set(splitSpeakerRoles(speaker).map(roleKey));
  const toggleRole = (name: string) => {
    const names = splitSpeakerRoles(speaker);
    const next = speakerKeys.has(roleKey(name))
      ? names.filter((entry) => roleKey(entry) !== roleKey(name))
      : [...names, name];
    setSpeaker(next.join("/"));
  };
  const setPart = (key: string, patch: Partial<DraftPart>) =>
    setParts((current) => current.map((part) => (part.key === key ? { ...part, ...patch } : part)));
  const movePart = (index: number, delta: number) =>
    setParts((current) => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(index + delta, 0, moved);
      return next;
    });

  const finish = (
    result: { ok: true; value: { versionId: string } } | { ok: false; error: string },
  ) => {
    if (!result.ok) {
      toast.error("Nicht gespeichert", { description: result.error });
      return;
    }
    onClose();
    if (result.value.versionId !== versionId) {
      toast.success("Bearbeitete Fassung als Entwurf angelegt");
      router.push(`/mitglieder/skript/${result.value.versionId}`);
    } else {
      router.refresh();
    }
  };

  const save = async () => {
    const edit = {
      kind,
      speaker: kind === "speech" ? speaker : null,
      parts: parts.map((part) =>
        part.kind === "cue"
          ? { kind: "cue" as const, text: part.text, category: part.category }
          : { kind: part.kind, text: part.text },
      ),
    };
    setBusy(true);
    try {
      finish(
        insert
          ? await insertBlockAction(versionId, state.block.lineageId, edit)
          : await saveBlockAction(versionId, state.block.lineageId, edit),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      finish(await deleteBlockAction(versionId, state.block.lineageId));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <SegmentedControl
        aria-label="Art des Absatzes"
        value={kind}
        onValueChange={setKind}
        fullWidth
        options={[
          { value: "speech", label: "Replik" },
          { value: "direction", label: "Anweisung" },
        ]}
      />

      {kind === "speech" ? (
        <div className="space-y-2">
          <Label htmlFor="block-speaker">Wer spricht?</Label>
          <Input
            id="block-speaker"
            value={speaker}
            onChange={(event) => setSpeaker(event.target.value)}
            placeholder="z. B. Atreju oder Atreju/Bastian"
          />
          {roles.length ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rollen">
              {shownRoles.map((role) => (
                <Button
                  key={role.id}
                  type="button"
                  size="sm"
                  variant={speakerKeys.has(roleKey(role.name)) ? "default" : "outline"}
                  aria-pressed={speakerKeys.has(roleKey(role.name))}
                  onClick={() => toggleRole(role.name)}
                  className="h-8 px-2.5"
                >
                  {role.name}
                </Button>
              ))}
              {sceneRoles.length && sceneRoles.length < roles.length ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setAllRoles(!allRoles)}
                >
                  {allRoles ? "Nur diese Szene" : `Alle Rollen (${roles.length})`}
                </Button>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Unbekannte Namen fragt der Prüfschritt vor der Freigabe nach.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm font-medium">Teile</p>
        {parts.map((part, index) => (
          <div
            key={part.key}
            data-edit-part
            className={cn(
              "space-y-2 border-l-4 py-1 pl-3",
              part.kind === "text" && "border-foreground/40",
              part.kind === "direction" && "border-muted-foreground/40",
              part.kind === "cue" && "border-primary",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                aria-label={`Art von Teil ${index + 1}`}
                size="sm"
                value={part.kind}
                onValueChange={(value) => setPart(part.key, { kind: value })}
                options={PART_KINDS}
              />
              {part.kind === "cue" ? (
                <select
                  aria-label="Gewerk"
                  value={part.category}
                  onChange={(event) =>
                    setPart(part.key, { category: event.target.value as CueCategory })
                  }
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {(Object.keys(CUE_STYLE) as CueCategory[]).map((category) => (
                    <option key={category} value={category}>
                      {CUE_STYLE[category].label}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="ml-auto flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Teil nach oben"
                  disabled={index === 0}
                  onClick={() => movePart(index, -1)}
                >
                  <ChevronUpIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Teil nach unten"
                  disabled={index === parts.length - 1}
                  onClick={() => movePart(index, 1)}
                >
                  <ChevronDownIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={parts.length === 1}
                  onClick={() =>
                    setParts((current) => current.filter((entry) => entry.key !== part.key))
                  }
                >
                  Entfernen
                </Button>
              </div>
            </div>
            <Textarea
              aria-label={`Text von Teil ${index + 1}`}
              value={part.text}
              rows={Math.min(8, Math.max(2, Math.ceil(part.text.length / 60)))}
              onChange={(event) => setPart(part.key, { text: event.target.value })}
              className={cn(part.kind === "direction" && "italic")}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setParts((current) => [
              ...current,
              { key: newKey(), kind: "text", text: "", category: "technik" },
            ])
          }
        >
          <PlusIcon aria-hidden /> Teil
        </Button>
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        {!insert ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Absatz streichen
          </Button>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {released ? "Als Entwurf speichern" : "Speichern"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Absatz streichen?"
        description={
          released
            ? "Der Absatz fehlt dann in der bearbeiteten Kopie; die freigegebene Fassung bleibt."
            : "Der Absatz fehlt dann im Entwurf. Notizen daran finden beim Freigeben keinen Platz mehr und werden nachgefragt."
        }
        confirmLabel="Streichen"
        cancelLabel="Behalten"
        variant="destructive"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void remove();
        }}
      />
    </div>
  );
}
