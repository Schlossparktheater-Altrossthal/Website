import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  getLegacyPasswordLoginDeadline,
  isAuthentikEnabled,
  isLegacyPasswordLoginActive,
} from "@/lib/authentik/config";

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

export default async function LoginPage() {
  // Authentik-Konfiguration und Stichtag kommen zur Laufzeit aus der Umgebung.
  await connection();
  const authentikEnabled = isAuthentikEnabled();
  const legacyLoginActive = isLegacyPasswordLoginActive();
  const legacyLoginDeadline = authentikEnabled
    ? (getLegacyPasswordLoginDeadline()?.toISOString() ?? null)
    : null;

  return (
    <main id="main" className="min-h-svh px-4 py-16">
      <Suspense fallback={null}>
        <LoginPageClient
          authentikEnabled={authentikEnabled}
          legacyLoginActive={legacyLoginActive}
          legacyLoginDeadline={legacyLoginDeadline}
        />
      </Suspense>
    </main>
  );
}
