"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Candidate = { id: string; name: string | null; email: string | null };

export function SeasonCloseoutPanel() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [keep, setKeep] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/season-reset/deactivation");
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        candidates?: Candidate[];
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Vorschau konnte nicht geladen werden");
      }
      setCandidates(data.candidates ?? []);
      setKeep(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  const toggleKeep = (id: string) => {
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const affectedCount = candidates ? candidates.length - keep.size : 0;

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
      if (!response.ok) {
        throw new Error(data.error ?? "Saisonabschluss fehlgeschlagen");
      }
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
    <Card>
      <CardHeader>
        <CardTitle>Saison abschließen</CardTitle>
        <p className="text-sm text-muted-foreground">
          Deaktiviert alle Mitglieder ohne geschützte Rolle. Der Wechsel der aktiven Produktion
          deaktiviert niemanden mehr – das passiert nur hier. Rückkehrer werden über einen
          Einladungslink wieder aktiviert.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
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
            Es gibt keine aktiven Mitglieder ohne geschützte Rolle.
          </p>
        ) : (
          <>
            <p className="text-sm">
              {affectedCount} von {candidates.length} Mitgliedern werden deaktiviert. Häkchen
              setzen, um jemanden aktiv zu lassen.
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-border p-3">
              {candidates.map((candidate) => {
                const checkboxId = `season-keep-${candidate.id}`;
                return (
                  <li key={candidate.id} className="flex items-center gap-3">
                    <Checkbox
                      id={checkboxId}
                      checked={keep.has(candidate.id)}
                      onCheckedChange={() => toggleKeep(candidate.id)}
                    />
                    <label htmlFor={checkboxId} className="text-sm">
                      {candidate.name ?? candidate.email ?? candidate.id}
                      {candidate.name && candidate.email ? (
                        <span className="text-muted-foreground"> · {candidate.email}</span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <AsyncButton
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                isLoading={running}
                loadingText="Deaktiviere …"
                disabled={affectedCount === 0}
              >
                {affectedCount} Mitglieder deaktivieren
              </AsyncButton>
              <Button variant="outline" onClick={() => setCandidates(null)} disabled={running}>
                Abbrechen
              </Button>
            </div>
          </>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Saison wirklich abschließen?"
        description={`${affectedCount} Mitglieder werden deaktiviert und abgemeldet.`}
        confirmLabel="Deaktivieren"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={execute}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  );
}
