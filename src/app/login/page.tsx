import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  getLegacyPasswordLoginDeadline,
  isAuthentikLoginEnabled,
  isAuthentikProvisioningEnabled,
  isLegacyPasswordLoginActive,
} from "@/lib/authentik/config";

import { getSession } from "@/lib/rbac";

import { LoginPageClient } from "./login-client";

export const metadata: Metadata = {
  title: "Login",
  description:
    "Melde dich im Mitgliederbereich des Sommertheaters Altrossthal an, um interne Inhalte und Werkzeuge zu nutzen.",
  alternates: {
    canonical: "/login",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  openGraph: {
    title: "Login",
    description:
      "Zugang zum internen Mitgliederbereich des Sommertheaters Altrossthal mit Tools für Ensemble und Crew.",
    url: "/login",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Login",
    description: "Hier meldest du dich im Mitgliederbereich des Sommertheaters Altrossthal an.",
  },
};

/** Nur lokale Pfade als Ziel zulassen (kein Open Redirect über callbackUrl). */
function safeCallbackPath(value: string | string[] | undefined): string {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return "/mitglieder";
  }
  return path;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Authentik-Konfiguration und Stichtag kommen zur Laufzeit aus der Umgebung.
  await connection();

  // Schon angemeldet (z. B. über "Anmelden" auf der Drupal-Website): nicht
  // erneut den Login anbieten, sondern direkt weiter.
  const params = await searchParams;
  const session = await getSession().catch(() => null);
  if (session?.user && !session.user.isDeactivated && !params.error) {
    redirect(safeCallbackPath(params.callbackUrl));
  }
  const authentikEnabled = isAuthentikLoginEnabled();
  const authentikProvisioning = isAuthentikProvisioningEnabled();
  const legacyLoginActive = isLegacyPasswordLoginActive();
  const legacyLoginDeadline = authentikProvisioning
    ? (getLegacyPasswordLoginDeadline()?.toISOString() ?? null)
    : null;

  return (
    <main id="main" className="min-h-svh px-4 py-16">
      <Suspense fallback={null}>
        <LoginPageClient
          authentikEnabled={authentikEnabled}
          authentikProvisioning={authentikProvisioning}
          legacyLoginActive={legacyLoginActive}
          legacyLoginDeadline={legacyLoginDeadline}
        />
      </Suspense>
    </main>
  );
}
