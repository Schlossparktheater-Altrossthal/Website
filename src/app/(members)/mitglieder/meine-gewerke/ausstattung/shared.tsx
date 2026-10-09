"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductionObjectKind } from "@prisma/client";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { toast } from "sonner";

import { ChevronRightIcon, ListChecksIcon, PackageIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import {
  OBJECT_KIND_LABELS,
  OBJECT_SOURCE_LABELS,
  OBJECT_STATUS_DOT,
  OBJECT_STATUS_LABELS,
  OBJECT_STATUS_TONE,
  OBJECT_TEXT_LIMITS,
} from "@/lib/ausstattung/constants";
import type { ObjectListItem, StageData, StageScene } from "@/lib/ausstattung/objects";
import { cn } from "@/lib/utils";

import { createObjectAction } from "../ausstattung-actions";

export const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

export type ActionResult = { ok: boolean; error?: string; message?: string };

export function useAction() {
  const router = useRouter();
  return async (action: () => Promise<ActionResult>, success?: string) => {
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

export function shortScene(scene: Pick<StageScene, "identifier" | "title">) {
  return scene.identifier ?? scene.title ?? "–";
}

export function fullScene(scene: Pick<StageScene, "identifier" | "title">) {
  return [scene.identifier, scene.title].filter(Boolean).join(" ") || "Szene";
}

export function StatusPill({ status }: { status: ObjectListItem["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        OBJECT_STATUS_TONE[status],
      )}
    >
      {OBJECT_STATUS_LABELS[status]}
    </span>
  );
}

export function StatusDot({ status }: { status: ObjectListItem["status"] }) {
  return (
    <span
      aria-label={OBJECT_STATUS_LABELS[status]}
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", OBJECT_STATUS_DOT[status])}
    />
  );
}

export function ObjectThumb({
  object,
  className,
}: {
  object: Pick<ObjectListItem, "photoId" | "kind">;
  className?: string;
}) {
  if (object.photoId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/ausstattung/fotos/${object.photoId}`}
        alt=""
        loading="lazy"
        className={cn("h-11 w-11 shrink-0 rounded-lg bg-muted object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
        className,
      )}
    >
      <PackageIcon className="h-5 w-5" />
    </span>
  );
}

/** Zeile eines Objekts mit Szenen-Chips, Checkliste und Frist. */
export function ObjectRow({
  object,
  stage,
  href,
  extra,
}: {
  object: ObjectListItem;
  stage: StageData;
  href: string;
  extra?: React.ReactNode;
}) {
  const scenes = object.sceneIds
    .map((id) => stage.scenes.find((scene) => scene.id === id))
    .filter((scene): scene is StageScene => Boolean(scene))
    .sort((a, b) => stage.scenes.indexOf(a) - stage.scenes.indexOf(b));
  const roles = object.characterIds
    .map((id) => stage.characters.find((character) => character.id === id)?.name)
    .filter(Boolean);
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card p-2.5 transition-colors hover:bg-muted/40"
      >
        <ObjectThumb object={object} />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{object.title}</span>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {scenes.length ? (
              <span className="tabular-nums">
                Sz. {scenes.map((scene) => shortScene(scene)).join(" · ")}
              </span>
            ) : (
              <span>keine Szene</span>
            )}
            {roles.length ? <span className="truncate">{roles.join(", ")}</span> : null}
            {object.source !== "undecided" ? (
              <span>{OBJECT_SOURCE_LABELS[object.source]}</span>
            ) : null}
            {object.checklistTotal ? (
              <span className="inline-flex items-center gap-0.5">
                <ListChecksIcon className="h-3 w-3" />
                {object.checklistDone}/{object.checklistTotal}
              </span>
            ) : null}
            {object.nextRehearsal && object.status !== "ready" ? (
              <span>Probe {format(new Date(object.nextRehearsal), "d. MMM", { locale: de })}</span>
            ) : null}
          </span>
          {extra}
        </span>
        <StatusPill status={object.status} />
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

/** Neues Objekt direkt im Gewerk anlegen (ohne Anforderung). */
export function CreateObjectPanel({
  open,
  onOpenChange,
  departmentId,
  basePath,
  kinds,
  stage,
  costumeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  basePath: string;
  kinds: ProductionObjectKind[];
  stage: StageData;
  /** Neues Kostümteil gleich diesem Kostüm zuordnen. */
  costumeId?: string;
}) {
  const router = useRouter();
  const [kind, setKind] = React.useState<ProductionObjectKind>(kinds[0] ?? "prop");
  const [title, setTitle] = React.useState("");
  const [sceneIds, setSceneIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const toggleScene = (id: string) =>
    setSceneIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  const save = async () => {
    setSaving(true);
    const result = await createObjectAction({
      departmentId,
      kind,
      title,
      sceneIds,
      costumeId: costumeId ?? null,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    toast.success(`${OBJECT_KIND_LABELS[kind]} angelegt`, { duration: 3000 });
    onOpenChange(false);
    setTitle("");
    setSceneIds([]);
    if (result.data?.id && !costumeId) router.push(`${basePath}/objekt/${result.data.id}`);
    else router.refresh();
  };

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title={`${OBJECT_KIND_LABELS[kind]} anlegen`}
      description="Neues Ausstattungsstück mit Karte im Board"
      footer={
        <AsyncButton
          type="button"
          className="h-11 w-full"
          isLoading={saving}
          loadingText="Legt an …"
          disabled={!title.trim()}
          onClick={save}
        >
          Anlegen
        </AsyncButton>
      }
    >
      <div className="space-y-4">
        {kinds.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {kinds.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={kind === value}
                onClick={() => setKind(value)}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm",
                  kind === value
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {OBJECT_KIND_LABELS[value]}
              </button>
            ))}
          </div>
        ) : null}
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Bezeichnung</span>
          <input
            className={inputClass}
            value={title}
            autoFocus
            maxLength={OBJECT_TEXT_LIMITS.title}
            placeholder={
              kind === "costume"
                ? "z. B. Fogg – Reiseanzug"
                : kind === "costume_part"
                  ? "z. B. Zylinder schwarz"
                  : kind === "set_piece"
                    ? "z. B. Clubsessel"
                    : "z. B. Taschenuhr"
            }
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && title.trim()) void save();
            }}
          />
        </label>
        {stage.scenes.length && kind !== "costume_part" ? (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">In Szenen</span>
            <div className="flex flex-wrap gap-1.5">
              {stage.scenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  aria-pressed={sceneIds.includes(scene.id)}
                  title={fullScene(scene)}
                  onClick={() => toggleScene(scene.id)}
                  className={cn(
                    "h-9 min-w-11 rounded-full border px-3 text-sm tabular-nums",
                    sceneIds.includes(scene.id)
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {shortScene(scene)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Beschreibung, Fotos, Rollen und Herkunft ergänzt du danach auf der Seite des Objekts.
        </p>
      </div>
    </ResponsivePanel>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/** Unteransichten einer Verwaltungsseite als Links (`?ansicht=…&teil=…`). */
export function SubViews<T extends string>({
  basePath,
  view,
  current,
  options,
}: {
  basePath: string;
  view: string;
  current: T;
  options: { value: T; label: string }[];
}) {
  return (
    <nav
      aria-label="Teilansicht"
      className="flex w-full gap-0.5 rounded-lg border border-border p-0.5 sm:inline-flex sm:w-auto"
    >
      {options.map((option, index) => {
        const active = option.value === current;
        return (
          <Link
            key={option.value}
            href={`${basePath}?ansicht=${view}${index === 0 ? "" : `&teil=${option.value}`}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center whitespace-nowrap rounded-md px-2 text-sm sm:flex-none sm:px-3",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
