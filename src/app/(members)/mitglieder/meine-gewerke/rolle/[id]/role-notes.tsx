"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EditIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";

import { updateRoleNotesAction } from "../../role-actions";

export function RoleNotes({
  characterId,
  notes,
  canEdit,
}: {
  characterId: string;
  notes: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(notes ?? "");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const result = await updateRoleNotesAction({ characterId, notes: value });
    setSaving(false);
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    toast.success("Notizen gespeichert", { duration: 3000 });
    setEditing(false);
    router.refresh();
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          className="min-h-32 w-full rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
          value={value}
          maxLength={4000}
          autoFocus
          placeholder="z. B. Textstellen, Regieanweisungen, Gänge, Requisiten zum Mitnehmen"
          onChange={(event) => setValue(event.target.value)}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 sm:flex-none"
            onClick={() => {
              setValue(notes ?? "");
              setEditing(false);
            }}
          >
            Abbrechen
          </Button>
          <AsyncButton
            type="button"
            className="h-11 flex-1 sm:flex-none"
            isLoading={saving}
            loadingText="Speichert …"
            onClick={save}
          >
            Speichern
          </AsyncButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notes ? (
        <p className="whitespace-pre-line text-sm">{notes}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Notizen zur Rolle.</p>
      )}
      {canEdit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10"
          onClick={() => setEditing(true)}
        >
          <EditIcon className="h-4 w-4" aria-hidden />
          {notes ? "Bearbeiten" : "Notiz schreiben"}
        </Button>
      ) : null}
    </div>
  );
}
