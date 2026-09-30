"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PhotoConsentSummary, PhotoConsentVersionView } from "@/types/photo-consent";
import { SignaturePad, type SignatureResult } from "@/components/onboarding/signature-pad";
import { SignatureVisualizer } from "@/components/signature/signature-visualizer";
import {
  CameraIcon,
  CheckCircle2Icon,
  EditIcon,
  HistoryIcon,
  PrinterIcon,
  RefreshIcon,
  UploadIcon,
} from "@/components/ui/action-icons";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const MAX_NOTE_LENGTH = 1000;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

const statusLabels: Record<PhotoConsentSummary["status"], string> = {
  none: "Noch nicht übermittelt",
  pending: "Wartet auf Prüfung",
  approved: "Freigabe erteilt",
  rejected: "Abgelehnt",
  noPhotos: "Keine Aufnahmen",
};

const statusBadgeClasses: Record<PhotoConsentSummary["status"], string> = {
  none: "border-info/45 bg-info/15 text-info",
  pending: "border-warning/45 bg-warning/15 text-warning",
  approved: "border-success/45 bg-success/15 text-success",
  rejected: "border-destructive/45 bg-destructive/15 text-destructive",
  noPhotos: "border-muted bg-muted/40 text-muted-foreground",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return dateFormatter.format(date);
}

type SignatureMode = "upload" | "signature";

interface PhotoConsentCardProps {
  onSummaryChange?: (summary: PhotoConsentSummary | null) => void;
}

function buildInitialSelection(summary: PhotoConsentSummary | null): Record<string, boolean> {
  const selection: Record<string, boolean> = {};
  for (const purpose of summary?.purposes ?? []) {
    selection[purpose.purposeId] = purpose.chosen;
  }
  return selection;
}

