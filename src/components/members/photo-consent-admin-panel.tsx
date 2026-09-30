"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import type { PhotoConsentAdminEntry, PhotoConsentShowOption } from "@/types/photo-consent";
import {
  CheckIcon,
  FileIcon,
  RefreshIcon,
  SearchIcon,
  UploadIcon,
} from "@/components/ui/action-icons";

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "noPhotos";
type ConsentAction = "approve" | "reject" | "reset";

const STATUS_LABELS: Record<PhotoConsentAdminEntry["status"], string> = {
  pending: "In Prüfung",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  noPhotos: "Keine Aufnahmen",
};

const STATUS_BADGE_CLASSES: Record<PhotoConsentAdminEntry["status"], string> = {
  pending: "border-warning/45 bg-warning/15 text-warning",
  approved: "border-success/45 bg-success/15 text-success",
  rejected: "border-destructive/45 bg-destructive/15 text-destructive",
  noPhotos: "border-muted bg-muted/40 text-muted-foreground",
};

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Alle" },
  { value: "pending", label: "Offen" },
  { value: "approved", label: "Freigegeben" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "noPhotos", label: "Keine Aufnahmen" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DEFAULT_TIME_ZONE,
});

function formatDateTime(value: string | null | undefined) {
  if (!value) return "unbekannt";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "unbekannt";
  return dateTimeFormatter.format(date);
}

function ChosenPurposes({ entry }: { entry: PhotoConsentAdminEntry }) {
  const chosen = entry.purposes.filter((purpose) => purpose.chosen);
  if (chosen.length === 0) {
    return <p className="text-xs text-muted-foreground">Keine Verwendungszwecke angekreuzt.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {chosen.map((purpose) => (
        <Badge key={purpose.purposeId} variant="secondary" className="font-normal">
          {purpose.label}
        </Badge>
      ))}
    </div>
  );
}

