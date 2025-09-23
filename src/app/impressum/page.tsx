import type { Metadata } from "next";

import { Heading, Text } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Impressum",
  description:
    "Rechtliche Informationen, Kontaktangaben und Verantwortlichkeiten des Sommertheaters Altrossthal auf einen Blick.",
  alternates: {
    canonical: "/impressum",
  },
  openGraph: {
    title: "Impressum",
    description:
      "Verantwortliche Stelle, Kontakt und rechtliche Hinweise des Sommertheaters Altrossthal.",
    url: "/impressum",
    type: "website",
    images: [
      {
        url: "/images/SNT_2.png",
        alt: "Historische Schlossmauern im Abendlicht",
      },
    ],
    siteName: "Sommertheater Altrossthal",
  },
  twitter: {
    card: "summary_large_image",
    title: "Impressum",
    description:
      "Alle gesetzlichen Angaben zum Sommertheater Altrossthal.",
    images: ["/images/SNT_2.png"],
  },
};

export default function ImpressumPage() {
  return (
    <div className="layout-container space-y-6 py-12">
      <Heading level="h1">Impressum</Heading>
      <Text tone="muted">Bitte Platzhalter durch echte Schultheater- bzw. Anbieter-Daten ersetzen.</Text>
      <div className="space-y-2">
        <Heading level="h3" className="text-xl" weight="bold">
          Schultheater
        </Heading>
        <Text>Sommertheater „Schlossparktheater“</Text>
        <Text>Altroßthal 1, 01169 Dresden</Text>
        <Text>Vertreten durch die Projektleitung (Vorname Nachname)</Text>
      </div>
      <div className="space-y-2">
        <Heading level="h3" className="text-xl" weight="bold">
          Kontakt
        </Heading>
        <Text>E-Mail: kontakt@example.org</Text>
        <Text>Telefon: +49 (0) 000 000 00</Text>
      </div>
      <div className="space-y-2">
        <Heading level="h3" className="text-xl" weight="bold">
          Schule / Träger
        </Heading>
        <Text>Schule: BSZ für Agrarwirtschaft und Ernährung Dresden</Text>
        <Text>Schulträger: Landeshauptstadt Dresden (Platzhalter)</Text>
      </div>
      <div className="space-y-2">
        <Heading level="h3" className="text-xl" weight="bold">
          Haftung
        </Heading>
        <Text>Inhalte mit Sorgfalt erstellt. Keine Haftung für externe Links.</Text>
      </div>
    </div>
  );
}

