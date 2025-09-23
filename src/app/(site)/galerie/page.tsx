import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Archiv und Bilder",
  description:
    "Das Medienarchiv mit Upload-Funktion liegt im geschützten Mitgliederbereich. Melde dich an, um Fotos und Videos vergangener Jahre zu verwalten.",
};

export default function PublicGalleryPage() {
  return (
    <div className="layout-container flex min-h-[60vh] items-center justify-center py-24">
      <Card className="max-w-2xl">
        <CardContent className="space-y-6 p-8 text-center">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold">Archiv und Bilder nur für Mitglieder</h1>
            <p className="text-sm text-muted-foreground">
              Unser Medienarchiv mit Jahrgangsordnern liegt im geschützten Mitgliederbereich. Dort kannst du Fotos und Videos aus
              vergangenen Spielzeiten hochladen, beschreiben und ansehen.
            </p>
          </div>
          <Button asChild>
            <Link href="/login?redirect=/mitglieder/archiv-und-bilder">Zum Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
