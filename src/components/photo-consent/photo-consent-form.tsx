"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { SignaturePad, type SignatureResult } from "@/components/onboarding/signature-pad";
import { PhotoConsentLevelDot } from "@/components/photo-consent/photo-consent-level-badge";
import { CloseIcon, DownloadIcon, PlusIcon, UploadIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_PHOTO_CONSENT_NOTE,
  PHOTO_CONSENT_LEVEL_DEFINITIONS,
  photoConsentLevelDescription,
  photoConsentLevelsFor,
  type PhotoConsentLevelValue,
} from "@/lib/photo-consent-levels";
import { cn } from "@/lib/utils";
import type { PhotoConsentPrevious } from "@/types/photo-consent";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export type PhotoConsentProofMode = "signature" | "upload" | "later";

/** Eingaben des Formulars; wird vom Aufrufer gehalten (Profil, Onboarding, Rückkehrer). */
export type PhotoConsentDraft = {
  level: PhotoConsentLevelValue | null;
  note: string;
  proofMode: PhotoConsentProofMode;
  signature: SignatureResult | null;
  document: File | null;
};

export const EMPTY_PHOTO_CONSENT_DRAFT: PhotoConsentDraft = {
  level: null,
  note: "",
  proofMode: "signature",
  signature: null,
  document: null,
};

export type PhotoConsentDraftContext = {
  isMinor: boolean;
  /** Für diese Produktion liegt schon ein Nachweis vor (Bearbeiten). */
  hasExistingProof?: boolean;
  /** Nachreichen erlaubt (nur Minderjährige). */
  allowLater?: boolean;
};

/** Prüft den Entwurf vor dem Absenden; liefert eine Meldung oder `null`. */
export function validatePhotoConsentDraft(
  draft: PhotoConsentDraft,
  context: PhotoConsentDraftContext,
): string | null {
  if (!draft.level) {
    return "Bitte wähle aus, welche Aufnahmen erlaubt sind.";
  }
  if (draft.note.trim().length > MAX_PHOTO_CONSENT_NOTE) {
    return `Bitte kürze den Hinweis auf maximal ${MAX_PHOTO_CONSENT_NOTE} Zeichen.`;
  }
  if (draft.level === "none" || context.hasExistingProof) {
    return null;
  }
  if (draft.proofMode === "later") {
    return context.isMinor && context.allowLater !== false
      ? null
      : "Bitte unterschreibe die Fotoerlaubnis.";
  }
  if (draft.proofMode === "signature" && !draft.signature) {
    return context.isMinor
      ? "Bitte lass ein Elternteil unterschreiben."
      : "Bitte unterschreibe die Fotoerlaubnis.";
  }
  if (draft.proofMode === "upload" && !draft.document) {
    return "Bitte wähle das unterschriebene Formular aus.";
  }
  return null;
}

/** Baut die Formulardaten für `POST /api/photo-consents`. */
export function photoConsentDraftToFormData(draft: PhotoConsentDraft): FormData {
  const formData = new FormData();
  if (draft.level) formData.append("level", draft.level);
  formData.append("exclusionNote", draft.note.trim());
  if (draft.level !== "none") {
    if (draft.proofMode === "signature" && draft.signature) {
      formData.append("signaturePayload", JSON.stringify(draft.signature.payload));
    } else if (draft.proofMode === "upload" && draft.document) {
      formData.append("document", draft.document);
    } else if (draft.proofMode === "later") {
      formData.append("deferProof", "1");
    }
  }
  return formData;
}

type PhotoConsentFormProps = {
  value: PhotoConsentDraft;
  onChange: (next: PhotoConsentDraft) => void;
  isMinor: boolean;
  /** Erlaubnis aus einer früheren Produktion (nur Volljährige). */
  previous?: PhotoConsentPrevious | null;
  /** Vorhandener Nachweis bleibt gültig, ein neuer ist optional. */
  hasExistingProof?: boolean;
  allowLater?: boolean;
  /** Link auf das Elternformular (PDF), nur bei Minderjährigen angezeigt. */
  parentalTemplateHref?: string | null;
  disabled?: boolean;
  className?: string;
};

/**
 * Fotoerlaubnis in drei Schritten: Stufe wählen, Nachweis (Unterschrift oder Upload), optional
 * ein Hinweis. Wird im Profil, im Onboarding und im Rückkehrer-Assistenten verwendet.
 */
