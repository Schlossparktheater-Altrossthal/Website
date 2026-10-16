"use client";

import { CheckIcon } from "@/components/ui/action-icons";
import {
  READINESS_LABEL,
  READINESS_ORDER,
  countReadiness,
  describeAbsence,
  describeReadiness,
  firstName,
  plannableScenes,
  type SceneReadiness,
  type SceneReadinessStatus,
} from "@/lib/calendar/scene-readiness";
import { cn } from "@/lib/utils";

const DOT: Record<SceneReadinessStatus, string> = {
  ready: "bg-success",
  alternate: "bg-info",
  limited: "bg-warning",
  missing: "bg-destructive",
};

const TEXT: Record<SceneReadinessStatus, string> = {
  ready: "text-success",
  alternate: "text-info",
  limited: "text-warning",
  missing: "text-destructive",
};

export function ReadinessDot({
  status,
  className,
}: {
  status: SceneReadinessStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", DOT[status], className)}
    />
  );
}

/** Kurzer Hinweistext einer Szene in Zustandsfarbe; leer, wenn sie vollständig ist. */
export function ReadinessHint({ entry }: { entry: SceneReadiness | undefined }) {
  if (!entry || entry.status === "ready") return null;
  return (
    <p className={cn("flex min-w-0 items-center gap-1.5 text-xs", TEXT[entry.status])}>
      <ReadinessDot status={entry.status} />
      <span className="truncate">{describeReadiness(entry)}</span>
    </p>
  );
}

/** „6 vollständig · 2 mit Zweitbesetzung · 1 fehlt jemand“ – nur planbare Szenen. */
export function ReadinessSummary({ entries }: { entries: readonly SceneReadiness[] }) {
  const counts = countReadiness(plannableScenes(entries));
  const uncast = entries.length - plannableScenes(entries).length;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {READINESS_ORDER.filter((status) => counts[status]).map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5 tabular-nums">
          <ReadinessDot status={status} />
          {counts[status]} {READINESS_LABEL[status]}
        </span>
      ))}
      {uncast ? <span className="tabular-nums">{uncast} nicht besetzt</span> : null}
    </span>
  );
}

const shorten = (text: string, max = 24) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/**
 * Rollen einer Szene in einer Zeile: „Oberon · Titania · Puck“. Probleme in Zustandsfarbe mit
 * Person und Grund, z. B. „Theseus fehlt (Peter: Urlaub)“, Zweitbesetzung „Helena: Emma“.
 */
export function SceneCastLine({ entry, className }: { entry: SceneReadiness; className?: string }) {
  const issues = new Map(entry.issues.map((issue) => [issue.characterId, issue]));
  const title = entry.roles
    .map((role) => `${role.characterName}: ${role.player?.name ?? "–"}`)
    .join("\n");
  if (!entry.roles.length) return null;
  // Probleme zuerst – sie entscheiden, ob die Szene geht.
  const roles = [...entry.roles].sort(
    (a, b) => Number(issues.has(b.characterId)) - Number(issues.has(a.characterId)),
  );
  return (
    <p className={cn("text-xs text-muted-foreground", className)} title={title}>
      {roles.map((role, index) => {
        const issue = issues.get(role.characterId);
        let text = role.short;
        if (issue?.status === "alternate" && issue.substitute)
          text = `${role.short}: ${firstName(issue.substitute.name)}`;
        else if (issue) {
          const who = issue.absent
            .map(
              (person) => `${firstName(person.name)}: ${shorten(describeAbsence(person.absence))}`,
            )
            .join(", ");
          text = `${role.short} ${issue.status === "limited" ? "eingeschränkt" : "fehlt"}${who ? ` (${who})` : ""}`;
        }
        return (
          <span key={role.characterId}>
            {index ? " · " : ""}
            <span className={cn(issue && cn("font-medium", TEXT[issue.status]))}>{text}</span>
          </span>
        );
      })}
    </p>
  );
}

/**
 * Szenen eines Tages, nach Probbarkeit sortiert, je eine kompakte Zeile mit Rollen. Szenen mit
 * unbesetzten Rollen stehen eingeklappt am Ende. Mit `onAdd` lässt sich jede Szene an-/abhaken.
 */
export function SceneReadinessList({
  entries,
  selectedIds,
  onAdd,
  onRemove,
  durations,
  className,
}: {
  entries: readonly SceneReadiness[];
  selectedIds?: readonly string[];
  onAdd?: (sceneId: string) => void;
  /** Mit `onRemove` lässt sich eine gewählte Szene wieder abwählen (Auswahl statt Ablauf). */
  onRemove?: (sceneId: string) => void;
  /** Dauer je Szene in Minuten. */
  durations?: ReadonlyMap<string, number | null | undefined>;
  className?: string;
}) {
  const plannable = READINESS_ORDER.flatMap((status) =>
    entries.filter((entry) => entry.fullyCast && entry.status === status),
  );
  const uncast = entries.filter((entry) => !entry.fullyCast);
  return (
    <div className={cn("space-y-2", className)}>
      {plannable.length ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {plannable.map((entry) => {
            const selected = selectedIds?.includes(entry.sceneId) ?? false;
            const toggleable = Boolean(onAdd && (!selected || onRemove));
            const minutes = durations?.get(entry.sceneId);
            const content = (
              <>
                {onAdd ? (
                  selected && !onRemove ? (
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    // Nur Optik: die ganze Zeile ist der Knopf (kein Knopf im Knopf).
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                        selected && "bg-primary text-primary-foreground",
                      )}
                    >
                      {selected ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                    </span>
                  )
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <ReadinessDot status={entry.status} />
                    <span className="truncate">{entry.label}</span>
                    {minutes ? (
                      <span className="ml-auto shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
                        {minutes}&apos;
                      </span>
                    ) : null}
                  </span>
                  <SceneCastLine entry={entry} className="pl-3.5" />
                </span>
              </>
            );
            return (
              <li key={entry.sceneId}>
                {toggleable ? (
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${entry.label} ${selected ? "abwählen" : "auswählen"}`}
                    onClick={() => (selected ? onRemove?.(entry.sceneId) : onAdd?.(entry.sceneId))}
                    className="flex min-h-11 w-full items-start gap-2.5 px-3 py-1.5 text-left hover:bg-muted/50"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex min-h-11 items-start gap-2.5 px-3 py-1.5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Szene vollständig besetzt.</p>
      )}
      <UncastScenes entries={uncast} />
    </div>
  );
}

/** Eingeklappt: Szenen, deren Rollen noch niemand spielt – zum Nachholen der Besetzung. */
export function UncastScenes({ entries }: { entries: readonly SceneReadiness[] }) {
  if (!entries.length) return null;
  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="cursor-pointer list-none py-1 hover:text-foreground">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span>{" "}
        {entries.length} {entries.length === 1 ? "Szene" : "Szenen"} noch nicht besetzt
      </summary>
      <ul className="mt-1 space-y-0.5 pl-3">
        {entries.map((entry) => (
          <li key={entry.sceneId}>
            <span className="text-foreground">{entry.label}</span>
            {" – "}
            {entry.uncast.length ? `ohne: ${entry.uncast.join(", ")}` : "keine Rollen eingetragen"}
          </li>
        ))}
      </ul>
    </details>
  );
}
