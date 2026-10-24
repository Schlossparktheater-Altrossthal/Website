"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ArrowLeftIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ProductionActionResult } from "@/lib/produktionen/actions-helpers";
import type { AdminRole, ScriptRoleAdminData } from "@/lib/skript/role-admin";
import type { GroupMode, RoleKind } from "@/lib/skript/role-links";

import {
  mergeScriptRolesAction,
  saveScriptGroupRulesAction,
  saveScriptRoleAction,
  undoScriptRoleMergeAction,
} from "../../actions/skript-rollen";
import { inputClass } from "../ui";
import { formatDateTime } from "./format";

const BASE = "/mitglieder/produktionen/stueck?ansicht=skript";

const KIND_LABELS: Record<RoleKind, string> = {
  person: "Person",
  group: "Gruppe",
  ignore: "Ignorieren",
};

const GROUP_MODE_LABELS: Record<GroupMode, string> = {
  cast: "Alle Besetzten",
  present: "Wer in der Szene ist",
  fixed: "Feste Liste",
};

function useAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const run = React.useCallback(
    async (task: () => Promise<ProductionActionResult>, onDone?: () => void) => {
      setPending(true);
      try {
        const result = await task();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.message) toast.success(result.message);
        onDone?.();
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [router],
  );
  return [pending, run] as const;
}

/** Reiter „Rollen“: Skript-Rollen pflegen (docs/Plan/skript-uebernahme-plan.md). */
export function ScriptRoles({ data }: { data: ScriptRoleAdminData }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [groupId, setGroupId] = React.useState<string | null>(null);
  const [pending, run] = useAction();
  const characters = new Map(data.characters.map((c) => [c.id, c]));
  const roleNames = new Map(data.roles.map((r) => [r.id, r.name]));
  const open = data.roles.find((r) => r.id === openId) ?? null;
  const group = data.roles.find((r) => r.id === groupId) ?? null;

  const sections: { kind: RoleKind; title: string }[] = [
    { kind: "person", title: "Personen" },
    { kind: "group", title: "Gruppen" },
    { kind: "ignore", title: "Ignoriert" },
  ];

  const describe = (role: AdminRole) => {
    const parts: string[] = [];
    if (role.current) parts.push(`${role.lines} Repliken · ${role.scenes} Szenen`);
    else parts.push("in der aktuellen Fassung nicht");
    if (role.kind === "group") parts.push(GROUP_MODE_LABELS[role.groupMode ?? "present"]);
    if (role.kind !== "ignore") {
      const names = role.characterIds.map((id) => characters.get(id)?.name).filter(Boolean);
      parts.push(
        names.length
          ? `Stück: ${names.join(", ")}${role.linked ? "" : " (per Name)"}`
          : role.linked
            ? "bewusst ohne Stück-Rolle"
            : "nicht im Stück",
      );
    }
    return parts.join(" · ");
  };

  return (
    <div className="space-y-4">
      <Link
        href={BASE}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden /> Alle Fassungen
      </Link>
      <div className="rounded-lg border border-border bg-muted p-4 text-sm">
        <p className="font-medium">Rollen im Skript</p>
        <p className="text-muted-foreground">
          Gilt für alle Fassungen{data.version ? ` (Zahlen aus „${data.version.label}“)` : ""}. Hier
          legst du fest, zu welcher Rolle im Stück eine Skript-Rolle gehört, führst Schreibweisen
          oder Rollen zusammen und bestimmst, wer bei Gruppen wie „Alle“ mitspricht. Der Text der
          Fassungen bleibt unverändert.
        </p>
      </div>

      {sections.map(({ kind, title }) => {
        const roles = data.roles
          .filter((r) => r.kind === kind)
          .sort((a, b) => Number(b.current) - Number(a.current) || b.words - a.words);
        if (!roles.length) return null;
        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle>
                {title} <span className="text-muted-foreground">({roles.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ListRowGroup>
                {roles.map((role) => (
                  <ListRow
                    key={role.id}
                    onClick={() => setOpenId(role.id)}
                    title={
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{role.name}</span>
                        {role.kind === "person" && !role.characterIds.length ? (
                          <Badge variant="warning" size="sm">
                            offen
                          </Badge>
                        ) : null}
                      </span>
                    }
                    description={describe(role)}
                  />
                ))}
              </ListRowGroup>
            </CardContent>
          </Card>
        );
      })}

      {data.merges.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Zusammengeführt</CardTitle>
          </CardHeader>
          <CardContent>
            <ListRowGroup>
              {data.merges.map((merge) => (
                <ListRow
                  key={merge.id}
                  title={`${merge.sourceName} → ${roleNames.get(merge.targetRoleId) ?? "?"}`}
                  description={`${formatDateTime(merge.createdAt)}${merge.createdByName ? ` · ${merge.createdByName}` : ""}`}
                  trailing={
                    <AsyncButton
                      size="sm"
                      variant="ghost"
                      isLoading={pending}
                      onClick={() => run(() => undoScriptRoleMergeAction(data.showId, merge.id))}
                    >
                      Rückgängig
                    </AsyncButton>
                  }
                />
              ))}
            </ListRowGroup>
          </CardContent>
        </Card>
      ) : null}

      {open ? (
        <RoleDialog
          key={open.id}
          data={data}
          role={open}
          onClose={() => setOpenId(null)}
          onEditGroup={() => {
            setOpenId(null);
            setGroupId(open.id);
          }}
        />
      ) : null}
      {group ? (
        <GroupDialog key={group.id} data={data} group={group} onClose={() => setGroupId(null)} />
      ) : null}
    </div>
  );
}

