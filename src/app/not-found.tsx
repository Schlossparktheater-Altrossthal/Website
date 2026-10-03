import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";

// Ersetzt die englische Standardseite von Next.js – gilt für alle unbekannten Adressen.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="font-serif text-5xl text-primary">404</p>
        <div className="space-y-2">
          <Heading level="h1" className="text-2xl">
            Seite nicht gefunden
          </Heading>
          <Text tone="muted" variant="body">
            Diese Adresse gibt es nicht (mehr). Vielleicht wurde die Seite verschoben oder der Link
            ist veraltet.
          </Text>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/mitglieder">Zum Mitgliederbereich</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Zur Startseite</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
