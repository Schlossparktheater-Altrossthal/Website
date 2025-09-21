import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Sparkles } from "lucide-react";

import { GalleryUploadArea } from "@/components/gallery/gallery-upload-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const START_YEAR = 2009;

export const metadata: Metadata = {
  title: "Galerie",
  description:
    "Lade Bilder hoch, organisiere sie in Jahresordnern von 2009 bis heute und erweitere das Archiv des Sommertheaters.",
  alternates: {
    canonical: "/galerie",
  },
  openGraph: {
    title: "Galerie & Upload-Zentrale",
    description:
      "Verwalte Bühnenmomente und Pressefotos aus allen Jahrgängen – von 2009 bis zur aktuellen Saison.",
    url: "/galerie",
  },
};

export default function GaleriePage() {
  const years = createYearRange(START_YEAR);
  const currentYear = years[0] ?? new Date().getFullYear();

  return (
    <div className="space-y-16 pb-24">
      <section className="layout-container pt-20 sm:pt-24">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <Badge className="mx-auto flex w-fit items-center gap-1 bg-primary/20 text-primary">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            Neu im Menü
          </Badge>
          <h1 className="text-balance text-h1">Galerie &amp; Upload-Zentrale</h1>
          <p className="text-lg text-muted-foreground">
            Bündle alle Produktionen, Ensemble-Momente und Presseaufnahmen an einem Ort. Vom Auftakt im Jahr
            2009 bis heute wartet jeder Jahrgangsordner auf neue Erinnerungen.
          </p>
        </div>
      </section>

      <section
        id="galerie-upload"
        aria-labelledby="galerie-upload-heading"
        className="layout-container scroll-mt-28"
      >
        <GalleryUploadArea years={years} headingId="galerie-upload-heading" />
      </section>

      <section aria-labelledby="galerie-ordner-heading" className="layout-container">
        <div className="space-y-4">
          <h2 id="galerie-ordner-heading" className="text-h2">
            Alle Jahrgangsordner im Überblick
          </h2>
          <p className="max-w-3xl text-base text-muted-foreground">
            Von den ersten Schlosspark-Inszenierungen 2009 bis zur aktuellen Saison {currentYear}: Jeder Ordner ist
            bereit für hochauflösende Bilder, Making-of-Strecken und Presseberichte. Wähle einen Jahrgang und lade
            neue Momente hoch – die Chronik aktualisiert sich automatisch.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {years.map((year) => (
            <Card key={year} className="flex h-full flex-col justify-between gap-6 border-border/60 bg-card/70 p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-semibold text-primary">{year}</span>
                  {year === currentYear ? (
                    <Badge variant="accent">Aktuelle Saison</Badge>
                  ) : year === START_YEAR ? (
                    <Badge variant="outline">Projektstart</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{getYearDescription(year, currentYear)}</p>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FolderOpen aria-hidden="true" className="h-4 w-4 text-primary/80" />
                  <span>Ordner bereit</span>
                </div>
                <Button asChild variant="outline" size="sm" className="font-medium">
                  <Link href="#galerie-upload">Zum Upload</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function createYearRange(startYear: number) {
  const currentYear = new Date().getFullYear();
  const totalYears = currentYear - startYear + 1;

  return Array.from({ length: totalYears }, (_, index) => currentYear - index);
}

function getYearDescription(year: number, currentYear: number) {
  if (year === currentYear) {
    return "Halte Proben, Premieren und Backstage-Momente der aktuellen Saison fest.";
  }

  if (year === currentYear - 1) {
    return "Schließe die Highlights der vergangenen Saison ab – von Ensemble-Porträts bis zu Pressebildern.";
  }

  if (year === START_YEAR) {
    return "Hier begann alles: Digitalisiere die ersten Aufführungen und Plakatmotive des Sommertheaters.";
  }

  if (year < 2013) {
    return `Vervollständige das frühe Archiv aus ${year} mit gescannten Prints und Making-of-Fotos.`;
  }

  if (year >= currentYear - 5) {
    return `Sammle Social-Media-Motive, Presse-Features und Bühnenbilder aus ${year}.`;
  }

  return `Füge weitere Erinnerungen aus ${year} hinzu – Kostüme, Publikumsmomente und Probendokumentation.`;
}
