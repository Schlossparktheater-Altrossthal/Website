"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { BreakdownStatus, CharacterCastingType } from "@prisma/client";
import { toast } from "sonner";

import { ChevronRightIcon, MapPinIcon, StarIcon } from "@/components/ui/action-icons";
import type { RolesScenesData, RsRole, RsScene } from "@/lib/produktionen/roles-scenes";
import { cn } from "@/lib/utils";

export type Result = { ok: boolean; error?: string };

export const CAST_LABELS: Record<CharacterCastingType, string> = {
  primary: "Haupt",
  alternate: "Zweit",
  cover: "Cover",
  cameo: "Cameo",
};

export const STATUS_LABELS: Record<BreakdownStatus, string> = {
  planned: "Geplant",
  in_progress: "In Arbeit",
  blocked: "Blockiert",
  ready: "Bereit",
  done: "Erledigt",
};

export const BREAKDOWN_STATUSES: BreakdownStatus[] = [
  "planned",
  "in_progress",
  "blocked",
  "ready",
  "done",
];

export const STATUS_TONE: Record<BreakdownStatus, string> = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-info/15 text-info",
  blocked: "bg-destructive/10 text-destructive",
  ready: "bg-success/15 text-success",
  done: "bg-success/15 text-success",
};

export const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

export function sceneLabel(scene: Pick<RsScene, "identifier">) {
  return scene.identifier ?? "–";
}

export function useRun() {
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

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{children}</p>;
}

export function RoleDot({
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

export function RoleRow({
  role,
  meta,
  onOpen,
}: {
  role: RsRole;
  /** Rechts: Szenen, Bühnenzeit, Rollengröße. */
  meta: React.ReactNode;
  onOpen: () => void;
}) {
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
        <span className="shrink-0 text-right text-xs text-muted-foreground">{meta}</span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

export function SceneRow({
  scene,
  data,
  onOpen,
  controls,
  dragHandle,
}: {
  scene: RsScene;
  data: RolesScenesData;
  onOpen: () => void;
  /** Z. B. Hoch/Runter-Knöpfe rechts neben der Zeile. */
  controls?: React.ReactNode;
  dragHandle?: React.ReactNode;
}) {
  const roles = scene.roles.flatMap((entry) => {
    const role = data.roles.find((item) => item.id === entry.characterId);
    return role ? [{ role, featured: entry.featured }] : [];
  });
  const blocked = scene.breakdown.filter((item) => item.status === "blocked").length;
  const open = scene.breakdown.filter((item) => item.status !== "done" && item.status !== "ready");
  return (
    <div className="flex min-w-0 items-stretch rounded-xl border border-border bg-card">
      {dragHandle}
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/40"
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
        {controls ? null : (
          <ChevronRightIcon className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      {controls}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border/60 pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function ToggleChip({
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

/** „42 Min.“ bzw. „1 Std. 12 Min.“ */
export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} Min.`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} Std. ${rest} Min.` : `${minutes / 60} Std.`;
}
