"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

type PhotoConsentAction = "approve" | "reject" | "reset";

type PendingEntry = PhotoConsentAdminEntry & { status: "pending" };
type ProcessedEntry = PhotoConsentAdminEntry & { status: "approved" | "rejected" };

type ActionHandler = (id: string, action: PhotoConsentAction) => void | Promise<void>;

type StatusFilter = "all" | PhotoConsentAdminEntry["status"];

const pendingHighlightClasses: Record<PendingEntry["status"], string> = {
  pending:
    "border-l-4 border-amber-400/80 bg-amber-400/10 dark:border-amber-300/60 dark:bg-amber-400/15",
};

const processedCardAccent: Record<ProcessedEntry["status"], string> = {
  approved: "border-emerald-500/30 bg-emerald-500/5 dark:border-emerald-500/40 dark:bg-emerald-500/10",
  rejected: "border-red-500/35 bg-red-500/5 dark:border-red-500/40 dark:bg-red-500/10",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Alle" },
  { value: "pending", label: "Offen" },
  { value: "approved", label: "Freigegeben" },
  { value: "rejected", label: "Abgelehnt" },
];

function formatWithFormatter(
  value: string | null | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return formatter.format(date);
}

function formatDate(value: string | null | undefined) {
  return formatWithFormatter(value, dateFormatter);
}

function formatDateTime(value: string | null | undefined) {
  return formatWithFormatter(value, dateTimeFormatter);
}

type DocumentPreviewProps = {
  previewUrl: string | null;
  documentName: string | null;
};

function DocumentPreview({ previewUrl, documentName }: DocumentPreviewProps) {
  if (!previewUrl) {
    return null;
  }
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dokumentvorschau</p>
      <div className="relative h-60 w-full overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm">
        <Image
          src={previewUrl}
          alt={documentName ? `Dokumentvorschau: ${documentName}` : "Digitale Unterschrift"}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 420px"
          className="object-contain bg-white"
          unoptimized
        />
      </div>
    </div>
  );
}

function isPendingEntry(entry: PhotoConsentAdminEntry): entry is PendingEntry {
  return entry.status === "pending";
}

function isProcessedEntry(entry: PhotoConsentAdminEntry): entry is ProcessedEntry {
  return entry.status === "approved" || entry.status === "rejected";
}

