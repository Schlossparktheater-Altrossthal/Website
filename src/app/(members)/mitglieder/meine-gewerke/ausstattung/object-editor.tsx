"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ProductionObjectKind,
  ProductionObjectSource,
  ProductionObjectStatus,
} from "@prisma/client";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CameraIcon,
  ListTodoIcon,
  PlusIcon,
  RulerIcon,
  TrashIcon,
  XIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  formatCents,
  OBJECT_KIND_LABELS,
  OBJECT_KINDS,
  OBJECT_SOURCE_LABELS,
  OBJECT_SOURCES,
  OBJECT_STATUS_LABELS,
  OBJECT_STATUSES,
  OBJECT_TEXT_LIMITS,
  parseEuroToCents,
  REQUIREMENT_STATUS_LABELS,
} from "@/lib/ausstattung/constants";
import type { ObjectDetail, ObjectListItem, StageData } from "@/lib/ausstattung/objects";
import { resizeImageFile } from "@/lib/inventory/photo-client";
import { cn } from "@/lib/utils";

import {
  addChecklistItemAction,
  addObjectPhotoAction,
  archiveObjectAction,
  deleteChecklistItemAction,
  deleteObjectAction,
  deleteObjectPhotoAction,
  setCostumePartsAction,
  setObjectCharactersAction,
  setObjectScenesAction,
  setObjectStatusAction,
  toggleChecklistItemAction,
  updateObjectAction,
} from "../ausstattung-actions";
import { InventoryLink, type InventoryLinkProps } from "./inventory-link";
import {
  CreateObjectPanel,
  ObjectThumb,
  StatusDot,
  fullScene,
  inputClass,
  shortScene,
  useAction,
} from "./shared";

type Props = {
  object: ObjectDetail;
  stage: StageData;
  basePath: string;
  canEdit: boolean;
  canManage: boolean;
  /** Kostüm: wählbare Teile der Produktion; Teil: Kostüme, in denen es steckt. */
  showObjects: Pick<ObjectListItem, "id" | "title" | "kind" | "status" | "photoId">[];
  inventory: InventoryLinkProps["initial"];
  /** Board und Maße des Gewerks öffnen (Mitglieder, Regie/Board). */
  canOpenTeam: boolean;
};