function RoleDialog({
  data,
  role,
  onClose,
  onEditGroup,
}: {
  data: ScriptRoleAdminData;
  role: AdminRole;
  onClose: () => void;
  onEditGroup: () => void;
}) {
  const [name, setName] = React.useState(role.name);
  const [kind, setKind] = React.useState<RoleKind>(role.kind);
  const [groupMode, setGroupMode] = React.useState<GroupMode>(role.groupMode ?? "present");
  const [linked, setLinked] = React.useState(role.linked);
  const [characterIds, setCharacterIds] = React.useState<string[]>(role.characterIds);
  const [mergeTarget, setMergeTarget] = React.useState("");
  const [confirmMerge, setConfirmMerge] = React.useState(false);
  const [pending, run] = useAction();
  const others = data.roles.filter((r) => r.id !== role.id);
  const target = others.find((r) => r.id === mergeTarget);

  const save = () =>
    run(
      () =>
        saveScriptRoleAction(data.showId, role.id, {
          name,
          kind,
          groupMode: kind === "group" ? groupMode : null,
          characterIds: linked ? characterIds : null,
        }),
      onClose,
    );

  return (
    <ModalFormDialog
      open
      onOpenChange={(next) => (next ? null : onClose())}
      title={role.name}
      description={role.aliases.length ? `Schreibweisen: ${role.aliases.join(", ")}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <AsyncButton isLoading={pending} onClick={save}>
            Speichern
          </AsyncButton>
        </>
      }
    >
      <div className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          <span className="block text-xs text-muted-foreground">
            Der alte Name bleibt als Schreibweise, neue Fassungen erkennen ihn wieder.
          </span>
        </label>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Art</span>
          <SegmentedControl
            aria-label="Art"
            fullWidth
            value={kind}
            onValueChange={setKind}
            options={(["person", "group", "ignore"] as const).map((value) => ({
              value,
              label: KIND_LABELS[value],
            }))}
          />
          {kind === "ignore" ? (
            <p className="text-xs text-muted-foreground">
              Gehört niemandem (z. B. „Stimme aus dem Off“, Band, falsch erkannt).
            </p>
          ) : null}
        </div>

        {kind === "group" ? (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Wer gehört dazu?</span>
            <SegmentedControl
              aria-label="Wer gehört dazu"
              fullWidth
              value={groupMode}
              onValueChange={setGroupMode}
              options={(["cast", "present", "fixed"] as const).map((value) => ({
                value,
                label: GROUP_MODE_LABELS[value],
              }))}
            />
            <p className="text-xs text-muted-foreground">
              Ausnahmen je Szene oder Absatz unter „Gruppe bearbeiten“.
            </p>
            {role.kind === "group" ? (
              <Button variant="outline" size="sm" onClick={onEditGroup}>
                Gruppe bearbeiten
              </Button>
            ) : null}
          </div>
        ) : null}

        {kind !== "ignore" ? (
          <div className="space-y-2">
            <span className="text-sm font-medium">Rolle im Stück</span>
            <SegmentedControl
              aria-label="Rolle im Stück"
              value={linked ? "linked" : "name"}
              onValueChange={(value) => setLinked(value === "linked")}
              options={[
                { value: "name", label: "Per Name" },
                { value: "linked", label: "Festlegen" },
              ]}
            />
            {linked ? (
              data.characters.length ? (
                <ul className="space-y-1">
                  {data.characters.map((character) => (
                    <li key={character.id}>
                      <label className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted/50">
                        <Checkbox
                          checked={characterIds.includes(character.id)}
                          onCheckedChange={(checked) =>
                            setCharacterIds((ids) =>
                              checked
                                ? [...ids, character.id]
                                : ids.filter((id) => id !== character.id),
                            )
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm">{character.name}</span>
                          {character.castNames.length ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {character.castNames.join(", ")}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Das Stück hat noch keine Rollen.</p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                Stück-Rollen mit gleichem Namen oder gleicher Schreibweise gelten automatisch.
              </p>
            )}
          </div>
        ) : null}

        <div className="space-y-2 border-t border-border pt-4">
          <span className="text-sm font-medium">Zusammenführen</span>
          <p className="text-xs text-muted-foreground">
            „{role.name}“ geht in der gewählten Rolle auf – in allen Fassungen, mit Lernstand. Lässt
            sich zurücknehmen.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${inputClass} min-w-0 flex-1`}
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              aria-label="Zielrolle"
            >
              <option value="">Rolle wählen …</option>
              {others.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
            <Button variant="outline" disabled={!target} onClick={() => setConfirmMerge(true)}>
              Zusammenführen
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmMerge}
        onOpenChange={setConfirmMerge}
        title={`„${role.name}“ in „${target?.name ?? ""}“ zusammenführen?`}
        description="Repliken, Schreibweisen, Lernstand und Zuordnungen wandern mit."
        confirmLabel="Zusammenführen"
        cancelLabel="Abbrechen"
        variant="default"
        onCancel={() => setConfirmMerge(false)}
        onConfirm={() =>
          target && run(() => mergeScriptRolesAction(data.showId, role.id, target.id), onClose)
        }
      />
    </ModalFormDialog>
  );
}

