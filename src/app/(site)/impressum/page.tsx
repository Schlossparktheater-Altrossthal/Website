import type { Metadata } from "next";

import { Heading, Text } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Impressum",
  description: "Rechtliche Informationen und Kontaktangaben des BSZ für Agrarwirtschaft und Ernährung Dresden.",
  alternates: {
    canonical: "/impressum",
  },
  openGraph: {
    title: "Impressum",
    description: "Verantwortliche Stelle und Kontakt des BSZ für Agrarwirtschaft und Ernährung Dresden.",
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
    description: "Alle gesetzlichen Angaben zum BSZ für Agrarwirtschaft und Ernährung Dresden.",
    images: ["/images/SNT_2.png"],
  },
};

export default function ImpressumPage() {
  return (
    <div className="layout-container space-y-6 py-12">
      <Heading level="h1">Impressum</Heading>

      <div className="space-y-2">
        <Heading level="h2" className="text-xl" weight="bold">
          BSZ für Agrarwirtschaft und Ernährung Dresden
        </Heading>
        <Text>Canalettostraße 8</Text>
        <Text>01307 Dresden</Text>
      </div>

      <div className="space-y-2">
        <Heading level="h3" className="text-xl" weight="bold">
          Schulleiterin
        </Heading>
        <Text>Anja Unger</Text>
      </div>

      <div className="space-y-2">
        <Heading level="h3" className="text-xl" weight="bold">
          Kontakt
        </Heading>
        <Text>E-Mail: info@bsz-ae-dd.de</Text>
        <Text>Tel.: 0351 / 435094 0</Text>
        <Text>Fax: 0351 / 435094 20</Text>
      </div>
    </div>
  );
}
