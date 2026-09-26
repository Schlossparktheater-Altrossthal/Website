"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { BreakdownStatus, CharacterCastingType } from "@prisma/client";
import { toast } from "sonner";

import {
  ChevronRightIcon,
  MapPinIcon,
  PlusIcon,
  SearchIcon,
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

type Result = { ok: boolean; error?: string };

const CAST_LABELS: Record<CharacterCastingType, string> = {
  primary: "Haupt",
  alternate: "Zweit",
  cover: "Cover",
  cameo: "Cameo",
};

const STATUS_LABELS: Record<BreakdownStatus, string> = {
  planned: "Geplant",
  in_progress: "In Arbeit",
  blocked: "Blockiert",
  ready: "Bereit",
  done: "Erledigt",
};

const BREAKDOWN_STATUSES: BreakdownStatus[] = [
  "planned",
  "in_progress",
  "blocked",
  "ready",
  "done",
];

const STATUS_TONE: Record<BreakdownStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-info/15 text-info",
  blocked: "bg-destructive/10 text-destructive",
  ready: "bg-success/15 text-success",
  done: "bg-success/15 text-success",
};

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

function sceneLabel(scene: Pick<RsScene, "identifier">) {
  return scene.identifier ?? "–";
}

function useRun() {
  const router = useRouter();
  return async (action: () => Promise<Result>, success?: string) => {
    const result = await action();
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return false;
    }
    if (success) toast.success(success, { duration: 3000 });
    router.refresh();
    return true;
  };
}

