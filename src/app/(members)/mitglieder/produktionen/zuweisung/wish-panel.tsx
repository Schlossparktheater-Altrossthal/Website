"use client";

import * as React from "react";
import { toast } from "sonner";

import { PlusIcon, XIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WISH_LEVELS, wishLevelLabel, type WishLevel } from "@/lib/wishes/levels";
import type { WishlistArea, WishlistPerson } from "@/lib/wishes/wishlist";

import { saveWishNoteAction, setWishAction } from "../actions/wishes";

type Result = { ok: boolean; error?: string; message?: string };

/**
 * Wünsche einer Person für die Zuweisung: was sie selbst angegeben hat (nur lesen), was das
 * Team nachgetragen hat (ändern/entfernen), „Wunsch nachtragen“ und die interne Notiz.
 */
export function WishPanel({
  showId,
  person,
  areas,
  canEdit,
  onSaved,
}: {
  showId: string;
  person: WishlistPerson;
  areas: WishlistArea[];
  canEdit: (area: WishlistArea) => boolean;
  onSaved: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState(person.note?.text ?? "");
  const [adding, setAdding] = React.useState(false);
  const [newArea, setNewArea] = React.useState<string>("");
  const areaByCode = new Map(areas.map((area) => [area.code, area]));
  const addable = areas.filter(
    (area) => canEdit(area) && !person.wishes.some((wish) => wish.areaCode === area.code),
  );
  const anyEditable = areas.some(canEdit);

  const run = async (action: () => Promise<Result>) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast.error("Speichern fehlgeschlagen", { description: result.error });
      return false;
    }
    toast.success(result.message ?? "Gespeichert");
    onSaved();
    return true;
  };

  const setLevel = (code: string, level: WishLevel | null) =>
    run(() =>
      setWishAction({
        showId,
        userId: person.id,
        code,
        weight: level ? (WISH_LEVELS.find((entry) => entry.level === level)?.weight ?? 40) : null,
      }),
    );

  return (
    <section className="space-y-3 border-t border-border/60 pt-4" aria-label="Wünsche">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wünsche</h3>
      {person.wishes.length ? (
        <ul className="space-y-1.5">
          {person.wishes.map((wish) => {
            const area = areaByCode.get(wish.areaCode);
            if (!area) return null;
            const editable = Boolean(wish.enteredBy) && canEdit(area);
            return (
              <li key={wish.areaCode} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{area.title}</span>
                  <span className="shrink-0 text-xs font-medium">{wishLevelLabel(wish.level)}</span>
                  {editable ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      disabled={busy}
                      aria-label={`Wunsch ${area.title} entfernen`}
                      onClick={() => void setLevel(area.code, null)}
                    >
                      <XIcon />
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {wish.enteredBy ? `Nachgetragen von ${wish.enteredBy}` : "Selbst angegeben"}
                  {wish.assigned ? " · zugeteilt" : ""}
                </p>
                {editable ? (
                  <LevelButtons
                    value={wish.level}
                    disabled={busy}
                    onPick={(level) => void setLevel(area.code, level)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {person.onboardingDone ? "Keine Wünsche angegeben." : "Onboarding noch offen."}
        </p>
      )}

      {addable.length ? (
        adding ? (
          <div className="space-y-2 rounded-md bg-muted p-3">
            <Select value={newArea} onValueChange={setNewArea}>
              <SelectTrigger aria-label="Bereich">
                <SelectValue placeholder="Bereich wählen" />
              </SelectTrigger>
              <SelectContent>
                {addable.map((area) => (
                  <SelectItem key={area.code} value={area.code}>
                    {area.domain === "acting" ? `Schauspiel: ${area.title}` : area.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <LevelButtons
              value={null}
              disabled={busy || !newArea}
              onPick={async (level) => {
                if (await setLevel(newArea, level)) {
                  setAdding(false);
                  setNewArea("");
                }
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Abbrechen
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            onClick={() => setAdding(true)}
          >
            <PlusIcon className="h-4 w-4" aria-hidden />
            Wunsch nachtragen
          </Button>
        )
      ) : null}

      {anyEditable ? (
        <div className="space-y-2">
          <label
            htmlFor={`wish-note-${person.id}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Interne Notiz (für {person.name} nicht sichtbar)
          </label>
          <Textarea
            id={`wish-note-${person.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="z. B. im Gespräch: lieber eine kleinere Rolle"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {person.note?.by ? `Zuletzt von ${person.note.by}` : ""}
            </span>
            <AsyncButton
              type="button"
              size="sm"
              variant="outline"
              isLoading={busy}
              disabled={note.trim() === (person.note?.text ?? "")}
              onClick={() =>
                void run(() => saveWishNoteAction({ showId, userId: person.id, text: note }))
              }
            >
              Notiz speichern
            </AsyncButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LevelButtons({
  value,
  disabled,
  onPick,
}: {
  value: WishLevel | null;
  disabled: boolean;
  onPick: (level: WishLevel) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Stufe">
      {[...WISH_LEVELS].reverse().map((entry) => (
        <Button
          key={entry.level}
          type="button"
          size="xs"
          variant={value === entry.level ? "primary" : "outline"}
          aria-pressed={value === entry.level}
          disabled={disabled}
          onClick={() => onPick(entry.level)}
        >
          {entry.label}
        </Button>
      ))}
    </div>
  );
}
