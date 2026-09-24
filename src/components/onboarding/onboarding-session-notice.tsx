"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type OnboardingSessionNoticeProps = {
  /** Anzeigename des angemeldeten Kontos. */
  name: string;
  email: string | null;
  /** Authentik-Abmeldung (Single Sign-out), sonst meldet „Anmelden“ still wieder dasselbe Konto an. */
  authentikLogoutUrl: string | null;
  /** Gesetzt auf der Startseite des Einladungslinks: Weiter zum Rückkehrer-Formular. */
  continueHref?: string;
};

/**
 * Wer einen Einladungslink mit bestehender Anmeldung öffnet (z. B. auf einem geteilten Gerät
 * oder als Admin beim Testen), sieht, mit welchem Konto es weitergeht, und kann sich abmelden.
 */
export function OnboardingSessionNotice({
  name,
  email,
  authentikLogoutUrl,
  continueHref,
}: OnboardingSessionNoticeProps) {
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    const back = window.location.href;
    try {
      await signOut({ redirect: false });
      if (authentikLogoutUrl) {
        const target = new URL(authentikLogoutUrl);
        target.searchParams.set("next", back);
        window.location.assign(target.toString());
        return;
      }
      window.location.assign(back);
    } catch {
      toast.error("Abmelden fehlgeschlagen");
      setLoading(false);
    }
  }

  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-md border border-border bg-muted/50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        Du bist angemeldet als <span className="font-medium">{name}</span>
        {email && email !== name ? <span className="text-muted-foreground"> ({email})</span> : null}
        .{" "}
        {continueHref
          ? "Warst du schon mal dabei, geht es mit diesem Konto weiter – deine Angaben sind dann schon ausgefüllt."
          : "Die folgenden Angaben gehören zu diesem Konto."}
      </p>
      <div className="flex shrink-0 flex-wrap gap-2">
        {continueHref ? (
          <Button asChild size="sm">
            <Link href={continueHref}>Weiter als {name}</Link>
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={onLogout} disabled={loading}>
          Nicht du? Abmelden
        </Button>
      </div>
    </div>
  );
}
