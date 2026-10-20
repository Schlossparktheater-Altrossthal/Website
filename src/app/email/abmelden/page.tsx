import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { verifyUnsubscribeSignature } from "@/lib/email/unsubscribe";

import { UnsubscribeForm } from "./unsubscribe-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-Mails abbestellen",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; s?: string }>;
}) {
  const { u = "", s = "" } = await searchParams;
  const valid = Boolean(u) && verifyUnsubscribeSignature(u, s);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          E-Mails abbestellen
        </h1>
        {valid ? (
          <>
            <p className="text-sm text-muted-foreground">
              Du bekommst dann keine Zusammenfassungen und keine normalen Hinweise mehr per Mail.
              Aufgaben, die du erledigen musst, und Dringendes wie kurzfristige Absagen kommen
              weiterhin – sonst würdest du Wichtiges verpassen.
            </p>
            <UnsubscribeForm userId={u} signature={s} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Der Link ist ungültig. Du kannst deine Mails im{" "}
            <Link
              href="/mitglieder/profil?bereich=benachrichtigungen"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Profil
            </Link>{" "}
            einstellen.
          </p>
        )}
      </Card>
    </main>
  );
}