export function ObjectEditor({
  object,
  stage,
  basePath,
  canEdit,
  canManage,
  showObjects,
  inventory,
  canOpenTeam,
}: Props) {
  const run = useAction();
  const router = useRouter();
  const [confirm, setConfirm] = React.useState<"delete" | null>(null);

  return (
    <div className="space-y-4">
      <header className="flex items-start gap-3">
        <ObjectThumb object={object} className="h-12 w-12 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs text-muted-foreground">
            {OBJECT_KIND_LABELS[object.kind]} · {object.departmentName}
            {object.archived ? " · archiviert" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {object.nextRehearsal && object.status !== "ready"
              ? `Gebraucht zur Probe am ${format(new Date(object.nextRehearsal), "EEEE, d. MMM", { locale: de })}`
              : object.status === "ready"
                ? "Fertig"
                : "Keine anstehende Probe mit diesen Szenen"}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<ProductionObjectStatus>
          aria-label="Status"
          size="md"
          value={object.status}
          onValueChange={(status) =>
            canEdit
              ? void run(() => setObjectStatusAction({ objectId: object.id, status }))
              : undefined
          }
          options={OBJECT_STATUSES.map((value) => ({
            value,
            label: OBJECT_STATUS_LABELS[value],
            disabled: !canEdit,
          }))}
        />
        {object.taskId && canOpenTeam ? (
          <Link
            href={`${basePath}?ansicht=aufgaben&karte=${object.taskId}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-primary hover:underline"
          >
            <ListTodoIcon className="h-4 w-4" /> Karte im Board
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <DetailsForm object={object} canEdit={canEdit} />
          <ScenesSection object={object} stage={stage} canEdit={canEdit} />
          {object.kind === "costume" ? (
            <PartsSection
              object={object}
              parts={showObjects.filter((entry) => entry.kind === "costume_part")}
              stage={stage}
              basePath={basePath}
              canEdit={canEdit}
            />
          ) : null}
          {object.kind === "costume_part" ? (
            <Card title="Steckt in">
              {object.partOfIds.length ? (
                <ul className="space-y-1">
                  {object.partOfIds.map((id) => {
                    const costume = showObjects.find((entry) => entry.id === id);
                    return costume ? (
                      <li key={id}>
                        <Link
                          href={`${basePath}/objekt/${id}`}
                          className="flex min-h-10 items-center gap-2 text-sm hover:underline"
                        >
                          <StatusDot status={costume.status} />
                          {costume.title}
                        </Link>
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Noch in keinem Kostüm. Teile ordnest du auf der Seite des Kostüms zu.
                </p>
              )}
            </Card>
          ) : null}
        </div>
        <div className="space-y-4">
          <PhotosSection object={object} canEdit={canEdit} />
          <ChecklistSection object={object} canEdit={canEdit} />
          {object.kind === "costume" || object.kind === "prop" ? (
            <RolesSection object={object} stage={stage} canEdit={canEdit} basePath={basePath} />
          ) : null}
          {object.source === "stock" ? (
            <InventoryLink objectId={object.id} canEdit={canEdit} initial={inventory} />
          ) : null}
          {object.requirements.length ? (
            <Card title="Anforderungen">
              <ul className="space-y-2">
                {object.requirements.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="text-xs text-muted-foreground">
                      {entry.sceneLabel} · {entry.requestedBy ?? "Unbekannt"} ·{" "}
                      {format(new Date(entry.createdAt), "d. MMM", { locale: de })} ·{" "}
                      {REQUIREMENT_STATUS_LABELS[entry.status]}
                    </p>
                    <p className="whitespace-pre-wrap">{entry.text}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {object.finance.length || object.costCents !== null ? (
            <Card title="Kosten">
              <dl className="space-y-1 text-sm">
                {object.costCents !== null ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Geschätzt</dt>
                    <dd className="tabular-nums">{formatCents(object.costCents)}</dd>
                  </div>
                ) : null}
                {object.finance.map((entry) => (
                  <div key={entry.id} className="flex justify-between gap-2">
                    <dt className="truncate text-muted-foreground">{entry.title}</dt>
                    <dd className="tabular-nums">
                      {entry.amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() =>
                  void run(
                    () => archiveObjectAction({ objectId: object.id, archived: !object.archived }),
                    object.archived ? "Wiederhergestellt" : "Archiviert",
                  )
                }
              >
                {object.archived ? (
                  <ArchiveRestoreIcon className="h-4 w-4" />
                ) : (
                  <ArchiveIcon className="h-4 w-4" />
                )}
                {object.archived ? "Wiederherstellen" : "Archivieren"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10 text-destructive"
                onClick={() => setConfirm("delete")}
              >
                <TrashIcon className="h-4 w-4" /> Löschen
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Angelegt {format(new Date(object.createdAt), "d. MMM yyyy", { locale: de })}
            {object.createdBy ? ` von ${object.createdBy}` : ""}
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(value) => !value && setConfirm(null)}
        title="Objekt löschen?"
        description="Objekt, Karte, Fotos und Checkliste werden entfernt. Anforderungen landen wieder im Eingang."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          if (await run(() => deleteObjectAction({ objectId: object.id }), "Gelöscht")) {
            router.push(basePath);
          }
        }}
      />
    </div>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
      <header className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function DetailsForm({ object, canEdit }: { object: ObjectDetail; canEdit: boolean }) {
  const run = useAction();
  const initial = React.useMemo(
    () => ({
      title: object.title,
      kind: object.kind,
      description: object.description ?? "",
      source: object.source,
      dimensions: object.dimensions ?? "",
      material: object.material ?? "",
      note: object.note ?? "",
      cost: object.costCents !== null ? (object.costCents / 100).toFixed(2).replace(".", ",") : "",
    }),
    [object],
  );
  const [draft, setDraft] = React.useState(initial);
  const [source, setSource] = React.useState(initial);
  if (source !== initial) {
    setSource(initial);
    setDraft(initial);
  }
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const update = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    await run(
      () =>
        updateObjectAction({
          objectId: object.id,
          kind: draft.kind,
          title: draft.title,
          description: draft.description,
          source: draft.source,
          dimensions: draft.dimensions,
          material: draft.material,
          note: draft.note,
          costCents: parseEuroToCents(draft.cost),
        }),
      "Gespeichert",
    );
    setSaving(false);
  };

  return (
    <Card title="Beschreibung">
      <fieldset disabled={!canEdit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Bezeichnung</span>
          <input
            className={inputClass}
            value={draft.title}
            maxLength={OBJECT_TEXT_LIMITS.title}
            onChange={(event) => update("title", event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Art</span>
            <select
              className={cn(inputClass, "px-2")}
              value={draft.kind}
              onChange={(event) => update("kind", event.target.value as ProductionObjectKind)}
            >
              {OBJECT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {OBJECT_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Herkunft</span>
            <select
              className={cn(inputClass, "px-2")}
              value={draft.source}
              onChange={(event) => update("source", event.target.value as ProductionObjectSource)}
            >
              {OBJECT_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {OBJECT_SOURCE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>Beschreibung</span>
            <span className="tabular-nums">
              {draft.description.length}/{OBJECT_TEXT_LIMITS.description}
            </span>
          </span>
          <textarea
            className={cn(inputClass, "h-auto min-h-40 py-2 leading-relaxed")}
            value={draft.description}
            maxLength={OBJECT_TEXT_LIMITS.description}
            placeholder="Wie soll es aussehen, was muss es aushalten, wer benutzt es wie, Ideen, Links …"
            onChange={(event) => update("description", event.target.value)}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Maße/Größe</span>
            <input
              className={inputClass}
              value={draft.dimensions}
              maxLength={OBJECT_TEXT_LIMITS.short}
              placeholder={
                object.kind.startsWith("costume") ? "z. B. Gr. 50" : "z. B. 80×40×120 cm"
              }
              onChange={(event) => update("dimensions", event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Material</span>
            <input
              className={inputClass}
              value={draft.material}
              maxLength={OBJECT_TEXT_LIMITS.short}
              onChange={(event) => update("material", event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Kosten geschätzt (€)</span>
            <input
              className={inputClass}
              value={draft.cost}
              inputMode="decimal"
              placeholder="0,00"
              onChange={(event) => update("cost", event.target.value.replace(/[^\d,.]/g, ""))}
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Interne Notiz</span>
          <textarea
            className={cn(inputClass, "h-auto min-h-16 py-2")}
            value={draft.note}
            maxLength={OBJECT_TEXT_LIMITS.note}
            onChange={(event) => update("note", event.target.value)}
          />
        </label>
        {canEdit ? (
          <div className="flex justify-end gap-2">
            {dirty ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => setDraft(initial)}
              >
                Verwerfen
              </Button>
            ) : null}
            <AsyncButton
              type="button"
              className="h-11"
              isLoading={saving}
              disabled={!dirty || !draft.title.trim()}
              onClick={save}
            >
              Speichern
            </AsyncButton>
          </div>
        ) : null}
      </fieldset>
    </Card>
  );
}

function ScenesSection({
  object,
  stage,
  canEdit,
}: {
  object: ObjectDetail;
  stage: StageData;
  canEdit: boolean;
}) {
  const run = useAction();
  const initial = React.useMemo(
    () =>
      Object.fromEntries(object.sceneIds.map((id) => [id, object.sceneNotes[id] ?? ""])) as Record<
        string,
        string
      >,
    [object],
  );
  const [selected, setSelected] = React.useState(initial);
  const [source, setSource] = React.useState(initial);
  if (source !== initial) {
    setSource(initial);
    setSelected(initial);
  }
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify(selected) !== JSON.stringify(initial);
  const ordered = stage.scenes.filter((scene) => scene.id in selected);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = { ...current };
      if (id in next) delete next[id];
      else next[id] = "";
      return next;
    });

  return (
    <Card title={`Szenen (${ordered.length})`}>
      {stage.scenes.length ? (
        <div className="flex flex-wrap gap-1.5">
          {stage.scenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              disabled={!canEdit}
              aria-pressed={scene.id in selected}
              title={fullScene(scene)}
              onClick={() => toggle(scene.id)}
              className={cn(
                "h-9 min-w-11 rounded-full border px-3 text-sm tabular-nums",
                scene.id in selected
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {shortScene(scene)}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Das Stück hat noch keine Szenen.</p>
      )}
      {ordered.length ? (
        <ul className="space-y-1.5">
          {ordered.map((scene) => (
            <li key={scene.id} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-2">
              <span className="truncate text-sm" title={fullScene(scene)}>
                {fullScene(scene)}
              </span>
              <input
                className={cn(inputClass, "h-10")}
                value={selected[scene.id] ?? ""}
                disabled={!canEdit}
                maxLength={OBJECT_TEXT_LIMITS.sceneNote}
                placeholder="Position / Hinweis, z. B. Tisch links"
                aria-label={`Hinweis ${fullScene(scene)}`}
                onChange={(event) =>
                  setSelected((current) => ({ ...current, [scene.id]: event.target.value }))
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit && dirty ? (
        <div className="flex justify-end">
          <AsyncButton
            type="button"
            className="h-10"
            isLoading={saving}
            onClick={async () => {
              setSaving(true);
              await run(
                () =>
                  setObjectScenesAction({
                    objectId: object.id,
                    scenes: ordered.map((scene) => ({
                      sceneId: scene.id,
                      note: selected[scene.id] ?? "",
                    })),
                  }),
                "Szenen gespeichert",
              );
              setSaving(false);
            }}
          >
            Szenen speichern
          </AsyncButton>
        </div>
      ) : null}
    </Card>
  );
}

function RolesSection({
  object,
  stage,
  canEdit,
  basePath,
}: {
  object: ObjectDetail;
  stage: StageData;
  canEdit: boolean;
  basePath: string;
}) {
  const run = useAction();
  const [selected, setSelected] = React.useState(object.characterIds);
  const [source, setSource] = React.useState(object.characterIds);
  if (source !== object.characterIds) {
    setSource(object.characterIds);
    setSelected(object.characterIds);
  }
  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((entry) => entry !== id)
      : [...selected, id];
    setSelected(next);
    void run(() => setObjectCharactersAction({ objectId: object.id, characterIds: next }));
  };
  // Rollen aus den Szenen des Objekts zuerst.
  const inScenes = new Set(
    stage.scenes
      .filter((scene) => object.sceneIds.includes(scene.id))
      .flatMap((scene) => scene.characterIds),
  );
  const characters = [...stage.characters].sort(
    (a, b) => Number(inScenes.has(b.id)) - Number(inScenes.has(a.id)),
  );
  const chosen = stage.characters.filter((character) => selected.includes(character.id));

  return (
    <Card title={object.kind === "costume" ? "Getragen von" : "Benutzt von"}>
      {characters.length ? (
        <div className="flex flex-wrap gap-1.5">
          {characters.map((character) => (
            <button
              key={character.id}
              type="button"
              disabled={!canEdit}
              aria-pressed={selected.includes(character.id)}
              onClick={() => toggle(character.id)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm",
                selected.includes(character.id)
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: character.color ?? "var(--muted-foreground)" }}
              />
              {character.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Das Stück hat noch keine Rollen.</p>
      )}
      {object.kind === "costume" && chosen.length ? (
        <div className="space-y-1 border-t border-border/60 pt-2">
          {chosen.map((character) => (
            <p key={character.id} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{character.name}:</span>{" "}
              {character.cast.map((entry) => entry.name).join(", ") || "nicht besetzt"}
            </p>
          ))}
          <Link
            href={`${basePath}?ansicht=masse`}
            className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline"
          >
            <RulerIcon className="h-4 w-4" /> Maße der Besetzung
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

function PartsSection({
  object,
  parts,
  stage,
  basePath,
  canEdit,
}: {
  object: ObjectDetail;
  parts: Props["showObjects"];
  stage: StageData;
  basePath: string;
  canEdit: boolean;
}) {
  const run = useAction();
  const [creating, setCreating] = React.useState(false);
  const [adding, setAdding] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const current = object.partIds
    .map((id) => parts.find((part) => part.id === id))
    .filter((part): part is Props["showObjects"][number] => Boolean(part));
  const available = parts.filter((part) => !object.partIds.includes(part.id));
  const save = (ids: string[]) =>
    run(() => setCostumePartsAction({ costumeId: object.id, partIds: ids }));

  return (
    <Card
      title={`Teile (${current.length})`}
      action={
        canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setCreating(true)}
          >
            <PlusIcon className="h-4 w-4" /> Neues Teil
          </Button>
        ) : undefined
      }
    >
      {current.length ? (
        <ul className="divide-y divide-border">
          {current.map((part) => (
            <li key={part.id} className="flex min-h-12 items-center gap-2 py-1">
              <ObjectThumb object={part} className="h-9 w-9 rounded-md" />
              <Link
                href={`${basePath}/objekt/${part.id}`}
                className="min-w-0 flex-1 truncate text-sm hover:underline"
              >
                {part.title}
              </Link>
              <StatusDot status={part.status} />
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label={`${part.title} entfernen`}
                  onClick={() => void save(object.partIds.filter((id) => id !== part.id))}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ein Kostüm besteht aus Teilen (Hut, Mantel, Schuhe …). Teile kannst du in mehreren
          Kostümen verwenden.
        </p>
      )}
      {canEdit && available.length ? (
        <div className="flex gap-2">
          <select
            className={cn(inputClass, "px-2")}
            value={adding}
            aria-label="Vorhandenes Teil hinzufügen"
            onChange={(event) => setAdding(event.target.value)}
          >
            <option value="">Vorhandenes Teil hinzufügen …</option>
            {available.map((part) => (
              <option key={part.id} value={part.id}>
                {part.title}
              </option>
            ))}
          </select>
          <AsyncButton
            type="button"
            className="h-11"
            isLoading={busy}
            disabled={!adding}
            onClick={async () => {
              setBusy(true);
              if (await save([...object.partIds, adding])) setAdding("");
              setBusy(false);
            }}
          >
            Hinzufügen
          </AsyncButton>
        </div>
      ) : null}
      {canEdit ? (
        <CreateObjectPanel
          open={creating}
          onOpenChange={setCreating}
          departmentId={object.departmentId}
          basePath={basePath}
          kinds={["costume_part"]}
          stage={stage}
          costumeId={object.id}
        />
      ) : null}
    </Card>
  );
}

function PhotosSection({ object, canEdit }: { object: ObjectDetail; canEdit: boolean }) {
  const run = useAction();
  const [busy, setBusy] = React.useState(false);
  const [kind, setKind] = React.useState<"reference" | "actual">("reference");
  const upload = async (file: File) => {
    setBusy(true);
    const formData = new FormData();
    formData.set("photo", await resizeImageFile(file));
    formData.set("kind", kind);
    await run(() => addObjectPhotoAction(object.id, formData), "Foto gespeichert");
    setBusy(false);
  };
  return (
    <Card title={`Fotos (${object.photos.length})`}>
      {object.photos.length ? (
        <ul className="grid grid-cols-3 gap-2">
          {object.photos.map((photo) => (
            <li key={photo.id} className="group relative">
              <a href={`/api/ausstattung/fotos/${photo.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/ausstattung/fotos/${photo.id}`}
                  alt={photo.caption ?? ""}
                  loading="lazy"
                  className="aspect-square w-full rounded-lg bg-muted object-cover"
                />
              </a>
              <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 text-[11px]">
                {photo.kind === "actual" ? "Ist" : "Vorbild"}
              </span>
              {canEdit ? (
                <button
                  type="button"
                  aria-label="Foto löschen"
                  onClick={() => void run(() => deleteObjectPhotoAction({ photoId: photo.id }))}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-foreground shadow"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Vorbilder, Skizzen oder wie es tatsächlich aussieht.
        </p>
      )}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<"reference" | "actual">
            aria-label="Art des Fotos"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "reference", label: "Vorbild" },
              { value: "actual", label: "Ist" },
            ]}
          />
          <label
            className={cn(
              "inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <CameraIcon className="h-4 w-4" />
            {busy ? "Lädt …" : "Foto hinzufügen"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
        </div>
      ) : null}
    </Card>
  );
}

function ChecklistSection({ object, canEdit }: { object: ObjectDetail; canEdit: boolean }) {
  const run = useAction();
  const [text, setText] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const done = object.checklist.filter((item) => item.done).length;
  return (
    <Card
      title={`Arbeitsschritte ${object.checklist.length ? `${done}/${object.checklist.length}` : ""}`}
    >
      {object.checklist.length ? (
        <ul className="space-y-1">
          {object.checklist.map((item) => (
            <li key={item.id} className="flex min-h-10 items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                checked={item.done}
                disabled={!canEdit}
                aria-label={item.text}
                onChange={(event) =>
                  void run(() =>
                    toggleChecklistItemAction({ itemId: item.id, done: event.target.checked }),
                  )
                }
              />
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  item.done && "text-muted-foreground line-through",
                )}
              >
                {item.text}
              </span>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`${item.text} löschen`}
                  onClick={() => void run(() => deleteChecklistItemAction({ itemId: item.id }))}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          z. B. Material besorgen · zuschneiden · bemalen · anprobieren.
        </p>
      )}
      {canEdit ? (
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!text.trim()) return;
            setAdding(true);
            if (await run(() => addChecklistItemAction({ objectId: object.id, text }))) setText("");
            setAdding(false);
          }}
        >
          <input
            className={inputClass}
            value={text}
            maxLength={OBJECT_TEXT_LIMITS.short}
            placeholder="Schritt hinzufügen"
            aria-label="Schritt hinzufügen"
            onChange={(event) => setText(event.target.value)}
          />
          <AsyncButton
            type="submit"
            variant="outline"
            size="icon"
            className="h-11 w-11"
            isLoading={adding}
            aria-label="Hinzufügen"
          >
            <PlusIcon className="h-4 w-4" />
          </AsyncButton>
        </form>
      ) : null}
    </Card>
  );
}
