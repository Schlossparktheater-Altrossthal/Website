"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CharacterMergePreview } from "@/lib/produktionen/character-merge";
import type { RsRole } from "@/lib/produktionen/roles-scenes";

import { mergeCharactersAction, previewCharacterMergeAction } from "../actions/character-merge";
import { inputClass, PanelSection, useRun } from "./ui";

const PREVIEW_LABELS: [keyof CharacterMergePreview, string, string][] = [
  ["castings", "Besetzung", "Besetzungen"],
  ["scenes", "Auftritt", "Auftritte"],
  ["objects", "Requisite", "Requisiten"],
  ["requirements", "Anforderung", "Anforderungen"],
  ["wishes", "Regie-Wunsch", "Regie-Wünsche"],
  ["tasks", "Aufgabe", "Aufgaben"],
  ["scriptRoles", "Skript-Rolle", "Skript-Rollen"],
];

function describe(preview: CharacterMergePreview) {
  const parts = PREVIEW_LABELS.filter(([key]) => preview[key] > 0).map(
    ([key, one, many]) => `${preview[key]} ${preview[key] === 1 ? one : many}`,
  );
  return parts.length ? parts.join(", ") : "nichts außer dem Namen";
}

/** Rolle in einer anderen aufgehen lassen (docs/Plan/skript-uebernahme-plan.md, Phase 6). */
export function RoleMergeSection({
  role,
  roles,
  onMerged,
}: {
  role: RsRole;
  roles: RsRole[];
  onMerged: () => void;
}) {
  const run = useRun();
  const [targetId, setTargetId] = React.useState("");
  const [preview, setPreview] = React.useState<CharacterMergePreview | null>(null);
  const target = roles.find((r) => r.id === targetId);

  const ask = async () => {
    if (!target) return;
    const result = await previewCharacterMergeAction(role.id, target.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if ("preview" in result) setPreview(result.preview);
  };

  return (
    <PanelSection title="Zusammenführen">
      <p className="text-xs text-muted-foreground">
        Doppelt angelegt oder vom Autor zusammengelegt? „{role.name}“ geht in der gewählten Rolle
        auf und wird danach gelöscht.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={`${inputClass} min-w-0 flex-1`}
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          aria-label="Zielrolle"
        >
          <option value="">Rolle wählen …</option>
          {roles
            .filter((r) => r.id !== role.id)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
        <Button variant="outline" disabled={!target} onClick={ask}>
          Zusammenführen
        </Button>
      </div>
      <ConfirmDialog
        open={!!preview}
        onOpenChange={(open) => (open ? null : setPreview(null))}
        title={`„${role.name}“ in „${target?.name ?? ""}“ zusammenführen?`}
        description={`Wandert mit: ${preview ? describe(preview) : ""}. Das lässt sich nicht zurücknehmen.`}
        confirmLabel="Zusammenführen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setPreview(null)}
        onConfirm={async () => {
          setPreview(null);
          if (target && (await run(() => mergeCharactersAction(role.id, target.id)))) onMerged();
        }}
      />
    </PanelSection>
  );
}
