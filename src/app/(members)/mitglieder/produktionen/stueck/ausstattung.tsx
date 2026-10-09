"use client";

import * as React from "react";
import Link from "next/link";
import type { ProductionObjectKind } from "@prisma/client";

import { CameraIcon, ChevronRightIcon, PlusIcon, XIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  MODULE_FOR_KIND,
  OBJECT_KIND_LABELS,
  OBJECT_KIND_PLURAL,
  OBJECT_STATUS_DOT,
  OBJECT_STATUS_LABELS,
  OBJECT_TEXT_LIMITS,
  REQUEST_KINDS,
} from "@/lib/ausstattung/constants";
import { resizeImageFile } from "@/lib/inventory/photo-client";
import type { RolesScenesData, RsScene } from "@/lib/produktionen/roles-scenes";
import { cn } from "@/lib/utils";

import {
  createRequirementAction,
  withdrawRequirementAction,
} from "../../meine-gewerke/ausstattung-actions";
import { inputClass, type useRun } from "./ui";

/** Gewerke, die eine Art führen: erst mit passendem Baustein, sonst alle mit Eingang, sonst alle. */
export function departmentsForKind(data: RolesScenesData, kind: ProductionObjectKind) {
  const moduleKey = MODULE_FOR_KIND[kind];
  const withModule = moduleKey
    ? data.departments.filter((entry) => entry.modules.includes(moduleKey))
    : [];
  if (withModule.length) return withModule;
  const withInbox = data.departments.filter((entry) => entry.modules.includes("requirements"));
  return withInbox.length ? withInbox : data.departments;
}

const KIND_ORDER: ProductionObjectKind[] = [
  "prop",
  "costume",
  "costume_part",
  "set_piece",
  "other",
];

