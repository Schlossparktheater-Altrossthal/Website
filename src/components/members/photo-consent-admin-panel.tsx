"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

import { remindMissingPhotoConsentsAction } from "@/app/(members)/mitglieder/produktionen/actions/reminders";
import {
  PhotoConsentLevelBadge,
  PhotoConsentLevelDot,
} from "@/components/photo-consent/photo-consent-level-badge";
import { SignatureView } from "@/components/signature/signature-view";
import { ActionDropdownMenu } from "@/components/ui/action-dropdown-menu";
import {
  BellRingIcon,
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileIcon,
  SearchIcon,
  UploadIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import {
  photoConsentLevelLabel,
  photoConsentLevelsFor,
  type PhotoConsentLevelValue,
} from "@/lib/photo-consent-levels";
import { cn } from "@/lib/utils";
import type {
  PhotoConsentAdminEntry,
  PhotoConsentMissingEntry,
  PhotoConsentShowOption,
} from "@/types/photo-consent";

type Bucket = "review" | "noProof" | "missing" | "unknown" | "done";

const BUCKET_LABELS: Record<Bucket, string> = {
  review: "Zu prüfen",
  noProof: "Ohne Nachweis",
  missing: "Nicht abgegeben",
  unknown: "Stufe unbekannt",
  done: "Erledigt",
};

const BUCKET_EMPTY: Record<Bucket, string> = {
  review: "Nichts zu prüfen.",
  noProof: "Alle abgegebenen Erlaubnisse haben einen Nachweis.",
  missing: "Alle Mitglieder der Produktion haben abgegeben.",
  unknown: "Keine alten Einträge ohne Stufe.",
  done: "Noch nichts erledigt.",
};

const STATUS_LABELS: Record<PhotoConsentAdminEntry["status"], string> = {
  pending: "Wird geprüft",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  noPhotos: "Keine Aufnahmen",
};

const STATUS_VARIANTS: Record<
  PhotoConsentAdminEntry["status"],
  "warning" | "success" | "destructive" | "muted"
> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  noPhotos: "muted",
};

const SOURCE_LABELS: Record<string, string> = {
  member: "Profil",
  onboarding: "Onboarding",
  returnee: "Rückkehrer",
  revocation: "Widerruf",
};

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DEFAULT_TIME_ZONE,
});

function formatDateTime(value: string | null | undefined) {
  if (!value) return "unbekannt";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "unbekannt" : dateTimeFormatter.format(date);
}

function bucketOf(entry: PhotoConsentAdminEntry): Exclude<Bucket, "missing"> {
  if (entry.status === "pending") return entry.hasProof ? "review" : "noProof";
  if (entry.status === "approved" && !entry.level) return "unknown";
  return "done";
}

function proofLabel(entry: PhotoConsentAdminEntry): string {
  if (entry.signaturePayload) return "Unterschrift";
  if (entry.hasDocument) return "Dokument";
  return "Kein Nachweis";
}