function ConsentPrintArea({ purposes }: { purposes: PhotoConsentSummary["purposes"] }) {
  return (
    <div className="print-area hidden print:block">
      <h1 className="text-lg font-bold">Einverständniserklärung Foto- &amp; Filmerlaubnis</h1>
      <p className="mt-3 text-sm">
        Von mir / von meinem Kind <span className="inline-block w-64 border-b border-foreground" />{" "}
        dürfen Aufnahmen (Foto &amp; Film) in der Theater-AG für folgende Verwendungszwecke gemacht
        werden.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {purposes.map((purpose) => (
          <li key={purpose.purposeId} className="flex items-start gap-2">
            <span className="mt-0.5 inline-block h-4 w-4 border border-foreground" aria-hidden />
            <span>{purpose.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs">Zutreffendes bitte ankreuzen.</p>
      <div className="mt-10 flex items-end gap-4 text-sm">
        <span className="inline-block w-56 border-b border-foreground" />
        <span>Unterschrift</span>
      </div>
    </div>
  );
}

function VersionHistory({ versions }: { versions: PhotoConsentVersionView[] }) {
  if (versions.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <HistoryIcon className="h-4 w-4" aria-hidden="true" />
        Verlauf
      </div>
      <ul className="space-y-2 text-xs text-muted-foreground">
        {versions.map((version) => {
          const chosen = version.purposes.filter((purpose) => purpose.chosen);
          return (
            <li key={version.id} className="rounded-md border border-border/50 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  Version {version.version} · {statusLabels[version.status]}
                </span>
                <span>{formatDate(version.submittedAt) ?? "unbekannt"}</span>
              </div>
              {chosen.length > 0 ? (
                <p className="mt-1">Angekreuzt: {chosen.map((entry) => entry.label).join(", ")}</p>
              ) : (
                <p className="mt-1">Keine Verwendungszwecke angekreuzt.</p>
              )}
              {version.hasDocument && version.documentUrl ? (
                <a
                  className="mt-1 inline-block text-foreground underline underline-offset-2"
                  href={version.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {version.documentName ?? "Nachweis ansehen"}
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PhotoConsentCard({ onSummaryChange }: PhotoConsentCardProps = {}) {
  const [summary, setSummary] = useState<PhotoConsentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("upload");
  const [signatureResult, setSignatureResult] = useState<SignatureResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [refusalConfirmOpen, setRefusalConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onSummaryChange?.(summary);
  }, [summary, onSummaryChange]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/photo-consents", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Status konnte nicht geladen werden");
        return;
      }
      const consent: PhotoConsentSummary | null = data?.consent ?? null;
      setSummary(consent);
      setSelection(buildInitialSelection(consent));
      setNote(consent?.exclusionNote ?? "");
    } catch {
      setError("Netzwerkfehler beim Laden der Fotoerlaubnis");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const purposes = summary?.purposes ?? [];
  const status = summary?.status ?? "none";
  const requiresDocument = summary?.requiresDocument ?? false;
  const requiresDateOfBirth = summary?.requiresDateOfBirth ?? false;

  const refusalPurpose = purposes.find((purpose) => purpose.isRefusal) ?? null;
  const isRefusalSelected = refusalPurpose ? Boolean(selection[refusalPurpose.purposeId]) : false;
  const hasSelectedPurpose = purposes.some((purpose) => Boolean(selection[purpose.purposeId]));

  const isCollapsible = status === "approved" || status === "noPhotos";
  const showForm = !isCollapsible || editing;

  useEffect(() => {
    if (status === "approved" || status === "noPhotos") {
      setEditing(false);
    } else {
      setEditing(true);
    }
  }, [status]);

  const resetDocument = useCallback(() => {
    setDocumentFile(null);
    setDocumentError(null);
    setSignatureResult(null);
    setSignatureMode("upload");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  }, []);

  const handleTogglePurpose = (purposeId: string, next: boolean) => {
    setSelection((prev) => {
      const updated = { ...prev, [purposeId]: next };
      const toggled = purposes.find((purpose) => purpose.purposeId === purposeId);
      if (next && toggled?.isRefusal) {
        // „Gar nicht“ schließt alle anderen Zwecke aus.
        for (const purpose of purposes) {
          if (purpose.purposeId !== purposeId) {
            updated[purpose.purposeId] = false;
          }
        }
      } else if (next) {
        if (refusalPurpose) {
          updated[refusalPurpose.purposeId] = false;
        }
      }
      return updated;
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setDocumentFile(null);
      setDocumentError(null);
      return;
    }
    setSignatureMode("upload");
    setSignatureResult(null);
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

  const handleSelectUploadMode = () => {
    setSignatureMode("upload");
    setSignatureResult(null);
    setDocumentError(null);
  };

  const handleSelectSignatureMode = () => {
    if (requiresDocument) {
      return;
    }
    setSignatureMode("signature");
    setDocumentFile(null);
    setDocumentError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const submitConsent = async () => {
    setDocumentError(null);
    setSubmitting(true);
    try {
      const payloadPurposes = purposes.map((purpose) => ({
        purposeId: purpose.purposeId,
        chosen: Boolean(selection[purpose.purposeId]),
      }));

      const formData = new FormData();
      formData.append("confirm", "1");
      formData.append("exclusionNote", note.trim());
      formData.append("purposes", JSON.stringify(payloadPurposes));
      if (documentFile) {
        formData.append("document", documentFile);
      }
      if (!requiresDocument && signatureMode === "signature" && signatureResult) {
        formData.append("signaturePayload", JSON.stringify(signatureResult.payload));
      }

      const response = await fetch("/api/photo-consents", { method: "POST", body: formData });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setDocumentError(data?.error ?? "Übermittlung fehlgeschlagen");
        return;
      }
      toast.success(isRefusalSelected ? "Ablehnung übermittelt" : "Fotoerlaubnis übermittelt");
      setConfirm(false);
      resetDocument();
      await load();
    } catch {
      setDocumentError("Netzwerkfehler beim Übermitteln");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDocumentError(null);
    setNoteError(null);

    if (!hasSelectedPurpose) {
      setDocumentError("Bitte wähle mindestens einen Punkt aus");
      return;
    }
    if (!confirm) {
      setDocumentError("Bitte bestätige dein Einverständnis");
      return;
    }
    if (note.trim().length > MAX_NOTE_LENGTH) {
      setNoteError(`Bitte kürze deine Hinweise auf maximal ${MAX_NOTE_LENGTH} Zeichen`);
      return;
    }

    // „Gar nicht“ braucht keinen Nachweis.
    if (!isRefusalSelected) {
      if (requiresDocument && !documentFile && !summary?.hasDocument) {
        setDocumentError("Bitte lade die unterschriebene Einverständniserklärung hoch");
        return;
      }
      if (!requiresDocument && signatureMode === "signature" && !signatureResult) {
        setDocumentError("Bitte zeichne deine digitale Unterschrift.");
        return;
      }
    }

    if (isRefusalSelected) {
      setRefusalConfirmOpen(true);
      return;
    }

    void submitConsent();
  };

  const statusBadge = useMemo(
    () => (
      <Badge size="sm" className={cn("whitespace-nowrap", statusBadgeClasses[status])}>
        {statusLabels[status]}
      </Badge>
    ),
    [status],
  );

  const chosenPurposes = purposes.filter((purpose) => Boolean(selection[purpose.purposeId]));

  const handleStartEditing = () => {
    setEditing(true);
    setConfirm(false);
    setDocumentError(null);
    setNoteError(null);
    setNote(summary?.exclusionNote ?? "");
    setSelection(buildInitialSelection(summary));
    resetDocument();
  };

  const handleCancelEditing = () => {
    setEditing(false);
    setConfirm(false);
    setDocumentError(null);
    setNoteError(null);
    resetDocument();
  };

  return (
    <Card variant="plain" size="flush">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CameraIcon className="h-4 w-4" aria-hidden="true" />
          <span>Fotoerlaubnis</span>
          {statusBadge}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {summary?.versions && summary.versions.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setShowHistory((prev) => !prev)}
              aria-expanded={showHistory}
            >
              <HistoryIcon className="mr-1 h-4 w-4" aria-hidden="true" />
              Verlauf ({summary.versions.length})
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="xs" onClick={() => window.print()}>
            <PrinterIcon className="mr-1 h-4 w-4" aria-hidden="true" />
            Drucken
          </Button>
        </div>
      </div>

      <CardContent className="space-y-4 p-4 text-sm">
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
          <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-foreground">
            <p>
              Bitte trage zuerst dein Geburtsdatum ein. Daran sehen wir, ob zusätzlich eine
              Einwilligung der Eltern nötig ist.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/mitglieder/profil?bereich=stammdaten">Geburtsdatum eintragen</Link>
            </Button>
          </div>
        ) : showHistory ? (
          <VersionHistory versions={summary?.versions ?? []} />
        ) : isCollapsible && !editing ? (
          <div
            className={cn(
              "space-y-2 rounded-lg border p-3",
              status === "approved"
                ? "border-success/40 bg-success/10 text-foreground"
                : "border-muted bg-muted/40 text-foreground",
            )}
          >
            {status === "approved" ? (
              <>
                <p className="flex items-center gap-2">
                  <CheckCircle2Icon className="h-4 w-4 text-success" aria-hidden="true" />
                  Vielen Dank – deine Fotoerlaubnis ist freigegeben.
                </p>
                <p className="text-xs text-muted-foreground">
                  Bestätigt am {formatDate(summary?.approvedAt) ?? "unbekannt"}
                  {summary?.approvedByName ? ` durch ${summary.approvedByName}` : ""}.
                </p>
                {chosenPurposes.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Erlaubt: {chosenPurposes.map((purpose) => purpose.label).join(", ")}
                  </p>
                ) : null}
                {summary?.exclusionNote ? (
                  <p className="text-xs text-muted-foreground">
                    Deine Ausschlüsse: {summary.exclusionNote}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">Keine Aufnahmen erlaubt</p>
                <p className="text-xs text-muted-foreground">
                  Du hast „gar nicht“ gewählt. Du kannst das jederzeit ändern.
                </p>
              </>
            )}
            <div className="mt-1 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleStartEditing}>
                <EditIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                Ändern
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
                <RefreshIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                Aktualisieren
              </Button>
            </div>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {status === "rejected" && summary?.rejectionReason ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                Ablehnungsgrund: {summary.rejectionReason}
              </div>
            ) : null}
            {status === "approved" ? (
              <div className="rounded-md border border-info/40 bg-info/10 p-3 text-xs text-info">
                Deine Freigabe wird nach dem Speichern erneut geprüft.
              </div>
            ) : null}

            <fieldset className="space-y-2 rounded-lg border border-border/60 p-3">
              <legend className="px-1 text-sm font-semibold text-foreground">
                Was darf gemacht werden?
              </legend>
              <p className="text-xs text-muted-foreground">
                Mehrfachauswahl. „Gar nicht“ schließt alle anderen Punkte aus.
              </p>
              <div className="space-y-2">
                {purposes.map((purpose) => (
                  <label
                    key={purpose.purposeId}
                    className="flex items-start gap-3 rounded-md border border-border/50 p-2 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={Boolean(selection[purpose.purposeId])}
                      disabled={
                        submitting ||
                        (!purpose.isRefusal && isRefusalSelected && !selection[purpose.purposeId])
                      }
                      onCheckedChange={(checked) =>
                        handleTogglePurpose(purpose.purposeId, checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-foreground">{purpose.label}</span>
                      {purpose.description ? (
                        <span className="block text-xs text-muted-foreground">
                          {purpose.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3">
              <PrinterIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">
                {requiresDocument
                  ? "Jünger als 18? Drucke das Formular aus, lass es von deinen Erziehungsberechtigten unterschreiben und lade es als Foto oder Datei hoch."
                  : "Du kannst das Formular auch ausdrucken und unterschreiben lassen."}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="ml-auto"
                onClick={() => window.print()}
              >
                Drucken
              </Button>
            </div>

            {isRefusalSelected ? (
              <div className="rounded-lg border border-muted bg-muted/40 p-3 text-muted-foreground">
                Du hast „gar nicht“ gewählt. Es ist kein Nachweis nötig – deine Ablehnung wird
                sofort gespeichert.
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-border/60 p-3">
                <div className="text-sm font-semibold text-foreground">
                  {requiresDocument
                    ? "Einverständnis der Erziehungsberechtigten"
                    : "Unterschrift oder Nachweis"}
                </div>
                {requiresDocument ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={submitting}
                    >
                      <CameraIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                      Foto aufnehmen
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={submitting}
                    >
                      <UploadIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                      Datei wählen
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={signatureMode === "upload" ? "default" : "outline"}
                        size="sm"
                        onClick={handleSelectUploadMode}
                        disabled={submitting}
                      >
                        <UploadIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                        Hochladen
                      </Button>
                      <Button
                        type="button"
                        variant={signatureMode === "signature" ? "default" : "outline"}
                        size="sm"
                        onClick={handleSelectSignatureMode}
                        disabled={submitting}
                      >
                        Digital unterschreiben
                      </Button>
                    </div>
                    {signatureMode === "signature" ? (
                      <SignaturePad value={signatureResult} onChange={setSignatureResult} />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={submitting}
                        >
                          <UploadIcon className="mr-1 h-4 w-4" aria-hidden="true" />
                          Datei wählen
                        </Button>
                      </div>
                    )}
                  </>
                )}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {documentFile ? (
                  <p className="text-xs text-muted-foreground">Ausgewählt: {documentFile.name}</p>
                ) : summary?.hasDocument && summary.documentName ? (
                  <p className="text-xs text-muted-foreground">
                    Bereits hinterlegt: {summary.documentName}
                  </p>
                ) : null}
                {signatureResult ? (
                  <div className="h-32 w-full overflow-hidden rounded-lg border border-border/60">
                    <SignatureVisualizer
                      payload={signatureResult.payload}
                      mode="outline"
                      className="h-full w-full"
                    />
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="text-sm font-semibold text-foreground">
                Optional: Bereiche ausschließen
              </div>
              <p className="text-xs text-muted-foreground">
                Notiere, auf welchen Kanälen oder Motiven du nicht erscheinen möchtest.
              </p>
              <Textarea
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  if (noteError) setNoteError(null);
                }}
                maxLength={MAX_NOTE_LENGTH}
                rows={3}
                disabled={submitting}
                placeholder="Zum Beispiel: keine Nahaufnahmen"
              />
              <div className="flex justify-between text-[11px] text-foreground/50">
                <span>Max. {MAX_NOTE_LENGTH} Zeichen</span>
                <span>
                  {note.length}/{MAX_NOTE_LENGTH}
                </span>
              </div>
              {noteError ? <p className="text-sm text-destructive">{noteError}</p> : null}
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
              <Checkbox
                checked={confirm}
                onCheckedChange={(checked) => setConfirm(checked === true)}
                disabled={submitting}
                className="mt-0.5"
              />
              <span className="text-foreground/80">
                <span className="font-semibold text-foreground">Ich bestätige,</span> dass die
                Angaben stimmen und ich die Fotoerlaubnis so abgeben möchte.
              </span>
            </label>

            {documentError ? <p className="text-sm text-destructive">{documentError}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={submitting} className="min-h-11">
                {submitting ? "Wird gesendet …" : "Fotoerlaubnis abgeben"}
              </Button>
              {editing && isCollapsible ? (
                <Button type="button" variant="ghost" onClick={handleCancelEditing}>
                  Abbrechen
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </CardContent>

      <ConsentPrintArea purposes={purposes} />

      <ConfirmDialog
        open={refusalConfirmOpen}
        onOpenChange={setRefusalConfirmOpen}
        title="Aufnahmen komplett ablehnen?"
        description="Du erlaubst dann keine Foto- und Filmaufnahmen. Du kannst das jederzeit ändern."
        confirmLabel="Ablehnen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => {
          setRefusalConfirmOpen(false);
          void submitConsent();
        }}
        onCancel={() => setRefusalConfirmOpen(false)}
      />
    </Card>
  );
}
