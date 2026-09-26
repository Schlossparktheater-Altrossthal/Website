"use client";

import * as React from "react";
import Link from "next/link";
import type { BreakdownStatus, CharacterCastingType } from "@prisma/client";
import { toast } from "sonner";

import {
  ChevronRightIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  XIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ROLE_COLOR_OPTIONS } from "@/config/category-colors";
import type {
  RolesScenesData,
  RsBreakdownItem,
  RsRole,
  RsScene,
} from "@/lib/produktionen/roles-scenes";
import { ROLE_SIZE_OPTIONS } from "@/lib/produktionen/role-sizes";
import { cn } from "@/lib/utils";

import { setCharacterCastingAction } from "../actions/assignments";
import {
  deleteBreakdownItemAction,
  deleteRoleAction,
  deleteSceneAction,
  saveBreakdownItemAction,
  saveRoleAction,
  saveSceneAction,
  setRoleScenesAction,
} from "../actions/roles-scenes";
import {
  BREAKDOWN_STATUSES,
  CAST_LABELS,
  Field,
  inputClass,
  PanelSection,
  sceneLabel,
  STATUS_LABELS,
  STATUS_TONE,
  ToggleChip,
  useRun,
} from "./ui";

export function RolePanel({
  open,
  role,
  data,
  onClose,
  onCreated,
}: {
  open: boolean;
  role: RsRole | null;
  data: RolesScenesData;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const run = useRun();
  const [name, setName] = React.useState(role?.name ?? "");
  const [description, setDescription] = React.useState(role?.description ?? "");
  const [color, setColor] = React.useState<string | null>(role?.color ?? ROLE_COLOR_OPTIONS[0]);
  const [size, setSize] = React.useState<string | null>(role?.size ?? null);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [adding, setAdding] = React.useState<CharacterCastingType | null>(null);
  const [personQuery, setPersonQuery] = React.useState("");

  const save = async () => {
    setSaving(true);
    const result = await saveRoleAction({
      showId: data.showId,
      id: role?.id,
      name,
      description,
      color,
      size,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    toast.success(role ? "Gespeichert" : "Rolle angelegt", { duration: 3000 });
    if (!role && "id" in result && result.id) onCreated(result.id);
  };

  const setCast = (userId: string, type: CharacterCastingType | null) =>
    role && run(() => setCharacterCastingAction({ characterId: role.id, userId, type }));

  const toggleScene = (sceneId: string) => {
    if (!role) return;
    const next = role.sceneIds.includes(sceneId)
      ? role.sceneIds.filter((id) => id !== sceneId)
      : [...role.sceneIds, sceneId];
    void run(() => setRoleScenesAction({ characterId: role.id, sceneIds: next }));
  };

  const candidates = data.people.filter(
    (person) =>
      !role?.cast.some((entry) => entry.person.id === person.id) &&
      (!personQuery.trim() || person.name.toLowerCase().includes(personQuery.trim().toLowerCase())),
  );

  return (
    <>
      <ResponsivePanel
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={role ? role.name : "Neue Rolle"}
        description="Rolle bearbeiten"
        footer={
          <div className="flex gap-2">
            {role ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-11 w-11"
                aria-label="Rolle löschen"
                onClick={() => setConfirmDelete(true)}
              >
                <TrashIcon />
              </Button>
            ) : null}
            <AsyncButton
              type="button"
              className="h-11 flex-1"
              isLoading={saving}
              loadingText="Speichert …"
              disabled={!name.trim()}
              onClick={save}
            >
              {role ? "Speichern" : "Anlegen"}
            </AsyncButton>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <input
              className={inputClass}
              value={name}
              maxLength={120}
              autoFocus={!role}
              placeholder="z. B. Atréju"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Beschreibung">
            <textarea
              className={cn(inputClass, "h-auto min-h-20 py-2")}
              value={description}
              maxLength={500}
              placeholder="Wer ist die Figur? (sieht die Besetzung im Rollenportal)"
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Rollengröße</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Rollengröße">
              {ROLE_SIZE_OPTIONS.map((option) => (
                <ToggleChip
                  key={option.code}
                  active={size === option.code}
                  onClick={() => setSize(size === option.code ? null : option.code)}
                >
                  {option.title}
                </ToggleChip>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Farbe</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
              {ROLE_COLOR_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={color === option}
                  aria-label={option}
                  onClick={() => setColor(option)}
                  className={cn(
                    "h-9 w-9 rounded-full ring-offset-2 ring-offset-background",
                    color === option ? "ring-2 ring-ring" : "",
                  )}
                  style={{ backgroundColor: option }}
                />
              ))}
            </div>
          </div>

          {role ? (
            <>
              <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                Besetzung und Szenen werden sofort gespeichert.
              </p>
              <PanelSection title="Besetzung">
                {role.cast.length ? (
                  <ul className="space-y-1.5">
                    {role.cast.map((entry) => (
                      <li key={entry.id} className="flex min-h-11 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm">{entry.person.name}</span>
                        <SegmentedControl<"primary" | "alternate">
                          aria-label={`Besetzung ${entry.person.name}`}
                          value={entry.type === "primary" ? "primary" : "alternate"}
                          onValueChange={(value) => void setCast(entry.person.id, value)}
                          options={[
                            { value: "primary", label: CAST_LABELS.primary },
                            { value: "alternate", label: CAST_LABELS.alternate },
                          ]}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          aria-label={`${entry.person.name} entfernen`}
                          onClick={() => void setCast(entry.person.id, null)}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Noch niemand besetzt.</p>
                )}
                {adding ? (
                  <div className="space-y-2 rounded-lg bg-muted p-2">
                    <input
                      className={inputClass}
                      value={personQuery}
                      autoFocus
                      placeholder="Person suchen"
                      onChange={(event) => setPersonQuery(event.target.value)}
                    />
                    <ul className="max-h-56 overflow-y-auto">
                      {candidates.slice(0, 30).map((person) => (
                        <li key={person.id}>
                          <button
                            type="button"
                            className="flex min-h-11 w-full items-center rounded-md px-2 text-left text-sm hover:bg-background"
                            onClick={async () => {
                              const ok = await setCast(person.id, adding);
                              if (ok) {
                                setAdding(null);
                                setPersonQuery("");
                              }
                            }}
                          >
                            {person.name}
                          </button>
                        </li>
                      ))}
                      {candidates.length === 0 ? (
                        <li className="px-2 py-3 text-sm text-muted-foreground">Keine Treffer.</li>
                      ) : null}
                    </ul>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 w-full"
                      onClick={() => setAdding(null)}
                    >
                      Abbrechen
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10"
                      onClick={() => setAdding("primary")}
                    >
                      <PlusIcon className="h-4 w-4" aria-hidden />
                      Hauptbesetzung
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10"
                      onClick={() => setAdding("alternate")}
                    >
                      <PlusIcon className="h-4 w-4" aria-hidden />
                      Zweitbesetzung
                    </Button>
                  </div>
                )}
              </PanelSection>

              <PanelSection title={`Szenen (${role.sceneIds.length})`}>
                {data.scenes.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.scenes.map((scene) => (
                      <ToggleChip
                        key={scene.id}
                        active={role.sceneIds.includes(scene.id)}
                        onClick={() => toggleScene(scene.id)}
                      >
                        <span className="tabular-nums">{sceneLabel(scene)}</span>
                        {scene.title ? (
                          <span className="max-w-32 truncate">{scene.title}</span>
                        ) : null}
                      </ToggleChip>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Noch keine Szenen –{" "}
                    <Link href="/mitglieder/produktionen/stueck" className="text-primary underline">
                      Szenen anlegen
                    </Link>
                  </p>
                )}
              </PanelSection>

              <Link
                href={`/mitglieder/meine-gewerke/rolle/${encodeURIComponent(role.id)}`}
                className="flex min-h-11 items-center justify-between border-t border-border/60 pt-3 text-sm font-medium text-primary"
              >
                Rollenportal öffnen
                <ChevronRightIcon className="h-4 w-4" aria-hidden />
              </Link>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Besetzung und Szenen wählst du nach dem Anlegen.
            </p>
          )}
        </div>
      </ResponsivePanel>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Rolle löschen?"
        description="Besetzung und Szenen-Zuordnungen der Rolle werden entfernt."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (role && (await run(() => deleteRoleAction({ id: role.id }), "Rolle gelöscht"))) {
            onClose();
          }
        }}
      />
    </>
  );
}

type SceneDraft = {
  act: number;
  title: string;
  location: string;
  timeOfDay: string;
  duration: string;
  summary: string;
  roles: { characterId: string; featured: boolean }[];
};

export function ScenePanel({
  open,
  scene,
  defaultAct,
  data,
  onClose,
  onCreated,
}: {
  open: boolean;
  scene: RsScene | null;
  /** Akt für eine neue Szene. */
  defaultAct: number;
  data: RolesScenesData;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const run = useRun();
  const [draft, setDraft] = React.useState<SceneDraft>(() => ({
    act: scene?.act ?? defaultAct,
    title: scene?.title ?? "",
    location: scene?.location ?? "",
    timeOfDay: scene?.timeOfDay ?? "",
    duration: scene?.durationMinutes ? String(scene.durationMinutes) : "",
    summary: scene?.summary ?? "",
    roles: scene?.roles ?? [],
  }));
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const update = <K extends keyof SceneDraft>(field: K, value: SceneDraft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const cycleRole = (characterId: string) => {
    // Tippen: dabei → Hauptszene (Stern) → nicht dabei.
    const current = draft.roles.find((entry) => entry.characterId === characterId);
    update(
      "roles",
      !current
        ? [...draft.roles, { characterId, featured: false }]
        : !current.featured
          ? draft.roles.map((entry) =>
              entry.characterId === characterId ? { ...entry, featured: true } : entry,
            )
          : draft.roles.filter((entry) => entry.characterId !== characterId),
    );
  };

  const save = async () => {
    setSaving(true);
    const duration = Number.parseInt(draft.duration, 10);
    const result = await saveSceneAction({
      showId: data.showId,
      id: scene?.id,
      act: draft.act,
      title: draft.title,
      location: draft.location,
      timeOfDay: draft.timeOfDay,
      durationMinutes: Number.isNaN(duration) ? null : duration,
      summary: draft.summary,
      roles: draft.roles,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    toast.success(scene ? "Gespeichert" : "Szene angelegt", { duration: 3000 });
    if (!scene && "id" in result && result.id) onCreated(result.id);
  };

  return (
    <>
      <ResponsivePanel
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={scene ? `Szene ${sceneLabel(scene)}` : "Neue Szene"}
        description="Szene bearbeiten"
        footer={
          <div className="flex gap-2">
            {scene ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-11 w-11"
                aria-label="Szene löschen"
                onClick={() => setConfirmDelete(true)}
              >
                <TrashIcon />
              </Button>
            ) : null}
            <AsyncButton
              type="button"
              className="h-11 flex-1"
              isLoading={saving}
              loadingText="Speichert …"
              disabled={saving}
              onClick={save}
            >
              {scene ? "Speichern" : "Anlegen"}
            </AsyncButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-[6.5rem_1fr] gap-2">
            <Field label="Akt">
              <select
                className={cn(inputClass, "px-2")}
                value={draft.act}
                onChange={(event) => update("act", Number(event.target.value))}
              >
                {[...data.acts, { number: (data.acts.at(-1)?.number ?? 0) + 1, title: null }].map(
                  (act, index) => (
                    <option key={act.number} value={act.number}>
                      {index === data.acts.length ? `Neuer Akt ${act.number}` : `Akt ${act.number}`}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Titel">
              <input
                className={inputClass}
                value={draft.title}
                maxLength={160}
                autoFocus={!scene}
                placeholder="z. B. Der Buchladen"
                onChange={(event) => update("title", event.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_1fr_5rem] gap-2">
            <Field label="Ort">
              <input
                className={inputClass}
                value={draft.location}
                maxLength={120}
                onChange={(event) => update("location", event.target.value)}
              />
            </Field>
            <Field label="Tageszeit">
              <input
                className={inputClass}
                value={draft.timeOfDay}
                maxLength={60}
                placeholder="Nacht"
                onChange={(event) => update("timeOfDay", event.target.value)}
              />
            </Field>
            <Field label="Min.">
              <input
                className={inputClass}
                value={draft.duration}
                inputMode="numeric"
                onChange={(event) => update("duration", event.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>
          <Field label="Inhalt">
            <textarea
              className={cn(inputClass, "h-auto min-h-16 py-2")}
              value={draft.summary}
              maxLength={600}
              placeholder="Was passiert in der Szene?"
              onChange={(event) => update("summary", event.target.value)}
            />
          </Field>

          <PanelSection title={`Rollen (${draft.roles.length})`}>
            <p className="text-xs text-muted-foreground">
              Tippen: dabei → Hauptszene (Stern) → entfernen.
            </p>
            {data.roles.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.roles.map((role) => {
                  const entry = draft.roles.find((item) => item.characterId === role.id);
                  return (
                    <ToggleChip
                      key={role.id}
                      active={Boolean(entry)}
                      color={role.color}
                      onClick={() => cycleRole(role.id)}
                    >
                      {entry?.featured ? (
                        <StarIcon className="h-3.5 w-3.5" aria-label="Hauptszene" />
                      ) : null}
                      {role.name}
                    </ToggleChip>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Rollen –{" "}
                <Link
                  href="/mitglieder/produktionen/stueck?ansicht=rollen"
                  className="text-primary underline"
                >
                  Rollen anlegen
                </Link>
              </p>
            )}
          </PanelSection>

          {scene ? (
            <PanelSection title={`Ausstattung (${scene.breakdown.length})`}>
              <BreakdownEditor scene={scene} data={data} run={run} />
            </PanelSection>
          ) : (
            <p className="text-xs text-muted-foreground">Ausstattung planst du nach dem Anlegen.</p>
          )}
        </div>
      </ResponsivePanel>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Szene löschen?"
        description="Rollen-Zuordnungen und Ausstattung der Szene werden entfernt."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (scene && (await run(() => deleteSceneAction({ id: scene.id }), "Szene gelöscht"))) {
            onClose();
          }
        }}
      />
    </>
  );
}

function BreakdownEditor({
  scene,
  data,
  run,
}: {
  scene: RsScene;
  data: RolesScenesData;
  run: ReturnType<typeof useRun>;
}) {
  const [title, setTitle] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState(data.departments[0]?.id ?? "");
  const [adding, setAdding] = React.useState(false);
  const department = (id: string) => data.departments.find((entry) => entry.id === id);

  const setStatus = (item: RsBreakdownItem, status: BreakdownStatus) =>
    run(() =>
      saveBreakdownItemAction({
        sceneId: scene.id,
        id: item.id,
        departmentId: item.departmentId,
        title: item.title,
        status,
        note: item.note,
      }),
    );

  return (
    <div className="space-y-2">
      {scene.breakdown.length ? (
        <ul className="divide-y divide-border/60 rounded-lg bg-muted">
          {scene.breakdown.map((item) => (
            <li key={item.id} className="flex min-h-12 items-center gap-2 px-2 py-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    department(item.departmentId)?.color ?? "var(--muted-foreground)",
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {department(item.departmentId)?.name ?? "Gewerk"}
                </span>
              </span>
              <select
                aria-label={`Status ${item.title}`}
                value={item.status}
                onChange={(event) => {
                  const status = BREAKDOWN_STATUSES.find((entry) => entry === event.target.value);
                  if (status) void setStatus(item, status);
                }}
                className={cn(
                  "h-9 shrink-0 rounded-full border-0 px-2 text-xs font-medium",
                  STATUS_TONE[item.status],
                )}
              >
                {BREAKDOWN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                aria-label={`${item.title} löschen`}
                onClick={() => void run(() => deleteBreakdownItemAction({ id: item.id }))}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {data.departments.length ? (
        <div className="grid grid-cols-[minmax(0,8rem)_1fr_auto] gap-2">
          <select
            aria-label="Gewerk"
            className={cn(inputClass, "px-2")}
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            {data.departments.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            value={title}
            maxLength={160}
            placeholder="Was wird gebraucht?"
            onChange={(event) => setTitle(event.target.value)}
          />
          <AsyncButton
            type="button"
            size="icon"
            className="h-11 w-11"
            aria-label="Ausstattung hinzufügen"
            isLoading={adding}
            disabled={!title.trim() || !departmentId}
            onClick={async () => {
              setAdding(true);
              const ok = await run(() =>
                saveBreakdownItemAction({
                  sceneId: scene.id,
                  departmentId,
                  title,
                  status: "planned",
                }),
              );
              setAdding(false);
              if (ok) setTitle("");
            }}
          >
            <PlusIcon className="h-4 w-4" />
          </AsyncButton>
        </div>
      ) : null}
    </div>
  );
}
