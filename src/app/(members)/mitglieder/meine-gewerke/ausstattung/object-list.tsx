"use client";

import * as React from "react";
import type { ProductionObjectKind, ProductionObjectStatus } from "@prisma/client";

import { PlusIcon, SearchIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import {
  OBJECT_STATUS_LABELS,
  OBJECT_STATUSES,
  OBJECT_KIND_PLURAL,
} from "@/lib/ausstattung/constants";
import type { ObjectListItem, StageData } from "@/lib/ausstattung/objects";
import { cn } from "@/lib/utils";

import { CreateObjectPanel, EmptyState, ObjectRow, inputClass, shortScene } from "./shared";

const ALL = "__all";

/** Liste aller Objekte einer Verwaltungsseite: Suche, Status, Szene, „+ Neu“. */
export function ObjectListView({
  objects,
  stage,
  departmentId,
  basePath,
  kinds,
  canEdit,
  emptyText,
}: {
  objects: ObjectListItem[];
  stage: StageData;
  departmentId: string;
  basePath: string;
  kinds: ProductionObjectKind[];
  canEdit: boolean;
  emptyText: string;
}) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<ProductionObjectStatus | typeof ALL>(ALL);
  const [sceneId, setSceneId] = React.useState(ALL);
  const [creating, setCreating] = React.useState(false);

  const needle = query.trim().toLowerCase();
  const visible = objects.filter(
    (object) =>
      (status === ALL || object.status === status) &&
      (sceneId === ALL ||
        (sceneId === "" ? !object.sceneIds.length : object.sceneIds.includes(sceneId))) &&
      (!needle ||
        object.title.toLowerCase().includes(needle) ||
        object.description?.toLowerCase().includes(needle)),
  );
  const counts = Object.fromEntries(
    OBJECT_STATUSES.map((value) => [
      value,
      objects.filter((object) => object.status === value).length,
    ]),
  ) as Record<ProductionObjectStatus, number>;
  const grouped = kinds.length > 1;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(inputClass, "pl-9")}
            value={query}
            placeholder="Suchen"
            aria-label="Suchen"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {canEdit ? (
          <Button type="button" className="h-11" onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" /> Neu
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip active={status === ALL} onClick={() => setStatus(ALL)}>
          Alle {objects.length}
        </FilterChip>
        {OBJECT_STATUSES.map((value) => (
          <FilterChip key={value} active={status === value} onClick={() => setStatus(value)}>
            {OBJECT_STATUS_LABELS[value]} {counts[value]}
          </FilterChip>
        ))}
        {stage.scenes.length ? (
          <select
            aria-label="Nach Szene filtern"
            value={sceneId}
            onChange={(event) => setSceneId(event.target.value)}
            className={cn(
              "h-9 max-w-44 rounded-full border bg-background px-3 text-sm",
              sceneId !== ALL
                ? "border-primary font-medium text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            <option value={ALL}>Alle Szenen</option>
            {stage.scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                Szene {shortScene(scene)}
                {scene.title ? ` ${scene.title}` : ""}
              </option>
            ))}
            <option value="">Ohne Szene</option>
          </select>
        ) : null}
      </div>

      {visible.length ? (
        grouped ? (
          kinds.map((kind) => {
            const list = visible.filter((object) => object.kind === kind);
            if (!list.length) return null;
            return (
              <section key={kind} className="space-y-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">
                  {OBJECT_KIND_PLURAL[kind]} ({list.length})
                </h3>
                <ul className="grid gap-2 lg:grid-cols-2">
                  {list.map((object) => (
                    <ObjectRow
                      key={object.id}
                      object={object}
                      stage={stage}
                      href={`${basePath}/objekt/${object.id}`}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        ) : (
          <ul className="grid gap-2 lg:grid-cols-2">
            {visible.map((object) => (
              <ObjectRow
                key={object.id}
                object={object}
                stage={stage}
                href={`${basePath}/objekt/${object.id}`}
              />
            ))}
          </ul>
        )
      ) : (
        <EmptyState>{objects.length ? "Nichts gefunden." : emptyText}</EmptyState>
      )}

      {canEdit ? (
        <CreateObjectPanel
          open={creating}
          onOpenChange={setCreating}
          departmentId={departmentId}
          basePath={basePath}
          kinds={kinds}
          stage={stage}
        />
      ) : null}
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 rounded-full border px-3 text-sm tabular-nums",
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
