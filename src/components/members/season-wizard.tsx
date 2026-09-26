"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { LockIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

const CONFIGURABLE_ROLES: Role[] = ["admin", "board", "finance", "tech", "cast", "member"];

type Candidate = { id: string; name: string | null; email: string | null };

function Step({
  number,
  title,
  done,
  active,
  children,
}: {
  number: number;
  title: string;
  done?: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : done
              ? "border-primary/50 text-primary"
              : "border-border text-muted-foreground",
        )}
        aria-hidden
      >
        {number}
      </span>
      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        <h3 className={cn("font-semibold", !active && !done && "text-muted-foreground")}>
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

/**
 * Saisonwechsel als geführter Ablauf: 1. Rollen festlegen, die aktiv bleiben,
 * 2. Vorschau prüfen und Einzelne ausnehmen, 3. ausführen.
 */
export function SeasonWizard({ initialProtectedRoles }: { initialProtectedRoles: Role[] }) {
  const router = useRouter();
  const [protectedRoles, setProtectedRoles] = useState<Set<Role>>(
    () => new Set(initialProtectedRoles),
  );
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [keep, setKeep] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggleRole = async (role: Role) => {
    const next = new Set(protectedRoles);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    setProtectedRoles(next);
    // Andere Rollen ändern die Vorschau – neu laden lassen.
    setCandidates(null);
    const response = await fetch("/api/season-reset/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protectedRoles: CONFIGURABLE_ROLES.filter((r) => next.has(r)) }),
    });
    if (!response.ok) {
      setProtectedRoles(protectedRoles);
      toast.error("Geschützte Rollen konnten nicht gespeichert werden");
    }
  };

  const loadPreview = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/season-reset/deactivation");
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        candidates?: Candidate[];
      };
      if (!response.ok) throw new Error(data.error ?? "Vorschau konnte nicht geladen werden");
      setCandidates(data.candidates ?? []);
      setKeep(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  const toggleKeep = (id: string) =>
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const affectedCount = candidates ? candidates.length - keep.size : 0;
  const term = filter.trim().toLowerCase();
  const visibleCandidates = (candidates ?? []).filter(
    (c) => !term || `${c.name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(term),
  );

  const execute = async () => {
    setConfirmOpen(false);
    setRunning(true);
    try {
      const response = await fetch("/api/season-reset/deactivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, keepUserIds: Array.from(keep) }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        deactivated?: number;
      };
      if (!response.ok) throw new Error(data.error ?? "Saisonabschluss fehlgeschlagen");
      toast.success(`${data.deactivated ?? 0} Mitglieder wurden deaktiviert.`);
      setCandidates(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unbekannter Fehler");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Nach dem Ende einer Saison werden alle deaktiviert, die in keiner geplanten oder aktiven
        Produktion sind. Wer zurückkommt, wird über einen Einladungslink wieder aktiv. Der Wechsel
        der Produktion allein deaktiviert niemanden.
      </p>
      <ol className="rounded-lg border bg-card p-4 sm:p-6">
        <Step
          number={1}
          title="Welche Rollen bleiben immer aktiv?"
          active={candidates === null}
          done
        >
          <div className="flex flex-wrap gap-2" role="group" aria-label="Geschützte Rollen">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm text-primary">
              <LockIcon className="size-3" aria-hidden />
              {ROLE_LABELS.owner}
            </span>
            {CONFIGURABLE_ROLES.map((role) => {
              const on = protectedRoles.has(role);
              return (
                <button
                  key={role}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void toggleRole(role)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {ROLE_LABELS[role]}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Antippen schaltet um, Änderungen werden sofort gespeichert.
          </p>
        </Step>

        <Step
          number={2}
          title="Vorschau: Wer wird deaktiviert?"
          active={candidates !== null && !confirmOpen}
          done={candidates !== null}
        >
          {candidates === null ? (
            <AsyncButton
              variant="outline"
              onClick={loadPreview}
              isLoading={loading}
              loadingText="Lade Vorschau …"
            >
              Vorschau anzeigen
            </AsyncButton>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Niemand – alle aktiven Mitglieder haben eine geschützte Rolle oder sind in einer
              laufenden Produktion.
            </p>
          ) : (
            <>
              <p className="text-sm">
                <strong>{affectedCount}</strong> von {candidates.length} werden deaktiviert. Haken
                setzen, um jemanden aktiv zu lassen.
              </p>
              {candidates.length > 8 ? (
                <Input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Namen suchen"
                  aria-label="Vorschau durchsuchen"
                />
              ) : null}
              <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
                {visibleCandidates.map((candidate) => {
                  const id = `season-keep-${candidate.id}`;
                  return (
                    <li key={candidate.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        id={id}
                        checked={keep.has(candidate.id)}
                        onCheckedChange={() => toggleKeep(candidate.id)}
                      />
                      <label htmlFor={id} className="min-w-0 flex-1 text-sm">
                        <span className="block truncate">
                          {candidate.name ?? candidate.email ?? candidate.id}
                        </span>
                        {candidate.name && candidate.email ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {candidate.email}
                          </span>
                        ) : null}
                      </label>
                      {keep.has(candidate.id) ? (
                        <span className="text-xs text-primary">bleibt aktiv</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Step>

        <Step number={3} title="Saison abschließen" active={false}>
          <div className="flex flex-wrap gap-2">
            <AsyncButton
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              isLoading={running}
              loadingText="Deaktiviere …"
              disabled={!candidates || affectedCount === 0}
            >
              {candidates ? `${affectedCount} Mitglieder deaktivieren` : "Erst Vorschau prüfen"}
            </AsyncButton>
            {candidates ? (
              <Button variant="ghost" onClick={() => setCandidates(null)} disabled={running}>
                Abbrechen
              </Button>
            ) : null}
          </div>
        </Step>
      </ol>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Saison wirklich abschließen?"
        description={`${affectedCount} Mitglieder werden deaktiviert und abgemeldet. Rückkehrer aktivierst du später über einen Einladungslink.`}
        confirmLabel="Deaktivieren"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={execute}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