export function PhotoConsentForm({
  value,
  onChange,
  isMinor,
  previous,
  hasExistingProof = false,
  allowLater = isMinor,
  parentalTemplateHref = "/api/photo-consents/parental-template",
  disabled = false,
  className,
}: PhotoConsentFormProps) {
  const [noteOpen, setNoteOpen] = useState(Boolean(value.note));
  const [documentError, setDocumentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const levels = photoConsentLevelsFor(isMinor);
  const update = (patch: Partial<PhotoConsentDraft>) => onChange({ ...value, ...patch });
  const needsProof = value.level !== null && value.level !== "none";
  const canUsePrevious =
    !isMinor &&
    previous &&
    (value.level !== previous.level || value.note.trim() !== (previous.exclusionNote ?? ""));

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_DOCUMENT_BYTES) {
      setDocumentError("Die Datei darf höchstens 8 MB groß sein.");
      return;
    }
    const type = file.type?.toLowerCase() ?? "";
    if (type && !ALLOWED_TYPES.has(type)) {
      setDocumentError("Bitte ein Foto (JPG, PNG) oder PDF wählen.");
      return;
    }
    setDocumentError(null);
    update({ document: file });
  };

  const proofOptions: { value: PhotoConsentProofMode; label: string }[] = [
    { value: "signature", label: "Unterschreiben" },
    { value: "upload", label: "Foto/PDF hochladen" },
    ...(allowLater ? [{ value: "later" as const, label: "Später" }] : []),
  ];

  return (
    <div className={cn("space-y-6", className)}>
      {canUsePrevious ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <PhotoConsentLevelDot level={previous.level} />
            <span className="min-w-0 break-words">
              Wie bei <span className="font-medium">{previous.showTitle}</span>:{" "}
              {PHOTO_CONSENT_LEVEL_DEFINITIONS[previous.level].label}?
            </span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              update({ level: previous.level, note: previous.exclusionNote ?? "" });
              setNoteOpen(Boolean(previous.exclusionNote));
            }}
          >
            Übernehmen
          </Button>
        </div>
      ) : null}

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="mb-2 text-sm font-semibold text-foreground">
          {isMinor
            ? "Von meinem Kind dürfen in der Theater-AG Aufnahmen gemacht werden:"
            : "Von mir dürfen in der Theater-AG Aufnahmen gemacht werden:"}
        </legend>
        <div role="radiogroup" aria-label="Stufe der Fotoerlaubnis" className="grid gap-2">
          {levels.map((level) => {
            const definition = PHOTO_CONSENT_LEVEL_DEFINITIONS[level];
            const selected = value.level === level;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ level })}
                className={cn(
                  "flex min-h-11 w-full items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-primary" : "border-muted-foreground/40",
                  )}
                >
                  {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <PhotoConsentLevelDot level={level} />
                    {definition.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {photoConsentLevelDescription(level, isMinor)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {needsProof ? (
        <section className="space-y-3" aria-label="Nachweis">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              {isMinor ? "Unterschrift eines Elternteils" : "Unterschrift"}
            </h3>
            {hasExistingProof ? (
              <p className="text-xs text-muted-foreground">
                Für diese Produktion liegt schon ein Nachweis vor. Ein neuer ist nur nötig, wenn du
                ihn ersetzen willst.
              </p>
            ) : isMinor ? (
              <p className="text-xs text-muted-foreground">
                Ein Elternteil unterschreibt direkt hier auf dem Gerät oder auf dem Papierformular –
                dann davon ein Foto hochladen.
              </p>
            ) : null}
          </div>

          <SegmentedControl
            aria-label="Art des Nachweises"
            value={value.proofMode}
            onValueChange={(proofMode) => {
              setDocumentError(null);
              update({ proofMode });
            }}
            options={proofOptions.map((option) => ({ ...option, disabled }))}
            fullWidth
          />

          {value.proofMode === "signature" ? (
            <SignaturePad value={value.signature} onChange={(signature) => update({ signature })} />
          ) : null}

          {value.proofMode === "upload" ? (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                tabIndex={-1}
                onChange={handleFileChange}
              />
              {value.document ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{value.document.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="Datei entfernen"
                    onClick={() => update({ document: null })}
                  >
                    <CloseIcon className="size-4" aria-hidden />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  disabled={disabled}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon className="mr-2 size-4" aria-hidden />
                  Foto oder PDF wählen
                </Button>
              )}
              {documentError ? (
                <p className="text-xs text-destructive" role="alert">
                  {documentError}
                </p>
              ) : null}
            </div>
          ) : null}

          {value.proofMode === "later" ? (
            <p className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
              Du kannst die Unterschrift später im Profil unter „Fotoerlaubnis“ nachreichen. Bis
              dahin wirst du nicht fotografiert.
            </p>
          ) : null}

          {isMinor && parentalTemplateHref ? (
            <a
              href={parentalTemplateHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline underline-offset-2"
            >
              <DownloadIcon className="size-3.5" aria-hidden />
              Elternformular als PDF
            </a>
          ) : null}
        </section>
      ) : null}

      {value.level ? (
        noteOpen ? (
          <div className="space-y-1.5">
            <label htmlFor="photo-consent-note" className="text-sm font-semibold text-foreground">
              Hinweis <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="photo-consent-note"
              value={value.note}
              maxLength={MAX_PHOTO_CONSENT_NOTE}
              rows={2}
              disabled={disabled}
              placeholder="z. B. keine Nahaufnahmen"
              onChange={(event) => update({ note: event.target.value })}
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2"
            disabled={disabled}
            onClick={() => setNoteOpen(true)}
          >
            <PlusIcon className="mr-1.5 size-4" aria-hidden />
            Hinweis hinzufügen
          </Button>
        )
      ) : null}
    </div>
  );
}
