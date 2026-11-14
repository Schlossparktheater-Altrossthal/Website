"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { GroupMemberPicker, type PickerValue } from "@/components/skript/group-member-picker";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { GroupPassageData, GroupPassageLevel } from "@/lib/skript/role-admin";
import type { ReaderBlock } from "@/lib/skript/reader";

import {
  loadGroupPassageAction,
  saveScriptGroupRulesAction,
} from "@/app/(members)/mitglieder/produktionen/actions/skript-rollen";

/**
 * „Wer spricht hier?“ an Gruppenpassagen wie „Alle“ (docs/Plan/gruppen-plan.md, Phase 3+4):
 * alle sehen, wer gemeint ist; wer das Skript verwalten darf, ändert es für den Absatz, die
 * Szene oder überall.
 */

const MAX_NAMES = 3;

export function membersSummary(ids: string[], names: ReadonlyMap<string, string>) {
  const list = ids.map((id) => names.get(id)).filter((n): n is string => !!n);
  if (!list.length) return "niemand";
  const shown = list.slice(0, MAX_NAMES).join(", ");
  return list.length > MAX_NAMES ? `${shown} +${list.length - MAX_NAMES}` : shown;
}

/** Zeile unter dem Text einer Gruppenpassage. */
export function GroupMembersLine({
  block,
  names,
  onOpen,
}: {
  block: ReaderBlock;
  names: ReadonlyMap<string, string>;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-0.5 block min-h-7 max-w-full truncate text-left text-[0.72em] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground md:col-start-2"
    >
      spricht mit: {membersSummary(block.memberRoleIds, names)}
    </button>
  );
}

const LEVEL_LABELS: Record<GroupPassageLevel, string> = {
  block: "Nur dieser Absatz",
  scene: "Ganze Szene",
  base: "Überall",
};

export function GroupPassageSheet({
  block,
  versionId,
  names,
  canManage,
  onClose,
}: {
  block: ReaderBlock | null;
  versionId: string;
  names: ReadonlyMap<string, string>;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = React.useState<GroupPassageData | null>(null);
  const [level, setLevel] = React.useState<GroupPassageLevel>("block");
  const [pending, setPending] = React.useState(false);
  const lineageId = block?.lineageId ?? null;

  React.useEffect(() => {
    // Neuer Absatz = neue Instanz (key am Aufrufer), daher kein Zurücksetzen nötig.
    if (!lineageId || !canManage) return;
    let alive = true;
    void loadGroupPassageAction(versionId, lineageId).then((result) => {
      if (!alive) return;
      if (result.ok) setData(result.data);
      else toast.error(result.error);
    });
    return () => {
      alive = false;
    };
  }, [lineageId, versionId, canManage]);

  const group = data?.groups[0] ?? null;
  const save = async (value: PickerValue) => {
    if (!data || !group || !lineageId) return;
    setPending(true);
    try {
      const fixed = group.groupMode === "fixed";
      const empty = { roleIds: [], setIds: [] };
      // Grundregel: bei fester Liste = wer dabei ist, sonst = wer grundsätzlich nicht dabei ist.
      const [include, exclude] = level === "base" && !fixed ? [empty, value] : [value, empty];
      const result = await saveScriptGroupRulesAction(data.showId, {
        groupRoleId: group.id,
        sceneKey: level === "scene" ? data.sceneKey : null,
        lineageId: level === "block" ? lineageId : null,
        include: include.roleIds,
        exclude: exclude.roleIds,
        includeSets: include.setIds,
        excludeSets: exclude.setIds,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Gespeichert");
      onClose();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const current = group?.levels[level];
  const hasOwn = (l: GroupPassageLevel) =>
    !!group && group.levels[l].roleIds.length + group.levels[l].setIds.length > 0;
  const baseHint =
    group && level === "base"
      ? group.groupMode === "fixed"
        ? "Wer gehört überall dazu (feste Liste)?"
        : group.groupMode === "cast"
          ? "Grundregel „alle Besetzten“ – hier wählst du, wer grundsätzlich nicht dabei ist."
          : "Grundregel „wer in der Szene spricht“ – hier wählst du, wer grundsätzlich nicht dabei ist."
      : level === "scene"
        ? `Gilt für alle „${group?.name ?? ""}“-Passagen in „${data?.sceneTitle ?? ""}“. Leer = wie überall.`
        : "Gilt nur für diesen Absatz. Leer = wie in der Szene.";

  return (
    <BottomSheet
      open={!!block}
      onOpenChange={(open) => (open ? null : onClose())}
      title="Wer spricht hier?"
      description={block?.speaker ?? "Gruppenpassage"}
      showDescription
    >
      {block ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Aktuell ({block.memberRoleIds.length})</p>
            <p className="text-sm text-muted-foreground">
              {block.memberRoleIds.length
                ? block.memberRoleIds.map((id) => names.get(id) ?? "?").join(", ")
                : "niemand"}
            </p>
          </div>
          {!canManage ? null : !data || !group ? (
            <p className="text-sm text-muted-foreground">Lädt …</p>
          ) : (
            <div className="space-y-3 border-t border-border pt-4">
              <SegmentedControl
                aria-label="Gilt für"
                fullWidth
                value={level}
                onValueChange={setLevel}
                options={(["block", "scene", "base"] as const).map((value) => ({
                  value,
                  label: LEVEL_LABELS[value] + (hasOwn(value) ? " •" : ""),
                }))}
              />
              <p className="text-xs text-muted-foreground">{baseHint}</p>
              {current ? (
                <GroupMemberPicker
                  key={`${group.id}:${level}`}
                  people={data.people}
                  sets={data.sets}
                  initial={current}
                  pending={pending}
                  onSave={save}
                  saveLabel="Speichern"
                />
              ) : null}
              {hasOwn(level) && level !== "base" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => save({ roleIds: [], setIds: [] })}
                >
                  Zurücksetzen
                </Button>
              ) : null}
              {data.groups.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  Mehrere Gruppen im Absatz – bearbeitet wird „{group.name}“.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </BottomSheet>
  );
}