export function PhotoConsentAdminPanel() {
  const [entries, setEntries] = useState<PhotoConsentAdminEntry[]>([]);
  const [shows, setShows] = useState<PhotoConsentShowOption[]>([]);
  const [showId, setShowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rejectTarget, setRejectTarget] = useState<PhotoConsentAdminEntry | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [resetTarget, setResetTarget] = useState<PhotoConsentAdminEntry | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (nextShowId?: string) => {
    setError(null);
    try {
      const query = nextShowId ? `?showId=${encodeURIComponent(nextShowId)}` : "";
      const response = await fetch(`/api/photo-consents/admin${query}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Einträge konnten nicht geladen werden");
        return;
      }
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setShows(Array.isArray(data?.shows) ? data.shows : []);
      setShowId(typeof data?.showId === "string" ? data.showId : null);
    } catch {
      setError("Netzwerkfehler beim Laden der Einträge");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = useCallback(async (id: string, action: ConsentAction, reason?: string) => {
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
          ? "Fotoerlaubnis freigegeben"
          : action === "reject"
            ? "Fotoerlaubnis abgelehnt"
            : "Status und Nachweis zurückgesetzt";
      toast.success(message);
    } catch {
      toast.error("Netzwerkfehler bei der Aktion");
    } finally {
      setProcessing(null);
    }
  }, []);

  const handleParentalTemplateUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("template", file);
        const response = await fetch("/api/photo-consents/parental-template", {
          method: "POST",
          body: formData,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          toast.error(data?.error ?? "Fehler beim Hochladen des Elternformulars");
          return;
        }
        toast.success("Elternformular erfolgreich hochgeladen");
      } catch {
        toast.error("Netzwerkfehler beim Hochladen");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [],
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const parts = [
        entry.name ?? "",
        entry.email ?? "",
        entry.showTitle,
        entry.approvedByName ?? "",
        entry.documentName ?? "",
        entry.rejectionReason ?? "",
        entry.exclusionNote ?? "",
        ...entry.purposes.filter((purpose) => purpose.chosen).map((purpose) => purpose.label),
      ];
      return parts.join(" ").toLowerCase().includes(normalizedSearch);
    });
  }, [entries, normalizedSearch, statusFilter]);

  const openEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.status === "pending"),
    [filteredEntries],
  );
  const processedEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.status !== "pending"),
    [filteredEntries],
  );

  const summary = useMemo(() => {
    return {
      pending: entries.filter((entry) => entry.status === "pending").length,
      missingBirthdays: entries.filter((entry) => entry.requiresDateOfBirth).length,
      rejected: entries.filter((entry) => entry.status === "rejected").length,
    };
  }, [entries]);

  const renderEntry = (entry: PhotoConsentAdminEntry) => (
    <li
      key={entry.id}
      className={cn(
        "rounded-lg border p-4",
        entry.status === "pending"
          ? "border-l-4 border-l-warning/80 border-y-border border-r-border bg-warning/5"
          : entry.status === "approved"
            ? "border-success/40 bg-success/5"
            : entry.status === "rejected"
              ? "border-destructive/40 bg-destructive/5"
              : "border-border/70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-foreground">
            {entry.name ?? entry.email ?? "Unbekannt"}
          </div>
          <div className="text-xs text-muted-foreground">
            {entry.email ? `${entry.email} · ` : ""}
            {entry.showTitle}
          </div>
        </div>
        <Badge className={cn("whitespace-nowrap", STATUS_BADGE_CLASSES[entry.status])}>
          {STATUS_LABELS[entry.status]}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <Badge variant="outline">{entry.requiresDocument ? "Minderjährig" : "Volljährig"}</Badge>
        {entry.hasDocument ? (
          <Badge variant="outline" className="border-success/50 text-success">
            Dokument vorhanden
          </Badge>
        ) : entry.requiresDocument ? (
          <Badge variant="outline" className="border-warning/70 text-warning">
            Dokument fehlt
          </Badge>
        ) : null}
        {entry.requiresDateOfBirth ? (
          <Badge variant="outline" className="border-warning/70 text-warning">
            Geburtsdatum fehlt
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Angekreuzt
        </p>
        <ChosenPurposes entry={entry} />
      </div>

      {entry.exclusionNote ? (
        <p className="mt-2 text-xs text-muted-foreground">Ausschlüsse: {entry.exclusionNote}</p>
      ) : null}
      {entry.rejectionReason ? (
        <p className="mt-2 text-xs text-destructive">Ablehnungsgrund: {entry.rejectionReason}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>Eingegangen: {formatDateTime(entry.submittedAt)}</span>
        {entry.approvedAt ? (
          <span>
            Freigegeben: {formatDateTime(entry.approvedAt)}
            {entry.approvedByName ? ` durch ${entry.approvedByName}` : ""}
          </span>
        ) : null}
        {entry.versions.length > 0 ? <span>{entry.versions.length} Version(en)</span> : null}
      </div>

      {entry.documentUrl ? (
        <a
          href={entry.documentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-foreground underline underline-offset-2"
        >
          <FileIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {entry.documentName ?? "Nachweis ansehen"}
        </a>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.status === "pending" ? (
          <>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleAction(entry.id, "approve")}
              disabled={processing === entry.id}
            >
              <CheckIcon className="mr-1 h-4 w-4" aria-hidden="true" />
              Freigeben
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                setRejectReason("");
                setRejectTarget(entry);
              }}
              disabled={processing === entry.id}
            >
              Ablehnen
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void handleAction(entry.id, "approve")}
            disabled={processing === entry.id}
          >
            Freigeben
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setResetTarget(entry)}
          disabled={processing === entry.id}
        >
          Zurücksetzen
        </Button>
      </div>
    </li>
  );

  return (
    <Card className="border border-border/70 bg-card">
      <CardContent className="space-y-6 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Geladene Fotoerlaubnisse</h2>
            <p className="text-xs text-muted-foreground">
              Fotoerlaubnisse gelten pro Produktion. Prüfe eingereichte Zustimmungen und entscheide
              darüber.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">Wartend: {summary.pending}</Badge>
            <Badge variant="outline">Fehlende Geburtsdaten: {summary.missingBirthdays}</Badge>
            <Badge variant="destructive">Abgelehnt: {summary.rejected}</Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nach Namen, E-Mail oder Punkt suchen"
              aria-label="Fotoerlaubnisse durchsuchen"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={showId ?? "all"}
              onValueChange={(value) => {
                setShowId(value);
                setLoading(true);
                void load(value);
              }}
            >
              <SelectTrigger className="h-9 w-56" aria-label="Produktion auswählen">
                <SelectValue placeholder="Produktion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Produktionen</SelectItem>
                {shows.map((show) => (
                  <SelectItem key={show.id} value={show.id}>
                    {show.title} ({show.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showId && showId !== "all" ? (
              <Button asChild size="sm" variant="outline">
                <a href={`/api/photo-consents/export?showId=${encodeURIComponent(showId)}`}>
                  Fotoliste (CSV)
                </a>
              </Button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                void handleParentalTemplateUpload(event);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="mr-1 h-4 w-4" aria-hidden="true" />
              Elternformular
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void load(showId ?? undefined)}
              disabled={loading}
            >
              <RefreshIcon className="mr-1 h-4 w-4" aria-hidden="true" />
              Aktualisieren
            </Button>
          </div>
        </div>

        <SegmentedControl
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value)}
          options={STATUS_FILTERS.map((filter) => ({ value: filter.value, label: filter.label }))}
          aria-label="Status filtern"
        />

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Bisher liegen keine Fotoerlaubnisse vor.
          </p>
        ) : filteredEntries.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Keine Fotoerlaubnis entspricht deiner Suche oder Filterung.
          </p>
        ) : (
          <div className="space-y-8">
            {openEntries.length > 0 ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Offene Fotoerlaubnisse
                </h3>
                <ul className="space-y-3">{openEntries.map(renderEntry)}</ul>
              </section>
            ) : null}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Abgeschlossene Einträge
              </h3>
              {processedEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine freigegebenen oder abgelehnten Einwilligungen vorhanden.
                </p>
              ) : (
                <ul className="space-y-3">{processedEntries.map(renderEntry)}</ul>
              )}
            </section>
          </div>
        )}
      </CardContent>

      <ModalFormDialog
        title="Fotoerlaubnis ablehnen"
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
        onSave={() => {
          if (!rejectTarget) return;
          const reason = rejectReason.trim();
          if (!reason) {
            toast.error("Bitte gib einen Ablehnungsgrund an");
            return;
          }
          const target = rejectTarget;
          setRejectTarget(null);
          void handleAction(target.id, "reject", reason);
        }}
        saveLabel="Ablehnen"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="reject-reason">
            Grund der Ablehnung
          </label>
          <Textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Was fehlt oder ist nicht in Ordnung?"
          />
          <p className="text-xs text-muted-foreground">
            Das Mitglied sieht den Grund und kann erneut einreichen.
          </p>
        </div>
      </ModalFormDialog>

      <ConfirmDialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        title="Fotoerlaubnis zurücksetzen?"
        description="Der eingereichte Nachweis und die Auswahl werden entfernt, damit das Mitglied neu einreichen kann. Der Verlauf bleibt erhalten."
        confirmLabel="Zurücksetzen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => {
          if (!resetTarget) return;
          const target = resetTarget;
          setResetTarget(null);
          void handleAction(target.id, "reset");
        }}
        onCancel={() => setResetTarget(null)}
      />
    </Card>
  );
}
