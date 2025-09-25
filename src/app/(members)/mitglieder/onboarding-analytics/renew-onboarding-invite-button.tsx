"use client";

import { useTransition } from "react";

import { RefreshCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { renewOnboardingInviteAction } from "./actions";
import type { OnboardingInviteSummary } from "@/lib/onboarding-analytics";

type RenewOnboardingInviteButtonProps = {
  profileId: string;
  showLabel: string;
  invite: OnboardingInviteSummary | null;
  className?: string;
};

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

export function RenewOnboardingInviteButton({
  profileId,
  showLabel,
  invite,
  className,
}: RenewOnboardingInviteButtonProps) {
  const [isPending, startTransition] = useTransition();

  const disabled = !invite || isPending;
  const buttonLabel = invite?.isExpired || invite?.isDisabled ? "Einladung reaktivieren" : "Einladung verlängern";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={disabled}
      onClick={() => {
        if (!invite || isPending) return;
        startTransition(async () => {
          const result = await renewOnboardingInviteAction({ profileId });
          if (result.success) {
            const expiresAt = result.invite.expiresAt ? new Date(result.invite.expiresAt) : null;
            const formatted = expiresAt ? dateFormat.format(expiresAt) : null;
            toast.success(
              formatted
                ? `Einladungslink für ${showLabel} bis ${formatted} verlängert.`
                : `Einladungslink für ${showLabel} reaktiviert.`,
            );
          } else {
            switch (result.error) {
              case "not_authorized":
                toast.error("Du hast keine Berechtigung, diesen Link zu erneuern.");
                break;
              case "profile_not_found":
                toast.error("Das Onboarding konnte nicht gefunden werden.");
                break;
              case "missing_invite":
                toast.error("Für dieses Onboarding ist kein Einladungslink hinterlegt.");
                break;
              case "missing_production":
                toast.error("Dieses Onboarding ist keiner Produktion zugeordnet.");
                break;
              case "validation_failed":
                toast.error("Die Anfrage war unvollständig.");
                break;
              default:
                toast.error("Der Einladungslink konnte nicht erneuert werden.");
            }
          }
        });
      }}
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Wird aktualisiert…
        </>
      ) : (
        <>
          <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          {buttonLabel}
        </>
      )}
    </Button>
  );
}
