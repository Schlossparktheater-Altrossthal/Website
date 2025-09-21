"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PhotoConsentSummary } from "@/types/photo-consent";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

const statusLabels: Record<PhotoConsentSummary["status"], string> = {
  none: "Noch nicht übermittelt",
  pending: "Wartet auf Prüfung",
  approved: "Freigabe erteilt",
  rejected: "Abgelehnt",
};

const statusVariants: Record<PhotoConsentSummary["status"], "default" | "secondary" | "destructive" | "outline"> = {
  none: "outline",
  pending: "outline",
  approved: "outline",
  rejected: "outline",
};

const statusBadgeClasses: Record<PhotoConsentSummary["status"], string> = {
  none:
    "border-info/45 bg-info/15 text-info shadow-[0_12px_32px_color-mix(in_oklab,var(--info)_22%,transparent)]",
  pending:
    "border-warning/45 bg-warning/15 text-warning shadow-[0_12px_32px_color-mix(in_oklab,var(--warning)_22%,transparent)]",
  approved:
    "border-success/45 bg-success/15 text-success shadow-[0_12px_36px_color-mix(in_oklab,var(--success)_24%,transparent)]",
  rejected:
    "border-destructive/45 bg-destructive/15 text-destructive shadow-[0_12px_32px_color-mix(in_oklab,var(--destructive)_22%,transparent)]",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

const EMPTY_SUMMARY: PhotoConsentSummary = {
  status: "none",
  requiresDocument: false,
  hasDocument: false,
  submittedAt: null,
  updatedAt: null,
  approvedAt: null,
  approvedByName: null,
  rejectionReason: null,
  requiresDateOfBirth: false,
  age: null,
  dateOfBirth: null,
  documentName: null,
  documentUploadedAt: null,
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return dateFormatter.format(date);
}

export function PhotoConsentCard() {
  const [summary, setSummary] = useState<PhotoConsentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/photo-consents", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error ?? "Status konnte nicht geladen werden";
        setError(message);
        return;
      }
      setSummary(data?.consent ?? null);
    } catch {
      setError("Netzwerkfehler beim Laden der Fotoerlaubnis");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requiresDocument = summary?.requiresDocument ?? false;
  const requiresDateOfBirth = summary?.requiresDateOfBirth ?? false;
  const status = summary?.status ?? "none";

  const statusBadge = useMemo(() => {
    return (
      <Badge
        variant={statusVariants[status]}
        className={cn(
          "whitespace-nowrap rounded-full px-4 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] transition-all duration-200 backdrop-blur-sm",
          statusBadgeClasses[status],
        )}
      >
        {statusLabels[status]}
      </Badge>
    );
  }, [status]);

  const resetFileInput = () => {
    setDocumentFile(null);
    setDocumentError(null);
    const input = fileInputRef.current;
    if (input) {
      input.value = "";
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      resetFileInput();
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setDocumentError("Dokument darf maximal 8 MB groß sein");
      event.target.value = "";
      setDocumentFile(null);
      return;
    }
    const type = file.type?.toLowerCase() ?? "";
    if (type && !ALLOWED_TYPES.has(type)) {
      setDocumentError("Bitte nutze PDF oder Bilddateien (JPG/PNG)");
      event.target.value = "";
      setDocumentFile(null);
      return;
    }
    setDocumentError(null);
    setDocumentFile(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDocumentError(null);

    if (!confirm) {
      setDocumentError("Bitte bestätige dein Einverständnis");
      return;
    }

    if (requiresDocument && !documentFile && !summary?.hasDocument) {
      setDocumentError("Bitte lade die unterschriebene Einverständniserklärung hoch");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("confirm", "1");
      if (documentFile) {
        formData.append("document", documentFile);
      }
      const response = await fetch("/api/photo-consents", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error ?? "Übermittlung fehlgeschlagen";
        setDocumentError(message);
        if (data?.requiresDateOfBirth) {
          setSummary((prev) => {
            if (prev) {
              return { ...prev, requiresDateOfBirth: true };
            }
            return { ...EMPTY_SUMMARY, requiresDateOfBirth: true };
          });
        }
        return;
      }
      const consent: PhotoConsentSummary | null = data?.consent ?? null;
      setSummary(consent);
      setConfirm(false);
      resetFileInput();
      toast.success("Fotoeinverständnis übermittelt");
    } catch {
      setDocumentError("Netzwerkfehler beim Übermitteln");
    } finally {
      setSubmitting(false);
    }
  };

  const showIntro = !loading && status !== "approved";

  return (
    <Card className="relative overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-xl shadow-primary/10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-0 h-40 w-40 rounded-full bg-primary/20 opacity-70 blur-3xl dark:bg-primary/30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 top-16 h-36 w-36 rounded-full bg-warning/20 opacity-60 blur-3xl"
      />
      <CardHeader className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary shadow-inner">
            <Camera className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold leading-tight">Darf dein Bühnenmoment sichtbar sein?</CardTitle>
            <p className="max-w-2xl text-sm text-foreground/70">
              Hier legst du fest, ob wir Fotos von Proben und Aufführungen im Mitgliederbereich zeigen dürfen.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-primary/30 bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-wide text-foreground/60 shadow-sm backdrop-blur">
          <span>Status</span>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent className="relative space-y-5 text-sm">
        {showIntro && (
          <div className="rounded-xl border border-primary/25 bg-background/90 p-4 text-sm text-foreground/80 shadow-[0_18px_45px_color-mix(in_oklab,var(--info)_18%,transparent)] backdrop-blur">
            <p className="font-semibold text-foreground">Mit deinem „Okay“ hilfst du unserem Auftrittsteam.</p>
            <p className="mt-1 text-foreground/70">
              Du kannst deine Entscheidung jederzeit hier im Profil anpassen, falls sich deine Präferenzen ändern.
            </p>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Lade Status …</p>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-destructive">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Erneut versuchen
            </Button>
          </div>
        ) : requiresDateOfBirth ? (
          <div className="rounded-md border border-warning/45 bg-warning/15 p-3 text-warning">
            Bitte hinterlege dein Geburtsdatum im Abschnitt „Profildaten“ oben auf dieser Seite, damit wir prüfen können, ob ein Elternformular notwendig ist.
          </div>
        ) : status === "approved" ? (
          <div className="space-y-2 rounded-md border border-success/45 bg-success/15 p-3 text-success">
            <p>Vielen Dank – deine Fotoeinwilligung ist freigegeben.</p>
            <ul className="text-xs text-success/90">
              <li>
                Bestätigt am {formatDate(summary?.approvedAt) ?? "unbekannt"}
                {summary?.approvedByName ? ` durch ${summary.approvedByName}` : ""}.
              </li>
              {summary?.documentUploadedAt && (
                <li>Dokument zuletzt hochgeladen am {formatDate(summary.documentUploadedAt)}.</li>
              )}
            </ul>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {summary?.status === "rejected" && summary.rejectionReason && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                Ablehnungsgrund: {summary.rejectionReason}
              </div>
            )}

            <div className="rounded-xl border border-primary/25 bg-background/80 p-4 shadow-inner shadow-primary/5 backdrop-blur">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(event) => setConfirm(event.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="text-foreground/80">
                  <span className="font-semibold text-foreground">Ja, ich bin einverstanden,</span>{" "}
                  dass im Rahmen unseres Schultheaters Fotos von mir erstellt und für interne sowie öffentliche Kommunikationszwecke genutzt werden dürfen.
                </span>
              </label>
              <p className="mt-3 text-xs text-foreground/60">Du kannst dein Okay hier jederzeit widerrufen.</p>
            </div>

            {requiresDocument && (
              <div className="space-y-3 rounded-xl border border-dashed border-primary/30 bg-background/80 p-4 shadow-sm backdrop-blur">
                <div className="font-medium text-foreground">Elterliche Einwilligung (PDF oder JPG/PNG)</div>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
                {documentFile && <p className="text-xs text-foreground/70">Ausgewählt: {documentFile.name}</p>}
                {summary?.hasDocument && !documentFile && (
                  <p className="text-xs text-foreground/60">
                    Es liegt bereits ein Dokument vor. Du kannst hier ein neues hochladen, falls eine aktualisierte Version vorliegt.
                  </p>
                )}
                {documentError && <p className="text-sm text-destructive">{documentError}</p>}
              </div>
            )}

            {!requiresDocument && documentError && <p className="text-sm text-destructive">{documentError}</p>}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                size="lg"
                className="shadow-[0_20px_45px_color-mix(in_oklab,var(--info)_25%,transparent)] transition-shadow duration-200 hover:shadow-[0_22px_52px_color-mix(in_oklab,var(--info)_32%,transparent)]"
                disabled={
                  submitting ||
                  !confirm ||
                  (requiresDocument && !documentFile && !summary?.hasDocument)
                }
              >
                {submitting ? "Speichere …" : "Jetzt zustimmen"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={submitting}>
                Status aktualisieren
              </Button>
            </div>

            <div className="text-xs text-foreground/60">
              {summary?.submittedAt ? (
                <>Zuletzt gesendet am {formatDate(summary.submittedAt)}.</>
              ) : (
                <>Noch keine Einwilligung übermittelt.</>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
