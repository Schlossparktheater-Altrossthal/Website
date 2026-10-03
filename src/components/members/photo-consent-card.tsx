"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  EMPTY_PHOTO_CONSENT_DRAFT,
  PhotoConsentForm,
  photoConsentDraftToFormData,
  validatePhotoConsentDraft,
  type PhotoConsentDraft,
} from "@/components/photo-consent/photo-consent-form";
import { PhotoConsentLevelDot } from "@/components/photo-consent/photo-consent-level-badge";
import { HistoryIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { photoConsentLevelLabel } from "@/lib/photo-consent-levels";
import type { PhotoConsentSummary, PhotoConsentVersionView } from "@/types/photo-consent";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeZone: DEFAULT_TIME_ZONE,
});

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : dateFormatter.format(date);
}

type StatusInfo = {
  label: string;
  variant: "success" | "warning" | "destructive" | "muted" | "info";
  detail: string | null;
  /** Mitglied muss noch etwas tun. */
  actionLabel: string | null;
};

function describeStatus(summary: PhotoConsentSummary): StatusInfo {
  if (summary.revokedAt) {
    return {
      label: "Widerrufen",
      variant: "destructive",
      detail: `Am ${formatDate(summary.revokedAt) ?? "unbekannt"} widerrufen. Du wirst nicht fotografiert.`,
      actionLabel: "Neu abgeben",
    };
  }
  switch (summary.status) {
    case "approved":
      return {
        label: "Freigegeben",
        variant: "success",
        detail: `Am ${formatDate(summary.approvedAt) ?? "unbekannt"}${
          summary.approvedByName ? ` durch ${summary.approvedByName}` : ""
        }.`,
        actionLabel: summary.level ? null : "Stufe angeben",
      };
    case "noPhotos":
      return {
        label: "Keine Aufnahmen",
        variant: "muted",
        detail: "Gilt sofort, ohne Prüfung.",
        actionLabel: null,
      };
    case "rejected":
      return {
        label: "Abgelehnt",
        variant: "destructive",
        detail: summary.rejectionReason ? `Grund: ${summary.rejectionReason}` : null,
        actionLabel: "Neu abgeben",
      };
    case "pending":
      return summary.hasProof
        ? {
            label: "Wird geprüft",
            variant: "warning",
            detail: "Das Team prüft deine Fotoerlaubnis. Bis dahin wirst du nicht fotografiert.",
            actionLabel: null,
          }
        : {
            label: "Unterschrift fehlt",
            variant: "warning",
            detail: summary.requiresDocument
              ? "Ein Elternteil muss noch unterschreiben."
              : "Die Unterschrift fehlt noch.",
            actionLabel: "Unterschrift nachreichen",
          };
    default:
      return { label: "Fehlt", variant: "info", detail: null, actionLabel: null };
  }
}

function VersionList({ versions }: { versions: PhotoConsentVersionView[] }) {
  return (
    <ol className="divide-y divide-border rounded-lg border border-border text-xs">
      {versions.map((version) => (
        <li
          key={version.id}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
        >
          <span className="flex min-w-0 items-center gap-2">
            <PhotoConsentLevelDot level={version.level} />
            <span className="font-medium text-foreground">
              {version.source === "revocation"
                ? "Widerrufen"
                : photoConsentLevelLabel(version.level)}
            </span>
            {version.signatureVersion ? (
              <span className="text-muted-foreground">· unterschrieben</span>
            ) : version.hasDocument ? (
              <span className="text-muted-foreground">· Dokument</span>
            ) : null}
          </span>
          <span className="text-muted-foreground">
            V{version.version} · {formatDate(version.submittedAt) ?? "unbekannt"}
          </span>
        </li>
      ))}
    </ol>
  );
}

interface PhotoConsentCardProps {
  onSummaryChange?: (summary: PhotoConsentSummary | null) => void;
}

