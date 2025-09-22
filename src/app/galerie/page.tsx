import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Galerie & Medienarchiv",
  description:
    "Die Upload-Zentrale ist in den geschützten Mitgliederbereich umgezogen. Bitte melde dich an, um auf die Jahrgangsordner zuzugreifen.",
};

export default function PublicGalleryPage() {
  return (
    <div className="layout-container flex min-h-[60vh] items-center justify-center py-24">
      <Card className="max-w-2xl">
        <CardContent className="space-y-6 p-8 text-center">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold">Galerie nur für Mitglieder</h1>
            <p className="text-sm text-muted-foreground">
              Unsere Mediengalerie mit Upload-Bereich ist in den geschützten Mitgliederbereich umgezogen. Melde dich mit deinem
              Konto an, um Bilder und Videos zu verwalten.
            </p>
          </div>
          <Button asChild>
            <Link href="/login?redirect=/mitglieder/galerie">Zum Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
