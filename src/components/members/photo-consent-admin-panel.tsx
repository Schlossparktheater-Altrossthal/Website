"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PhotoConsentAdminEntry } from "@/types/photo-consent";

const statusLabels: Record<PhotoConsentAdminEntry["status"], string> = {
  pending: "In Prüfung",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

const statusVariants: Record<PhotoConsentAdminEntry["status"], "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return dateFormatter.format(date);
}

export function PhotoConsentAdminPanel() {
  const [entries, setEntries] = useState<PhotoConsentAdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/photo-consents/admin", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Einträge konnten nicht geladen werden");
        return;
      }
      setEntries(Array.isArray(data?.entries) ? (data.entries as PhotoConsentAdminEntry[]) : []);
    } catch {
      setError("Netzwerkfehler beim Laden der Einträge");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasEntries = entries.length > 0;

  const handleAction = useCallback(
    async (id: string, action: "approve" | "reject" | "reset") => {
      let reason: string | undefined;
      if (action === "reject") {
        const entered = window.prompt("Bitte Ablehnungsgrund eingeben:");
        if (!entered) {
          return;
        }
        reason = entered.trim();
        if (!reason) {
          toast.error("Ablehnungsgrund darf nicht leer sein");
          return;
        }
      }

      setProcessing(id);
      try {
        const response = await fetch("/api/photo-consents/admin", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, reason }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          toast.error(data?.error ?? "Aktion fehlgeschlagen");
          return;
        }
        const entry = data?.entry as PhotoConsentAdminEntry | undefined;
        if (entry) {
          setEntries((prev) => prev.map((item) => (item.id === entry.id ? entry : item)));
        }
        const message =
          action === "approve"
            ? "Fotoeinverständnis freigegeben"
            : action === "reject"
            ? "Fotoeinverständnis abgelehnt"
            : "Status zurückgesetzt";
        toast.success(message);
      } catch {
        toast.error("Netzwerkfehler bei der Aktion");
      } finally {
        setProcessing(null);
      }
    },
    [],
  );

  const summary = useMemo(() => {
    const pending = entries.filter((entry) => entry.status === "pending").length;
    const rejected = entries.filter((entry) => entry.status === "rejected").length;
    const missingBirthdays = entries.filter((entry) => entry.requiresDateOfBirth).length;
    return { pending, rejected, missingBirthdays };
  }, [entries]);

  return (
    <Card className="border border-border/70 bg-background">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Fotoeinverständnisse verwalten</CardTitle>
          <p className="text-sm text-foreground/70">
            Prüfe eingereichte Zustimmungen, bestätige sie oder fordere zusätzliche Unterlagen an.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          <Badge variant="secondary">Wartend: {summary.pending}</Badge>
          <Badge variant="outline">Fehlende Geburtsdaten: {summary.missingBirthdays}</Badge>
          <Badge variant="destructive">Abgelehnt: {summary.rejected}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            Aktualisieren
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Lade Einträge …</p>
        ) : !hasEntries ? (
          <p className="text-sm text-muted-foreground">Bisher liegen keine Fotoeinverständnisse vor.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Mitglied</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Anforderungen</th>
                  <th className="px-3 py-2 text-left font-medium">Zeitleiste</th>
                  <th className="px-3 py-2 text-left font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {entries.map((entry) => {
                  const statusLabel = statusLabels[entry.status];
                  return (
                    <tr key={entry.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-foreground">
                          {entry.name ?? entry.email ?? "Unbekannt"}
                        </div>
                        {entry.email && <div className="text-xs text-foreground/60">{entry.email}</div>}
                        <div className="mt-1 space-y-1 text-xs text-foreground/60">
                          <div>
                            Geburtsdatum: {formatDate(entry.dateOfBirth) ?? "unbekannt"}
                            {entry.age !== null ? ` (${entry.age} Jahre)` : ""}
                          </div>
                          {entry.documentName && (
                            <div>
                              Dokument: {entry.documentName}
                              {entry.documentUploadedAt && ` · hochgeladen ${formatDate(entry.documentUploadedAt)}`}
                              {entry.documentUrl && (
                                <>
                                  {" "}
                                  <a
                                    className="underline"
                                    href={entry.documentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    öffnen
                                  </a>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={statusVariants[entry.status]}>{statusLabel}</Badge>
                      </td>
                      <td className="px-3 py-3 text-xs text-foreground/70">
                        <ul className="space-y-1">
                          <li>{entry.requiresDocument ? "Minderjährig" : "Volljährig"}</li>
                          <li>{entry.requiresDateOfBirth ? "Geburtsdatum fehlt" : "Geburtsdatum vorhanden"}</li>
                          <li>{entry.hasDocument ? "Dokument vorhanden" : "Kein Dokument"}</li>
                        </ul>
                      </td>
                      <td className="px-3 py-3 text-xs text-foreground/70">
                        <div>Eingegangen: {formatDate(entry.submittedAt)}</div>
                        <div>Aktualisiert: {formatDate(entry.updatedAt)}</div>
                        {entry.approvedAt && <div>Freigabe: {formatDate(entry.approvedAt)}</div>}
                        {entry.approvedByName && <div>Durch: {entry.approvedByName}</div>}
                        {entry.rejectionReason && (
                          <div className="mt-1 text-destructive">Grund: {entry.rejectionReason}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => void handleAction(entry.id, "approve")}
                            disabled={processing === entry.id}
                          >
                            Freigeben
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleAction(entry.id, "reset")}
                            disabled={processing === entry.id}
                          >
                            Zurücksetzen
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleAction(entry.id, "reject")}
                            disabled={processing === entry.id}
                          >
                            Ablehnen
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
