"use client";

import { useEffect } from "react";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useProfileCompletion } from "@/components/members/profile-completion-context";
import type { PhotoConsentSummary } from "@/types/photo-consent";

interface ProfilePhotoConsentNoticeProps {
  summary: PhotoConsentSummary | null;
  onManage?: () => void;
}

function isConsentComplete(summary: PhotoConsentSummary | null): boolean {
  if (!summary) return false;
  if (summary.status === "none" || summary.status === "rejected") {
    return false;
  }
  return true;
}

export function ProfilePhotoConsentNotice({
  summary,
  onManage,
}: ProfilePhotoConsentNoticeProps) {
  const { setItemComplete } = useProfileCompletion();

  const consentComplete = isConsentComplete(summary);

  // Synchronisiere den Completion-Status mit der Checkliste
  useEffect(() => {
    setItemComplete("photo-consent", consentComplete);
  }, [consentComplete, setItemComplete]);

  if (!summary) {
    return null;
  }

  const needsBirthdate = summary.requiresDateOfBirth;
  const needsDocument = summary.requiresDocument && !summary.hasDocument;
  const statusIsPending = summary.status === "pending";

  const shouldShowBanner =
    !consentComplete || needsBirthdate || needsDocument;

  if (!shouldShowBanner) {
    return null;
  }

  let title = "Fotoeinverständnis ausstehend";
  let description =
    "Bitte bestätige dein Fotoeinverständnis, damit wir dich bei Produktionen und Marketing berücksichtigen können.";

  if (summary.status === "rejected") {
    title = "Fotoeinverständnis abgelehnt";
    description =
      "Die letzte Einreichung wurde abgelehnt. Bitte reiche die Erklärung erneut ein, damit wir dich berücksichtigen dürfen.";
  } else if (needsBirthdate) {
    description =
      "Ergänze zuerst dein Geburtsdatum, um das Fotoeinverständnis abschließen zu können.";
  } else if (needsDocument && !statusIsPending) {
    description =
      "Für Minderjährige benötigen wir zusätzlich das unterschriebene Dokument. Lade es hoch, um die Freigabe zu vervollständigen.";
  }

  return (
    <div className="rounded-2xl border border-warning/45 bg-warning/10 p-4 text-sm text-warning shadow-[0_18px_48px_rgba(253,176,34,0.12)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-full border border-warning/40 bg-warning/15 p-2">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-warning/90">{description}</p>
          </div>
        </div>
        {onManage ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start border-warning/40 text-warning hover:bg-warning/10"
            onClick={onManage}
          >
            Jetzt erledigen
          </Button>
        ) : null}
      </div>
    </div>
  );
}
