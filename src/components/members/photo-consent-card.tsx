"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
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
      <Badge variant={statusVariants[status]} className="whitespace-nowrap">
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

  return (
    <Card className="border border-border/60 bg-background">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Fotoeinverständnis</CardTitle>
        {statusBadge}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-foreground/80">
          Wir benötigen deine Einwilligung, um Fotos von Auftritten und Proben verwenden zu dürfen. Minderjährige Mitglieder
          benötigen zusätzlich eine unterschriebene Zustimmung der Erziehungsberechtigten.
        </p>

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
          <div className="rounded-md border border-amber-300 bg-amber-50/60 p-3 text-amber-900">
            Bitte hinterlege dein Geburtsdatum im <Link className="underline" href="/mitglieder/profil">Profil</Link>, damit wir
            prüfen können, ob ein Elternformular notwendig ist.
          </div>
        ) : status === "approved" ? (
          <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50/70 p-3 text-emerald-900">
            <p>Vielen Dank – deine Fotoeinwilligung ist freigegeben.</p>
            <ul className="text-xs text-emerald-800">
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
          <form className="space-y-4" onSubmit={handleSubmit}>
            {summary?.status === "rejected" && summary.rejectionReason && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                Ablehnungsgrund: {summary.rejectionReason}
              </div>
            )}

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(event) => setConfirm(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span>
                Ich erkläre mich damit einverstanden, dass im Rahmen unseres Schultheaters Fotos von mir erstellt und für
                interne sowie öffentliche Kommunikationszwecke genutzt werden dürfen.
              </span>
            </label>

            {requiresDocument && (
              <div className="space-y-2">
                <div className="font-medium text-foreground">Elterliche Einwilligung (PDF oder JPG/PNG)</div>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={handleFileChange}
                  disabled={submitting}
                />
                {documentFile && (
                  <p className="text-xs text-foreground/70">Ausgewählt: {documentFile.name}</p>
                )}
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
                disabled={
                  submitting ||
                  !confirm ||
                  (requiresDocument && !documentFile && !summary?.hasDocument)
                }
              >
                {submitting ? "Übermittle …" : "Einverständnis senden"}
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