export function RolesScenesClient({
  data,
  view,
}: {
  data: RolesScenesData;
  view: "rollen" | "szenen";
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [onlyOpen, setOnlyOpen] = React.useState(false);
  const openId = searchParams.get(view === "rollen" ? "rolle" : "szene");
  const [creating, setCreating] = React.useState(false);

  // Panel-Zustand in der URL (`?rolle=` / `?szene=`), damit Links aus Portal und Zuweisung direkt öffnen.
  const basePath =
    view === "rollen" ? "/mitglieder/produktionen/besetzung" : "/mitglieder/produktionen/szenen";
  const open = (id: string | null) => {
    const key = view === "rollen" ? "rolle" : "szene";
    router.replace(id ? `${basePath}?${key}=${encodeURIComponent(id)}` : basePath, {
      scroll: false,
    });
  };

  const needle = query.trim().toLowerCase();
  const roles = data.roles.filter(
    (role) =>
      (!onlyOpen || !role.cast.some((entry) => entry.type === "primary")) &&
      (!needle ||
        role.name.toLowerCase().includes(needle) ||
        role.cast.some((entry) => entry.person.name.toLowerCase().includes(needle))),
  );
  const scenes = data.scenes.filter(
    (scene) =>
      (!onlyOpen || scene.roles.length === 0) &&
      (!needle ||
        [scene.identifier, scene.title, scene.location].some((value) =>
          value?.toLowerCase().includes(needle),
        )),
  );
  const unassignedRoles = data.roles.filter(
    (role) => !role.cast.some((entry) => entry.type === "primary"),
  ).length;
  const emptyScenes = data.scenes.filter((scene) => scene.roles.length === 0).length;

  const openRole =
    view === "rollen" ? (data.roles.find((role) => role.id === openId) ?? null) : null;
  const openScene =
    view === "szenen" ? (data.scenes.find((scene) => scene.id === openId) ?? null) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Suchen</span>
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            className={cn(inputClass, "pl-9")}
            value={query}
            placeholder={view === "rollen" ? "Rolle oder Person suchen" : "Szene oder Ort suchen"}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Button type="button" className="h-11 shrink-0" onClick={() => setCreating(true)}>
          <PlusIcon className="h-4 w-4" aria-hidden />
          {view === "rollen" ? "Rolle" : "Szene"}
        </Button>
      </div>

      <SegmentedControl<"all" | "open">
        aria-label="Filter"
        size="md"
        fullWidth
        className="sm:max-w-sm"
        value={onlyOpen ? "open" : "all"}
        onValueChange={(value) => setOnlyOpen(value === "open")}
        options={[
          {
            value: "all",
            label: `Alle ${view === "rollen" ? data.roles.length : data.scenes.length}`,
          },
          {
            value: "open",
            label:
              view === "rollen" ? `Unbesetzt ${unassignedRoles}` : `Ohne Rollen ${emptyScenes}`,
          },
        ]}
      />

      {view === "rollen" ? (
        roles.length ? (
          <ul className="grid gap-2 lg:grid-cols-2">
            {roles.map((role) => (
              <RoleRow key={role.id} role={role} onOpen={() => open(role.id)} />
            ))}
          </ul>
        ) : (
          <Empty>{data.roles.length ? "Keine Treffer." : "Noch keine Rollen angelegt."}</Empty>
        )
      ) : scenes.length ? (
        <ul className="grid gap-2 lg:grid-cols-2">
          {scenes.map((scene) => (
            <SceneRow key={scene.id} scene={scene} data={data} onOpen={() => open(scene.id)} />
          ))}
        </ul>
      ) : (
        <Empty>{data.scenes.length ? "Keine Treffer." : "Noch keine Szenen angelegt."}</Empty>
      )}

      {view === "rollen" ? (
        <RolePanel
          key={openRole?.id ?? (creating ? "new" : "closed")}
          open={creating || openRole !== null}
          role={openRole}
          data={data}
          onClose={() => {
            setCreating(false);
            if (openId) open(null);
          }}
          onCreated={(id) => {
            setCreating(false);
            open(id);
          }}
        />
      ) : (
        <ScenePanel
          key={openScene?.id ?? (creating ? "new" : "closed")}
          open={creating || openScene !== null}
          scene={openScene}
          data={data}
          onClose={() => {
            setCreating(false);
            if (openId) open(null);
          }}
          onCreated={(id) => {
            setCreating(false);
            open(id);
          }}
        />
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{children}</p>;
}

function RoleDot({
  role,
  className,
}: {
  role: Pick<RsRole, "name" | "color">;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklab, ${role.color ?? "var(--muted-foreground)"} 40%, transparent)`,
      }}
    >
      {role.name.slice(0, 1)}
    </span>
  );
}

function RoleRow({ role, onOpen }: { role: RsRole; onOpen: () => void }) {
  const primary = role.cast.filter((entry) => entry.type === "primary");
  const others = role.cast.filter((entry) => entry.type !== "primary");
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
      >
        <RoleDot role={role} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{role.name}</span>
          <span className="block truncate text-xs">
            {primary.length ? (
              <span>{primary.map((entry) => entry.person.name).join(", ")}</span>
            ) : (
              <span className="font-medium text-destructive">Nicht besetzt</span>
            )}
            {others.length ? (
              <span className="text-muted-foreground">
                {" "}
                · Zweit: {others.map((entry) => entry.person.name).join(", ")}
              </span>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {role.sceneIds.length} {role.sceneIds.length === 1 ? "Szene" : "Szenen"}
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

function SceneRow({
  scene,
  data,
  onOpen,
}: {
  scene: RsScene;
  data: RolesScenesData;
  onOpen: () => void;
}) {
  const roles = scene.roles.flatMap((entry) => {
    const role = data.roles.find((item) => item.id === entry.characterId);
    return role ? [{ role, featured: entry.featured }] : [];
  });
  const blocked = scene.breakdown.filter((item) => item.status === "blocked").length;
  const open = scene.breakdown.filter((item) => item.status !== "done" && item.status !== "ready");
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-muted px-2 text-sm font-semibold tabular-nums">
          {sceneLabel(scene)}
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block truncate text-sm font-semibold">
            {scene.title ?? `Szene ${sceneLabel(scene)}`}
          </span>
          {scene.location || scene.timeOfDay || scene.durationMinutes ? (
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              {scene.location ? <MapPinIcon className="h-3 w-3 shrink-0" aria-hidden /> : null}
              <span className="truncate">
                {[
                  scene.location,
                  scene.timeOfDay,
                  scene.durationMinutes ? `${scene.durationMinutes} Min.` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          ) : null}
          <span className="flex flex-wrap gap-1">
            {roles.length ? (
              roles.map(({ role, featured }) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${role.color ?? "var(--muted-foreground)"} 22%, transparent)`,
                  }}
                >
                  {featured ? <StarIcon className="h-3 w-3" aria-label="Hauptszene" /> : null}
                  {role.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Keine Rollen</span>
            )}
          </span>
          {scene.breakdown.length ? (
            <span className="block text-xs text-muted-foreground">
              Ausstattung: {open.length} offen
              {blocked ? (
                <span className="font-medium text-destructive"> · {blocked} blockiert</span>
              ) : null}
            </span>
          ) : null}
        </span>
        <ChevronRightIcon className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border/60 pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string | null;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm",
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {color !== undefined ? (
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
        />
      ) : null}
      {children}
    </button>
  );
}

function RolePanel({
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
                    <Link href="/mitglieder/produktionen/szenen" className="text-primary underline">
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
  identifier: string;
  title: string;
  location: string;
  timeOfDay: string;
  duration: string;
  summary: string;
  roles: { characterId: string; featured: boolean }[];
};

function nextIdentifier(scenes: RsScene[]) {
  const last = scenes.at(-1)?.identifier;
  if (!last) return "1";
  const parts = last.split(".");
  parts[parts.length - 1] = String((Number.parseInt(parts.at(-1) ?? "0", 10) || 0) + 1);
  return parts.join(".");
}

function ScenePanel({
  open,
  scene,
  data,
  onClose,
  onCreated,
}: {
  open: boolean;
  scene: RsScene | null;
  data: RolesScenesData;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const run = useRun();
  const [draft, setDraft] = React.useState<SceneDraft>(() => ({
    identifier: scene?.identifier ?? nextIdentifier(data.scenes),
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
      identifier: draft.identifier,
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
              disabled={!draft.identifier.trim()}
              onClick={save}
            >
              {scene ? "Speichern" : "Anlegen"}
            </AsyncButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <Field label="Nummer">
              <input
                className={inputClass}
                value={draft.identifier}
                inputMode="decimal"
                placeholder="1.3"
                onChange={(event) => update("identifier", event.target.value)}
              />
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
                <Link href="/mitglieder/produktionen/besetzung" className="text-primary underline">
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
