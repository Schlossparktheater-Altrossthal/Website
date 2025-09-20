import type { Metadata } from "next";

import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { hashOwnerSetupToken, ownerExists } from "@/lib/owner-setup";

import { OwnerSetupForm } from "./owner-setup-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Owner anlegen",
};

interface OwnerSetupPageProps {
  params: { token?: string };
}

export default async function OwnerSetupPage({ params }: OwnerSetupPageProps) {
  const token = typeof params?.token === "string" ? params.token.trim() : "";

  if (!token) {
    return <InvalidToken message="Dieser Link ist ungültig." />;
  }

  const tokenHash = hashOwnerSetupToken(token);

  const [setupToken, hasOwner] = await Promise.all([
    prisma.ownerSetupToken.findUnique({ where: { tokenHash } }),
    ownerExists(),
  ]);

  if (!setupToken) {
    return (
      <InvalidToken message="Dieser Link ist nicht bekannt. Bitte starte den Server neu, um einen aktuellen Link zu erhalten." />
    );
  }

  if (setupToken.consumedAt) {
    return <InvalidToken message="Dieser Link wurde bereits verwendet." />;
  }

  if (hasOwner) {
    return <InvalidToken message="Es existiert bereits ein Owner. Du kannst dich mit deinem Konto anmelden." />;
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center gap-8 px-4 py-16">
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Erstkonfiguration</p>
        <h1 className="font-serif text-4xl">Owner-Zugang anlegen</h1>
        <p className="text-base text-muted-foreground">
          Für eine neue Installation ist mindestens ein Owner-Konto erforderlich. Bitte vergebe unten Zugangsdaten.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm">
        <OwnerSetupForm token={token} />
      </div>

      <p className="text-sm text-muted-foreground">
        Nach erfolgreicher Einrichtung kannst du dich jederzeit über das <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">Login</Link> anmelden.
      </p>
    </main>
  );
}

interface InvalidTokenProps {
  message: string;
}

function InvalidToken({ message }: InvalidTokenProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-6 px-4 py-16 text-center">
      <h1 className="font-serif text-4xl">Owner-Link ungültig</h1>
      <p className="text-base text-muted-foreground">{message}</p>
      <p className="text-sm text-muted-foreground">
        Falls du noch keinen Owner angelegt hast, starte den Server neu, um einen neuen Link in der Konsole zu erhalten.
      </p>
      <p className="text-sm text-muted-foreground">
        Bereits eingerichtet? Dann geht es hier zum <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">Login</Link>.
      </p>
    </main>
  );
}