export function PhotoConsentAdminPanel() {
  const [entries, setEntries] = useState<PhotoConsentAdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const allPendingEntries = useMemo(() => entries.filter(isPendingEntry), [entries]);
  const allProcessedEntries = useMemo(() => entries.filter(isProcessedEntry), [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const parts: string[] = [
        entry.name ?? "",
        entry.email ?? "",
        entry.approvedByName ?? "",
        entry.documentName ?? "",
        entry.rejectionReason ?? "",
        entry.exclusionNote ?? "",
        entry.userId,
        entry.submittedAt,
        entry.updatedAt,
        entry.approvedAt ?? "",
        entry.dateOfBirth ?? "",
      ];

      if (entry.age !== null && entry.age !== undefined) {
        parts.push(String(entry.age));
      }

      const formattedBirthDate = formatDate(entry.dateOfBirth);
      if (formattedBirthDate) {
        parts.push(formattedBirthDate);
      }

      const haystack = parts.join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [entries, normalizedSearch, statusFilter]);

  const pendingEntries = useMemo(() => filteredEntries.filter(isPendingEntry), [filteredEntries]);
  const processedEntries = useMemo(() => filteredEntries.filter(isProcessedEntry), [filteredEntries]);

  const hasEntries = entries.length > 0;
  const hasFilteredEntries = filteredEntries.length > 0;

  const handleAction = useCallback(
    async (id: string, action: PhotoConsentAction) => {
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
    const rejected = allProcessedEntries.filter((entry) => entry.status === "rejected").length;
    const missingBirthdays = entries.filter((entry) => entry.requiresDateOfBirth).length;
    return { pending: allPendingEntries.length, rejected, missingBirthdays };
  }, [allPendingEntries, allProcessedEntries, entries]);

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
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Nach Namen, E-Mail oder Details suchen"
                aria-label="Fotoeinverständnisse durchsuchen"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={statusFilter === filter.value ? "default" : "outline"}
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    "transition-shadow",
                    statusFilter === filter.value ? "shadow-sm" : undefined,
                  )}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>

        <div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade Einträge …</p>
          ) : !hasEntries ? (
            <p className="text-sm text-muted-foreground">Bisher liegen keine Fotoeinverständnisse vor.</p>
          ) : !hasFilteredEntries ? (
            <p className="text-sm text-muted-foreground">
              Keine Fotoeinverständnisse entsprechen deiner Suche oder Filterung.
            </p>
          ) : (
            <div className="space-y-8">
              {pendingEntries.length > 0 && (
                <section className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
                      Offene Fotoeinverständnisse
                    </h3>
                    <p className="text-xs text-foreground/60">
                      Diese Personen warten auf eine Entscheidung oder benötigen zusätzliche Unterlagen.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {pendingEntries.map((entry) => (
                      <PendingEntryCard
                        key={entry.id}
                        entry={entry}
                        onAction={handleAction}
                        processing={processing}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/70">
                    Abgeschlossene Einträge
                  </h3>
                  <p className="text-xs text-foreground/60">
                    Kompakte Übersicht über freigegebene oder gesperrte Fotoeinverständnisse.
                  </p>
                </div>

                {processedEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Noch keine freigegebenen oder abgelehnten Einverständnisse vorhanden.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {processedEntries.map((entry) => (
                      <ProcessedEntryCard
                        key={entry.id}
                        entry={entry}
                        onAction={handleAction}
                        processing={processing}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-4 text-center shadow-sm">
          <Button
            type="button"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="min-w-[10rem]"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {loading ? "Aktualisiere …" : "Aktualisieren"}
          </Button>
          <p className="mt-2 text-xs text-primary/80">
            Synchronisiere neue Einreichungen oder aktualisierte Entscheidungen.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type PendingEntryCardProps = {
  entry: PendingEntry;
  onAction: ActionHandler;
  processing: string | null;
};

function PendingEntryCard({ entry, onAction, processing }: PendingEntryCardProps) {
  const statusLabel = statusLabels[entry.status];
  const formattedBirthDate = formatDate(entry.dateOfBirth);
  const submittedAt = formatDateTime(entry.submittedAt) ?? "unbekannt";
  const updatedAt = formatDateTime(entry.updatedAt) ?? "unbekannt";
  const documentUploadedAt = formatDateTime(entry.documentUploadedAt);

  const hints: Array<{ key: string; tone: "warning" | "error"; message: string }> = [];
  if (entry.rejectionReason) {
    hints.push({ key: "rejection", tone: "error", message: `Letzte Ablehnung: ${entry.rejectionReason}` });
  }
  if (entry.requiresDateOfBirth) {
    hints.push({ key: "dob", tone: "warning", message: "Geburtsdatum fehlt. Bitte nachreichen lassen." });
  }
  if (!entry.hasDocument && entry.requiresDocument) {
    hints.push({
      key: "document",
      tone: "warning",
      message: "Dokument wird benötigt, bevor freigegeben werden kann.",
    });
  }

  const allRequirementsMet = hints.length === 0;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 p-4 shadow-sm transition-shadow supports-[backdrop-filter]:backdrop-blur-sm hover:shadow-md",
        pendingHighlightClasses[entry.status],
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{entry.name ?? entry.email ?? "Unbekannt"}</div>
          {entry.email && <div className="text-xs text-foreground/60">{entry.email}</div>}
        </div>
        <Badge variant={statusVariants[entry.status]}>{statusLabel}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary" className="bg-background/70 text-foreground/80 dark:bg-background/40">
          {entry.requiresDocument ? "Minderjährig" : "Volljährig"}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "border-border/60 text-foreground/70",
            entry.hasDocument
              ? "border-emerald-500/50 text-emerald-600 dark:border-emerald-500/60 dark:text-emerald-300"
              : "border-amber-400/70 text-amber-700 dark:border-amber-300/80 dark:text-amber-200",
          )}
        >
          {entry.hasDocument ? "Dokument vorhanden" : "Dokument fehlt"}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "border-border/60 text-foreground/70",
            entry.requiresDateOfBirth
              ? "border-amber-400/70 text-amber-700 dark:border-amber-300/80 dark:text-amber-200"
              : "border-emerald-500/50 text-emerald-600 dark:border-emerald-500/60 dark:text-emerald-300",
          )}
        >
          {entry.requiresDateOfBirth
            ? "Geburtsdatum benötigt"
            : `Geburtsdatum: ${formattedBirthDate ?? "vorhanden"}`}
        </Badge>
        {entry.age !== null && (
          <Badge variant="outline" className="border-border/60 text-foreground/70">
            {entry.age} Jahre
          </Badge>
        )}
      </div>

      <div className="mt-4 grid gap-3 text-xs text-foreground/70 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-1">
          <div>Eingegangen: {submittedAt}</div>
          <div>Aktualisiert: {updatedAt}</div>
          {entry.exclusionNote && (
            <div className="rounded-md border border-border/60 bg-background/60 p-2 text-foreground/80">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Ausschlüsse
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{entry.exclusionNote}</p>
            </div>
          )}
          {entry.documentName && (
            <div>
              Dokument: {entry.documentName}
              {documentUploadedAt && ` · hochgeladen ${documentUploadedAt}`}
              {entry.documentUrl && (
                <>
                  {" "}
                  <a className="underline" href={entry.documentUrl} target="_blank" rel="noreferrer">
                    öffnen
                  </a>
                </>
              )}
            </div>
          )}
          <DocumentPreview previewUrl={entry.documentPreviewUrl} documentName={entry.documentName} />
        </div>
        <div className="space-y-2">
          {allRequirementsMet ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-600 dark:border-emerald-500/40 dark:text-emerald-200">
              Alle Anforderungen erfüllt. Du kannst freigeben.
            </div>
          ) : (
            <ul className="space-y-2">
              {hints.map((hint) => (
                <li
                  key={hint.key}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    hint.tone === "error"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-amber-400/60 bg-amber-400/10 text-amber-700 dark:border-amber-300/70 dark:text-amber-200",
                  )}
                >
                  {hint.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void onAction(entry.id, "approve")} disabled={processing === entry.id}>
          Freigeben
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void onAction(entry.id, "reset")}
          disabled={processing === entry.id}
        >
          Zurücksetzen
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => void onAction(entry.id, "reject")}
          disabled={processing === entry.id}
        >
          Ablehnen
        </Button>
      </div>
    </div>
  );
}

type ProcessedEntryCardProps = {
  entry: ProcessedEntry;
  onAction: ActionHandler;
  processing: string | null;
};

function ProcessedEntryCard({ entry, onAction, processing }: ProcessedEntryCardProps) {
  const statusLabel = statusLabels[entry.status];
  const formattedBirthDate = formatDate(entry.dateOfBirth);
  const updatedAt = formatDateTime(entry.updatedAt) ?? "unbekannt";
  const approvedAt = formatDateTime(entry.approvedAt);

  const permissionBadge = entry.status === "approved"
    ? {
        label: "Fotos & Veröffentlichung erlaubt",
        className:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/40 dark:text-emerald-200",
      }
    : {
        label: "Keine Fotoveröffentlichung erlaubt",
        className: "border-red-500/40 bg-red-500/10 text-red-600 dark:border-red-500/40 dark:text-red-200",
      };

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-lg border border-border/60 p-4 shadow-sm transition-shadow supports-[backdrop-filter]:backdrop-blur-sm hover:shadow-md",
        processedCardAccent[entry.status],
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">{entry.name ?? entry.email ?? "Unbekannt"}</div>
            {entry.email && <div className="text-xs text-foreground/60">{entry.email}</div>}
          </div>
          <Badge variant={statusVariants[entry.status]}>{statusLabel}</Badge>
        </div>

        <Badge variant="outline" className={cn("text-xs", permissionBadge.className)}>
          {permissionBadge.label}
        </Badge>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="border-border/60 text-foreground/70">
            {entry.requiresDocument ? "Minderjährig" : "Volljährig"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "border-border/60 text-foreground/70",
              entry.hasDocument
                ? "border-emerald-500/50 text-emerald-600 dark:border-emerald-500/60 dark:text-emerald-300"
                : "border-amber-400/70 text-amber-700 dark:border-amber-300/80 dark:text-amber-200",
            )}
          >
            {entry.hasDocument ? "Dokument vorhanden" : "Dokument fehlt"}
          </Badge>
          {formattedBirthDate ? (
            <Badge variant="outline" className="border-border/60 text-foreground/70">
              Geburtsdatum: {formattedBirthDate}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-400/70 text-amber-700 dark:border-amber-300/80 dark:text-amber-200"
            >
              Geburtsdatum fehlt
            </Badge>
          )}
        </div>

      <div className="space-y-2 text-xs text-foreground/70">
        <div>Aktualisiert: {updatedAt}</div>
        {approvedAt && <div>Freigegeben am {approvedAt}</div>}
        {entry.approvedByName && <div>Bearbeitet durch {entry.approvedByName}</div>}
        {entry.rejectionReason && <div className="text-destructive">Grund: {entry.rejectionReason}</div>}
        {entry.exclusionNote && (
          <div className="rounded-md border border-border/60 bg-background/60 p-2 text-foreground/80">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Ausschlüsse
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{entry.exclusionNote}</p>
          </div>
        )}
        {entry.documentName && (
          <div>
            Dokument: {entry.documentName}
            {entry.documentUrl && (
              <>
                {" "}
                <a className="underline" href={entry.documentUrl} target="_blank" rel="noreferrer">
                  öffnen
                </a>
              </>
            )}
          </div>
        )}
        <DocumentPreview previewUrl={entry.documentPreviewUrl} documentName={entry.documentName} />
      </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void onAction(entry.id, "reset")}
          disabled={processing === entry.id}
        >
          Zurücksetzen
        </Button>
        {entry.status === "approved" ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void onAction(entry.id, "reject")}
            disabled={processing === entry.id}
          >
            Ablehnen
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => void onAction(entry.id, "approve")}
            disabled={processing === entry.id}
          >
            Freigeben
          </Button>
        )}
      </div>
    </div>
  );
}