/** Fotoerlaubnis im Profil: kompakte Statuszeile oder das Formular zum Abgeben/Ändern. */
export function PhotoConsentCard({ onSummaryChange }: PhotoConsentCardProps = {}) {
  const [summary, setSummary] = useState<PhotoConsentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PhotoConsentDraft>(EMPTY_PHOTO_CONSENT_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/photo-consents", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setLoadError(data?.error ?? "Fotoerlaubnis konnte nicht geladen werden.");
        return;
      }
      const consent: PhotoConsentSummary | null = data?.consent ?? null;
      setSummary(consent);
      setEditing(!consent || consent.status === "none");
    } catch {
      setLoadError("Netzwerkfehler beim Laden der Fotoerlaubnis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEditing = () => {
    setDraft({
      ...EMPTY_PHOTO_CONSENT_DRAFT,
      level: summary?.level ?? null,
      note: summary?.exclusionNote ?? "",
    });
    setFormError(null);
    setEditing(true);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (loadError || !summary) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p className="text-destructive">{loadError ?? "Fotoerlaubnis nicht verfügbar."}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Erneut laden
        </Button>
      </div>
    );
  }

  const isMinor = summary.requiresDocument;
  const hasConsent = summary.status !== "none";
  const keepsProof =
    hasConsent && summary.hasProof && !summary.revokedAt && summary.status !== "rejected";

  const submit = async (values: PhotoConsentDraft = draft) => {
    const error = validatePhotoConsentDraft(values, {
      isMinor,
      hasExistingProof: keepsProof,
    });
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/photo-consents", {
        method: "POST",
        body: photoConsentDraftToFormData(values),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setFormError(data?.error ?? "Abgeben fehlgeschlagen.");
        return;
      }
      toast.success(
        draft.level === "none" ? "Gespeichert: keine Aufnahmen" : "Fotoerlaubnis abgegeben",
      );
      setShowHistory(false);
      await load();
    } catch {
      setFormError("Netzwerkfehler beim Abgeben.");
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async () => {
    setRevoking(true);
    try {
      const formData = new FormData();
      formData.append("revoke", "1");
      const response = await fetch("/api/photo-consents", { method: "POST", body: formData });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error("Widerruf fehlgeschlagen", { description: data?.error });
        return;
      }
      toast.success("Fotoerlaubnis widerrufen");
      setRevokeOpen(false);
      await load();
    } finally {
      setRevoking(false);
    }
  };

  if (summary.requiresDateOfBirth && editing) {
    return (
      <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
        <p>
          Bitte trage zuerst dein Geburtsdatum ein. Daran sehen wir, ob ein Elternteil
          unterschreiben muss.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/mitglieder/profil?bereich=stammdaten">Geburtsdatum eintragen</Link>
          </Button>
          <AsyncButton
            type="button"
            size="sm"
            variant="ghost"
            isLoading={submitting}
            loadingText="Wird gespeichert …"
            onClick={() => void submit({ ...EMPTY_PHOTO_CONSENT_DRAFT, level: "none" })}
          >
            Keine Aufnahmen erlauben
          </AsyncButton>
        </div>
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-6">
        {summary.showTitle ? (
          <p className="text-sm text-muted-foreground">
            Gilt für <span className="font-medium text-foreground">{summary.showTitle}</span>. Für
            jede Produktion wird die Fotoerlaubnis neu abgegeben.
          </p>
        ) : null}
        <PhotoConsentForm
          value={draft}
          onChange={(next) => {
            setDraft(next);
            setFormError(null);
          }}
          isMinor={isMinor}
          previous={summary.previous}
          hasExistingProof={keepsProof}
          disabled={submitting}
        />
        {draft.level && draft.level !== "none" ? (
          <p className="text-xs text-muted-foreground">
            Mit dem Abgeben {isMinor ? "erlaubt ein Elternteil" : "erlaube ich"} dem Sommertheater
            Aufnahmen im gewählten Umfang für diese Produktion. Die Erlaubnis kann jederzeit
            widerrufen werden.
          </p>
        ) : null}
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <AsyncButton
            type="button"
            isLoading={submitting}
            loadingText="Wird gespeichert …"
            onClick={() => void submit()}
            className="min-h-11"
          >
            {draft.level === "none" ? "Speichern" : "Fotoerlaubnis abgeben"}
          </AsyncButton>
          {hasConsent ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={submitting}
              onClick={() => setEditing(false)}
            >
              Abbrechen
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const status = describeStatus(summary);
  const canRevoke = !summary.revokedAt && summary.status !== "noPhotos";

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <PhotoConsentLevelDot level={summary.revokedAt ? "none" : summary.level} />
          <span className="text-base font-semibold text-foreground">
            {summary.revokedAt ? "Gar nicht" : photoConsentLevelLabel(summary.level)}
          </span>
          <Badge variant={status.variant} size="sm">
            {status.label}
          </Badge>
        </div>
        {status.detail ? <p className="text-sm text-muted-foreground">{status.detail}</p> : null}
        {summary.exclusionNote ? (
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Hinweis: </span>
            {summary.exclusionNote}
          </p>
        ) : null}
        {summary.showTitle ? (
          <p className="text-xs text-muted-foreground">Gilt für {summary.showTitle}.</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant={status.actionLabel ? "default" : "outline"}
            onClick={startEditing}
          >
            {status.actionLabel ?? "Ändern"}
          </Button>
          {summary.versions.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-expanded={showHistory}
              onClick={() => setShowHistory((current) => !current)}
            >
              <HistoryIcon className="mr-1.5 size-4" aria-hidden />
              Verlauf ({summary.versions.length})
            </Button>
          ) : null}
          {canRevoke ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setRevokeOpen(true)}
            >
              Widerrufen
            </Button>
          ) : null}
        </div>
      </div>

      {showHistory ? <VersionList versions={summary.versions} /> : null}

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Fotoerlaubnis widerrufen?"
        description="Ab sofort wirst du für diese Produktion nicht mehr fotografiert. Du kannst später eine neue Erlaubnis abgeben."
        confirmLabel={revoking ? "Wird widerrufen …" : "Widerrufen"}
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => void revoke()}
        onCancel={() => setRevokeOpen(false)}
      />
    </div>
  );
}