type Level = { sceneKey: string | null; lineageId: string | null };

function GroupDialog({
  data,
  group,
  onClose,
}: {
  data: ScriptRoleAdminData;
  group: AdminRole;
  onClose: () => void;
}) {
  const [pending, run] = useAction();
  const [openScene, setOpenScene] = React.useState<string | null>(null);
  const people = data.roles.filter((r) => r.kind === "person");
  const names = new Map(data.roles.map((r) => [r.id, r.name]));
  const rules = data.rules.filter((r) => r.groupRoleId === group.id);
  const blocks = data.groupBlocks.filter((b) => b.roleIds.includes(group.id));
  const scenes = data.scenes.filter((s) => blocks.some((b) => b.sceneKey === s.sceneKey));
  const mode = group.groupMode ?? "present";

  const rulesAt = (level: Level) =>
    rules.filter((r) => r.sceneKey === level.sceneKey && r.lineageId === level.lineageId);
  const save = (level: Level, include: string[], exclude: string[]) =>
    run(() =>
      saveScriptGroupRulesAction(data.showId, {
        groupRoleId: group.id,
        ...level,
        include,
        exclude,
      }),
    );

  const base = rulesAt({ sceneKey: null, lineageId: null });
  const membersText = (ids: string[]) =>
    ids.length ? ids.map((id) => names.get(id) ?? "?").join(", ") : "niemand";

  return (
    <ModalFormDialog
      open
      onOpenChange={(next) => (next ? null : onClose())}
      title={`Gruppe „${group.name}“`}
      description={`Grundregel: ${GROUP_MODE_LABELS[mode]}`}
      footer={
        <Button variant="outline" onClick={onClose}>
          Fertig
        </Button>
      }
    >
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">
            {mode === "fixed" ? "Wer gehört dazu?" : "Grundsätzlich nicht dabei"}
          </h3>
          <MemberPicker
            people={people}
            initial={base
              .filter((r) => r.mode === (mode === "fixed" ? "include" : "exclude"))
              .map((r) => r.memberRoleId)}
            pending={pending}
            onSave={(ids) =>
              mode === "fixed"
                ? save({ sceneKey: null, lineageId: null }, ids, [])
                : save({ sceneKey: null, lineageId: null }, [], ids)
            }
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Je Szene und Absatz</h3>
          {scenes.length ? (
            <ListRowGroup variant="inset">
              {scenes.map((scene) => {
                const sceneLevel = { sceneKey: scene.sceneKey, lineageId: null };
                const sceneRules = rulesAt(sceneLevel);
                const sceneBlocks = blocks.filter((b) => b.sceneKey === scene.sceneKey);
                const custom =
                  sceneRules.length +
                  sceneBlocks.filter(
                    (b) => rulesAt({ sceneKey: null, lineageId: b.lineageId }).length,
                  ).length;
                const isOpen = openScene === scene.sceneKey;
                return (
                  <div key={scene.sceneKey}>
                    <ListRow
                      onClick={() => setOpenScene(isOpen ? null : scene.sceneKey)}
                      chevron={false}
                      title={scene.title}
                      description={`${sceneBlocks.length} Repliken · ${membersText(sceneBlocks[0]?.memberRoleIds ?? [])}`}
                      trailing={custom ? <Badge size="sm">angepasst</Badge> : null}
                    />
                    {isOpen ? (
                      <div className="space-y-4 bg-muted px-3 py-3">
                        <LevelEditor
                          label="Ganze Szene"
                          people={people}
                          rules={sceneRules}
                          pending={pending}
                          onSave={(include) => save(sceneLevel, include, [])}
                        />
                        {sceneBlocks.map((block) => {
                          const level = { sceneKey: null, lineageId: block.lineageId };
                          return (
                            <div
                              key={block.lineageId}
                              className="space-y-1 border-t border-border pt-3"
                            >
                              <p className="text-sm">
                                <span className="font-medium">{block.speaker}:</span> {block.text}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Spricht mit: {membersText(block.memberRoleIds)}
                              </p>
                              <LevelEditor
                                label="Nur dieser Absatz"
                                people={people}
                                rules={rulesAt(level)}
                                pending={pending}
                                onSave={(include) => save(level, include, [])}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </ListRowGroup>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Die Gruppe kommt in der aktuellen Fassung nicht vor.
            </p>
          )}
        </section>
      </div>
    </ModalFormDialog>
  );
}

/** Ebene „Szene“ oder „Absatz“: wie darüber oder eigene Auswahl. */
function LevelEditor({
  label,
  people,
  rules,
  pending,
  onSave,
}: {
  label: string;
  people: AdminRole[];
  rules: ScriptRoleAdminData["rules"];
  pending: boolean;
  onSave: (include: string[]) => void;
}) {
  const included = rules.filter((r) => r.mode === "include").map((r) => r.memberRoleId);
  const [custom, setCustom] = React.useState(included.length > 0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium">{label}:</span>
        <SegmentedControl
          aria-label={label}
          value={custom ? "custom" : "default"}
          onValueChange={(value) => {
            const next = value === "custom";
            setCustom(next);
            if (!next && included.length) onSave([]);
          }}
          options={[
            { value: "default", label: "Wie darüber" },
            { value: "custom", label: "Nur …" },
          ]}
        />
      </div>
      {custom ? (
        <MemberPicker people={people} initial={included} pending={pending} onSave={onSave} />
      ) : null}
    </div>
  );
}

function MemberPicker({
  people,
  initial,
  pending,
  onSave,
}: {
  people: AdminRole[];
  initial: string[];
  pending: boolean;
  onSave: (ids: string[]) => void;
}) {
  const [ids, setIds] = React.useState(initial);
  const dirty = ids.length !== initial.length || ids.some((id) => !initial.includes(id));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {people.map((person) => {
          const active = ids.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setIds((current) =>
                  active ? current.filter((id) => id !== person.id) : [...current, person.id],
                )
              }
              className={
                active
                  ? "min-h-9 rounded-full border border-primary bg-primary/15 px-3 text-sm text-primary"
                  : "min-h-9 rounded-full border border-border bg-background px-3 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {person.name}
            </button>
          );
        })}
      </div>
      {dirty ? (
        <AsyncButton size="sm" isLoading={pending} onClick={() => onSave(ids)}>
          Übernehmen
        </AsyncButton>
      ) : null}
    </div>
  );
}