/** Abschnitt „Ausstattung“ einer Szene: Objekte (Status nur lesend), Anforderungen, „+ Bedarf“. */
export function SceneAusstattung({
  scene,
  data,
  run,
}: {
  scene: RsScene;
  data: RolesScenesData;
  run: ReturnType<typeof useRun>;
}) {
  const [adding, setAdding] = React.useState(false);
  const department = (id: string) => data.departments.find((entry) => entry.id === id);
  const role = (id: string) => data.roles.find((entry) => entry.id === id);
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    objects: scene.objects.filter((object) => object.kind === kind),
  })).filter((group) => group.objects.length);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.kind} className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">
            {OBJECT_KIND_PLURAL[group.kind]}
          </h4>
          <ul className="divide-y divide-border overflow-hidden rounded-lg bg-muted">
            {group.objects.map((object) => {
              const owner = department(object.departmentId);
              const roles = object.characterIds.map((id) => role(id)?.name).filter(Boolean);
              return (
                <li key={object.id}>
                  <Link
                    href={
                      owner
                        ? `/mitglieder/meine-gewerke/${encodeURIComponent(owner.slug)}/objekt/${object.id}`
                        : "#"
                    }
                    className="flex min-h-12 items-center gap-2.5 px-2 py-1.5 hover:bg-muted-foreground/10"
                  >
                    {object.photoId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/ausstattung/fotos/${object.photoId}`}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="ml-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: owner?.color ?? "var(--muted-foreground)" }}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{object.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[owner?.name, roles.join(", "), object.note].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        aria-hidden
                        className={cn("h-2 w-2 rounded-full", OBJECT_STATUS_DOT[object.status])}
                      />
                      {OBJECT_STATUS_LABELS[object.status]}
                    </span>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {scene.requirements.length ? (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">Anforderungen</h4>
          <ul className="space-y-1.5">
            {scene.requirements.map((requirement) => {
              const declined = requirement.status === "declined";
              return (
                <li
                  key={requirement.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-2.5 py-2",
                    declined
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-dashed border-border",
                  )}
                >
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 font-medium",
                          declined ? "bg-destructive/10 text-destructive" : "bg-info/15 text-info",
                        )}
                      >
                        {declined ? "Abgelehnt" : "Angefordert"}
                      </span>
                      <span>
                        {OBJECT_KIND_LABELS[requirement.kind]} ·{" "}
                        {department(requirement.departmentId)?.name ?? "Gewerk"}
                        {requirement.characterId
                          ? ` · ${role(requirement.characterId)?.name ?? ""}`
                          : ""}
                      </span>
                    </span>
                    <span className="line-clamp-4 block whitespace-pre-wrap text-sm">
                      {requirement.text}
                    </span>
                    {declined && requirement.declineReason ? (
                      <span className="block text-xs text-destructive">
                        Grund: {requirement.declineReason}
                      </span>
                    ) : null}
                    {requirement.hasPhoto ? (
                      <a
                        href={`/api/ausstattung/anforderungen/${requirement.id}/foto`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <CameraIcon className="h-3.5 w-3.5" /> Foto
                      </a>
                    ) : null}
                  </span>
                  {data.canRequest ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      aria-label={declined ? "Entfernen" : "Zurückziehen"}
                      onClick={() =>
                        void run(
                          () => withdrawRequirementAction({ requirementId: requirement.id }),
                          declined ? "Entfernt" : "Zurückgezogen",
                        )
                      }
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!groups.length && !scene.requirements.length ? (
        <p className="text-sm text-muted-foreground">Für diese Szene ist noch nichts geplant.</p>
      ) : null}

      {data.canRequest && data.departments.length ? (
        adding ? (
          <RequestForm scene={scene} data={data} run={run} onDone={() => setAdding(false)} />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() => setAdding(true)}
          >
            <PlusIcon className="h-4 w-4" /> Bedarf anfordern
          </Button>
        )
      ) : null}
    </div>
  );
}

function RequestForm({
  scene,
  data,
  run,
  onDone,
}: {
  scene: RsScene;
  data: RolesScenesData;
  run: ReturnType<typeof useRun>;
  onDone: () => void;
}) {
  const [kind, setKind] = React.useState<ProductionObjectKind>("prop");
  const targets = departmentsForKind(data, kind);
  const [departmentId, setDepartmentId] = React.useState(targets[0]?.id ?? "");
  const effectiveDepartment = targets.some((entry) => entry.id === departmentId)
    ? departmentId
    : (targets[0]?.id ?? "");
  const [characterId, setCharacterId] = React.useState("");
  const [text, setText] = React.useState("");
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const sceneRoles = data.roles.filter((role) =>
    scene.roles.some((entry) => entry.characterId === role.id),
  );
  const otherRoles = data.roles.filter((role) => !sceneRoles.includes(role));

  const submit = async () => {
    setSaving(true);
    const formData = new FormData();
    formData.set("sceneId", scene.id);
    formData.set("departmentId", effectiveDepartment);
    formData.set("kind", kind);
    formData.set("characterId", characterId);
    formData.set("text", text);
    if (photo) formData.set("photo", await resizeImageFile(photo));
    const ok = await run(() => createRequirementAction(formData), "Angefordert");
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <SegmentedControl<ProductionObjectKind>
        aria-label="Art"
        size="md"
        fullWidth
        value={kind}
        onValueChange={setKind}
        options={REQUEST_KINDS.map((value) => ({
          value,
          label: OBJECT_KIND_LABELS[value],
        }))}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">An Gewerk</span>
          <select
            className={cn(inputClass, "px-2")}
            value={effectiveDepartment}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            {targets.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Für Rolle (optional)</span>
          <select
            className={cn(inputClass, "px-2")}
            value={characterId}
            onChange={(event) => setCharacterId(event.target.value)}
          >
            <option value="">Keine bestimmte Rolle</option>
            {sceneRoles.length ? (
              <optgroup label="In dieser Szene">
                {sceneRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {otherRoles.length ? (
              <optgroup label="Weitere Rollen">
                {otherRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="flex justify-between text-xs font-medium text-muted-foreground">
          <span>Was wird gebraucht?</span>
          <span className="tabular-nums">
            {text.length}/{OBJECT_TEXT_LIMITS.requirement}
          </span>
        </span>
        <textarea
          className={cn(inputClass, "h-auto min-h-32 py-2")}
          value={text}
          autoFocus
          maxLength={OBJECT_TEXT_LIMITS.requirement}
          placeholder={
            kind === "costume"
              ? "z. B. Reisemantel für Fogg, wirkt wohlhabend, muss einen schnellen Umzug aushalten …"
              : "Was, wofür, wie soll es aussehen, was muss es aushalten, Größe …"
          }
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:text-foreground">
          <CameraIcon className="h-4 w-4" />
          {photo ? "Foto ändern" : "Foto/Skizze"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          />
        </label>
        {photo ? (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {photo.name}
          </span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="h-11" onClick={onDone}>
          Abbrechen
        </Button>
        <AsyncButton
          type="button"
          className="h-11 flex-1"
          isLoading={saving}
          loadingText="Sendet …"
          disabled={!text.trim() || !effectiveDepartment}
          onClick={submit}
        >
          Anfordern
        </AsyncButton>
      </div>
    </div>
  );
}