function EntryRow({
  entry,
  selectable,
  selected,
  onToggle,
  onOpen,
}: {
  entry: PhotoConsentAdminEntry;
  selectable: boolean;
  selected: boolean;
  onToggle: (next: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <li className="flex items-center gap-2 px-2">
      {selectable ? (
        <span className="flex size-11 shrink-0 items-center justify-center">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onToggle(checked === true)}
            aria-label={`${entry.name ?? "Eintrag"} auswählen`}
          />
        </span>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {entry.name ?? entry.email ?? "Unbekannt"}
            </span>
            {entry.isMinor ? (
              <Badge variant="muted" size="sm">
                U18
              </Badge>
            ) : null}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground sm:hidden">
            <span className="inline-flex items-center gap-1">
              <PhotoConsentLevelDot level={entry.level} className="size-2" />
              {photoConsentLevelLabel(entry.level)}
            </span>
            <span>· {proofLabel(entry)}</span>
            {entry.exclusionNote ? <span>· Hinweis</span> : null}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-2 sm:flex">
          <PhotoConsentLevelBadge level={entry.level} />
          <span className="w-24 text-xs text-muted-foreground">{proofLabel(entry)}</span>
          <Badge variant={STATUS_VARIANTS[entry.status]} size="sm" className="w-28 justify-center">
            {STATUS_LABELS[entry.status]}
          </Badge>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

function EntryDetail({
  entry,
  processing,
  onSetLevel,
}: {
  entry: PhotoConsentAdminEntry;
  processing: boolean;
  onSetLevel: (level: PhotoConsentLevelValue) => void;
}) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANTS[entry.status]} size="sm">
          {STATUS_LABELS[entry.status]}
        </Badge>
        {entry.isMinor ? (
          <Badge variant="muted" size="sm">
            Minderjährig
          </Badge>
        ) : null}
        {entry.requiresDateOfBirth ? (
          <Badge variant="warning" size="sm">
            Geburtsdatum fehlt
          </Badge>
        ) : null}
        <span className="text-xs text-muted-foreground">{entry.showTitle}</span>
      </div>

      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Stufe
        </h3>
        <Select
          value={entry.level ?? undefined}
          onValueChange={(value) => onSetLevel(value as PhotoConsentLevelValue)}
          disabled={processing}
        >
          <SelectTrigger className="min-h-11 w-full" aria-label="Stufe">
            <SelectValue placeholder="Stufe unbekannt – vom Formular nachtragen" />
          </SelectTrigger>
          <SelectContent>
            {photoConsentLevelsFor(entry.isMinor).map((level) => (
              <SelectItem key={level} value={level}>
                <span className="flex items-center gap-2">
                  <PhotoConsentLevelDot level={level} />
                  {photoConsentLevelLabel(level)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {entry.exclusionNote ? (
          <p className="rounded-lg border border-border bg-muted p-3">
            <span className="text-muted-foreground">Hinweis: </span>
            {entry.exclusionNote}
          </p>
        ) : null}
        {entry.status === "rejected" && entry.rejectionReason ? (
          <p className="text-destructive">Abgelehnt: {entry.rejectionReason}</p>
        ) : null}
      </section>

      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nachweis
        </h3>
        {entry.signaturePayload ? (
          <SignatureView payload={entry.signaturePayload} />
        ) : entry.documentPreviewUrl ? (
          <a
            href={entry.documentUrl ?? entry.documentPreviewUrl}
            target="_blank"
            rel="noreferrer"
            className="relative block h-56 w-full overflow-hidden rounded-lg border border-border bg-muted"
          >
            <Image
              src={entry.documentPreviewUrl}
              alt={entry.documentName ?? "Nachweis"}
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className="object-contain"
              unoptimized
            />
          </a>
        ) : entry.documentUrl ? (
          <a
            href={entry.documentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium underline underline-offset-2"
          >
            <FileIcon className="size-4" aria-hidden />
            {entry.documentName ?? "Dokument öffnen"}
          </a>
        ) : (
          <p className="text-muted-foreground">
            {entry.level === "none"
              ? "Bei „Gar nicht“ ist kein Nachweis nötig."
              : "Noch kein Nachweis abgegeben."}
          </p>
        )}
        {entry.approvedAt ? (
          <p className="text-xs text-muted-foreground">
            Freigegeben {formatDateTime(entry.approvedAt)}
            {entry.approvedByName ? ` durch ${entry.approvedByName}` : ""}
          </p>
        ) : null}
      </section>

      {entry.versions.length > 0 ? (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Verlauf
          </h3>
          <ol className="divide-y divide-border rounded-lg border border-border text-xs">
            {entry.versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <PhotoConsentLevelDot level={version.level} />
                  {version.source === "revocation"
                    ? "Widerrufen"
                    : photoConsentLevelLabel(version.level)}
                  <span className="text-muted-foreground">
                    · {SOURCE_LABELS[version.source] ?? version.source}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  V{version.version} · {formatDateTime(version.submittedAt)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

/** Verwaltung der Fotoerlaubnisse: offene Fälle zuerst, Details im Blatt, Sammelfreigabe. */
export function PhotoConsentAdminPanel() {
  const [entries, setEntries] = useState<PhotoConsentAdminEntry[]>([]);
  const [missing, setMissing] = useState<PhotoConsentMissingEntry[]>([]);
  const [shows, setShows] = useState<PhotoConsentShowOption[]>([]);
  const [showId, setShowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket>("review");
  const [bucketTouched, setBucketTouched] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [reminding, setReminding] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (nextShowId?: string) => {
    setError(null);
    try {
      const query = nextShowId ? `?showId=${encodeURIComponent(nextShowId)}` : "";
      const response = await fetch(`/api/photo-consents/admin${query}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Einträge konnten nicht geladen werden.");
        return;
      }
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
      setMissing(Array.isArray(data?.missing) ? data.missing : []);
      setShows(Array.isArray(data?.shows) ? data.shows : []);
      setShowId(typeof data?.showId === "string" ? data.showId : null);
      setSelected(new Set());
    } catch {
      setError("Netzwerkfehler beim Laden der Einträge.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const result: Record<Bucket, number> = {
      review: 0,
      noProof: 0,
      missing: missing.length,
      unknown: 0,
      done: 0,
    };
    for (const entry of entries) result[bucketOf(entry)] += 1;
    return result;
  }, [entries, missing.length]);

  // Ohne Auswahl springt die Ansicht auf den ersten Bereich mit offenen Fällen.
  const activeBucket: Bucket = useMemo(() => {
    if (bucketTouched || counts[bucket] > 0) return bucket;
    const order: Bucket[] = ["review", "noProof", "unknown", "missing", "done"];
    return order.find((candidate) => counts[candidate] > 0) ?? bucket;
  }, [bucket, bucketTouched, counts]);

  const search = searchTerm.trim().toLowerCase();
  const matches = useCallback(
    (parts: Array<string | null>) => !search || parts.join(" ").toLowerCase().includes(search),
    [search],
  );

  const visibleEntries = useMemo(
    () =>
      entries
        .filter((entry) => bucketOf(entry) === activeBucket)
        .filter((entry) => matches([entry.name, entry.email, entry.exclusionNote]))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "de")),
    [activeBucket, entries, matches],
  );
  const visibleMissing = useMemo(
    () => missing.filter((entry) => matches([entry.name, entry.email])),
    [matches, missing],
  );

  const detail = entries.find((entry) => entry.id === detailId) ?? null;
  const isSingleShow = Boolean(showId && showId !== "all");

  const runAction = useCallback(async (body: Record<string, unknown>, successMessage: string) => {
    setProcessing(true);
    try {
      const response = await fetch("/api/photo-consents/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Aktion fehlgeschlagen");
        return false;
      }
      const updated: PhotoConsentAdminEntry[] = Array.isArray(data?.entries) ? data.entries : [];
      const byId = new Map(updated.map((entry) => [entry.id, entry]));
      setEntries((prev) => prev.map((entry) => byId.get(entry.id) ?? entry));
      toast.success(successMessage);
      return true;
    } catch {
      toast.error("Netzwerkfehler bei der Aktion");
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  const approveSelected = async () => {
    const ids = Array.from(selected);
    const ok = await runAction(
      { ids, action: "approve" },
      ids.length === 1 ? "Fotoerlaubnis freigegeben" : `${ids.length} Fotoerlaubnisse freigegeben`,
    );
    if (ok) setSelected(new Set());
  };

  const remindMissing = async () => {
    if (!showId) return;
    setReminding(true);
    try {
      const formData = new FormData();
      formData.append("showId", showId);
      const result = await remindMissingPhotoConsentsAction(formData);
      if (result.ok) {
        toast.success("Erinnerungen verschickt", { description: result.message });
      } else {
        toast.error("Erinnern fehlgeschlagen", { description: result.error });
      }
    } finally {
      setReminding(false);
    }
  };

  const uploadTemplate = async (file: File) => {
    const formData = new FormData();
    formData.append("template", file);
    const response = await fetch("/api/photo-consents/parental-template", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      toast.success("Elternformular gespeichert");
    } else {
      toast.error(data?.error ?? "Elternformular konnte nicht gespeichert werden");
    }
  };

  const menuItems = [
    ...(isSingleShow && showId
      ? [
          {
            label: "Fotoliste als PDF",
            icon: <DownloadIcon className="size-4" />,
            onSelect: () => {
              window.location.href = `/api/photo-consents/export?showId=${encodeURIComponent(showId)}&format=pdf`;
            },
          },
          {
            label: "Fotoliste als CSV",
            icon: <DownloadIcon className="size-4" />,
            onSelect: () => {
              window.location.href = `/api/photo-consents/export?showId=${encodeURIComponent(showId)}`;
            },
          },
        ]
      : []),
    {
      label: "Elternformular herunterladen",
      icon: <DownloadIcon className="size-4" />,
      onSelect: () => {
        window.location.href = "/api/photo-consents/parental-template";
      },
    },
    {
      label: "Elternformular ersetzen",
      icon: <UploadIcon className="size-4" />,
      onSelect: () => templateInputRef.current?.click(),
    },
  ];

  const selectable = activeBucket === "review";
  const allVisibleSelected =
    selectable &&
    visibleEntries.length > 0 &&
    visibleEntries.every((entry) => selected.has(entry.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Name oder E-Mail"
            aria-label="Fotoerlaubnisse durchsuchen"
            className="min-h-11 pl-9"
          />
        </div>
        <Select
          value={showId ?? "all"}
          onValueChange={(value) => {
            setLoading(true);
            setBucketTouched(false);
            void load(value);
          }}
        >
          <SelectTrigger className="min-h-11 w-full min-w-0 sm:w-56" aria-label="Produktion">
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
        <ActionDropdownMenu items={menuItems} className="size-11" label="Weitere Aktionen" />
        <input
          ref={templateInputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void uploadTemplate(file);
          }}
        />
      </div>

      <SegmentedControl
        aria-label="Bereich"
        value={activeBucket}
        onValueChange={(value) => {
          setBucket(value);
          setBucketTouched(true);
          setSelected(new Set());
        }}
        options={(["review", "noProof", "missing", "unknown", "done"] as Bucket[])
          .filter((value) => value !== "missing" || isSingleShow)
          .filter((value) => value !== "unknown" || counts.unknown > 0)
          .map((value) => ({
            value,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {BUCKET_LABELS[value]}
                <span
                  className={cn(
                    "tabular-nums",
                    counts[value] > 0 && value !== "done"
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {counts[value]}
                </span>
              </span>
            ),
            ariaLabel: `${BUCKET_LABELS[value]}: ${counts[value]}`,
          }))}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : activeBucket === "missing" ? (
        <section className="space-y-2">
          {visibleMissing.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Aktive Mitglieder ohne Fotoerlaubnis für diese Produktion.
              </p>
              <AsyncButton
                type="button"
                size="sm"
                variant="outline"
                isLoading={reminding}
                loadingText="Wird verschickt …"
                onClick={() => void remindMissing()}
              >
                <BellRingIcon className="mr-1.5 size-4" aria-hidden />
                Alle erinnern
              </AsyncButton>
            </div>
          ) : null}
          {visibleMissing.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {BUCKET_EMPTY.missing}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {visibleMissing.map((entry) => (
                <li key={entry.userId} className="flex min-h-12 items-center gap-2 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.name}</span>
                  {entry.isMinor ? (
                    <Badge variant="muted" size="sm">
                      U18
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : visibleEntries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {search ? "Kein Eintrag passt zur Suche." : BUCKET_EMPTY[activeBucket]}
        </p>
      ) : (
        <section className="space-y-2">
          {selectable ? (
            <label className="flex min-h-11 items-center gap-3 px-4 text-xs text-muted-foreground">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={(checked) =>
                  setSelected(
                    checked === true ? new Set(visibleEntries.map((entry) => entry.id)) : new Set(),
                  )
                }
              />
              Alle auswählen
            </label>
          ) : null}
          <ul className="divide-y divide-border rounded-lg border border-border bg-card py-1">
            {visibleEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                selectable={selectable}
                selected={selected.has(entry.id)}
                onToggle={(next) =>
                  setSelected((prev) => {
                    const copy = new Set(prev);
                    if (next) copy.add(entry.id);
                    else copy.delete(entry.id);
                    return copy;
                  })
                }
                onOpen={() => setDetailId(entry.id)}
              />
            ))}
          </ul>
        </section>
      )}

      <BulkActionBar
        count={selected.size}
        noun={["Erlaubnis", "Erlaubnisse"]}
        onClear={() => setSelected(new Set())}
      >
        <AsyncButton
          type="button"
          size="sm"
          isLoading={processing}
          loadingText="Wird freigegeben …"
          onClick={() => void approveSelected()}
        >
          <CheckIcon className="mr-1.5 size-4" aria-hidden />
          Freigeben
        </AsyncButton>
      </BulkActionBar>

      <BottomSheet
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        title={detail?.name ?? detail?.email ?? "Fotoerlaubnis"}
        description="Fotoerlaubnis prüfen"
        footer={
          detail ? (
            <div className="flex flex-wrap items-center gap-2">
              {detail.status !== "approved" && detail.status !== "noPhotos" ? (
                <AsyncButton
                  type="button"
                  className="min-h-11 flex-1 sm:flex-none"
                  isLoading={processing}
                  loadingText="Wird freigegeben …"
                  disabled={!detail.level || (detail.level !== "none" && !detail.hasProof)}
                  onClick={() =>
                    void runAction(
                      { id: detail.id, action: "approve" },
                      "Fotoerlaubnis freigegeben",
                    )
                  }
                >
                  <CheckIcon className="mr-1.5 size-4" aria-hidden />
                  Freigeben
                </AsyncButton>
              ) : null}
              {detail.status !== "rejected" && detail.status !== "noPhotos" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 sm:flex-none"
                  disabled={processing}
                  onClick={() => {
                    setRejectReason("");
                    setRejectOpen(true);
                  }}
                >
                  Ablehnen
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-destructive hover:text-destructive"
                disabled={processing}
                onClick={() => setResetOpen(true)}
              >
                Zurücksetzen
              </Button>
            </div>
          ) : null
        }
      >
        {detail ? (
          <EntryDetail
            entry={detail}
            processing={processing}
            onSetLevel={(level) =>
              void runAction(
                { id: detail.id, action: "setLevel", level },
                `Stufe gesetzt: ${photoConsentLevelLabel(level)}`,
              )
            }
          />
        ) : null}
      </BottomSheet>

      <ModalFormDialog
        title="Fotoerlaubnis ablehnen"
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onSave={() => {
          const reason = rejectReason.trim();
          if (!detail) return;
          if (!reason) {
            toast.error("Bitte gib einen Grund an");
            return;
          }
          setRejectOpen(false);
          void runAction({ id: detail.id, action: "reject", reason }, "Fotoerlaubnis abgelehnt");
        }}
        saveLabel="Ablehnen"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="reject-reason">
            Grund
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
            Das Mitglied sieht den Grund und kann neu abgeben.
          </p>
        </div>
      </ModalFormDialog>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Fotoerlaubnis zurücksetzen?"
        description="Der Nachweis wird entfernt, damit das Mitglied neu abgeben kann. Der Verlauf bleibt erhalten."
        confirmLabel="Zurücksetzen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => {
          setResetOpen(false);
          if (detail) void runAction({ id: detail.id, action: "reset" }, "Zurückgesetzt");
        }}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}
