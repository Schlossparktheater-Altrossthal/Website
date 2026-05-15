import type { Metadata } from "next";
import Link from "next/link";

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

      <div className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          Angaben gemäß §5 TMG
        </Heading>
        <Text>Freunde und Förderer des Beruflichen Schulzentrums für Agrarwirtschaft und Ernährung e.V.</Text>
        <Text>
          <a
            className="underline underline-offset-4 transition-colors hover:text-primary"
            href="https://maps.google.com/?q=Altro%C3%9Fthal+1,+01169+Dresden"
            target="_blank"
            rel="noreferrer"
          >
            Altroßthal 1
          </a>
        </Text>
        <Text>
          <a
            className="underline underline-offset-4 transition-colors hover:text-primary"
            href="https://maps.google.com/?q=Altro%C3%9Fthal+1,+01169+Dresden"
            target="_blank"
            rel="noreferrer"
          >
            01169 Dresden
          </a>
        </Text>
        <Text>Registergericht: Amtsgericht Dresden</Text>
        <Text>Registernummer: VR 2281</Text>
      </div>

      <div className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h3" className="text-xl" weight="bold">
          Vorstand (Vertretungsberechtigte)
        </Heading>
        <Text>Dr. Falk Hohmann (1. Vorsitzender)</Text>
        <Text>Anke Habich (2. Vorsitzende)</Text>
      </div>

      <div className="space-y-2 border-t border-border pt-6">
        <Heading level="h3" className="text-xl" weight="bold">
          Kontakt
        </Heading>
        <Text>BSZ für Agrarwirtschaft und Ernährung Dresden</Text>
        <Text>Canalettostraße 8, 01307 Dresden</Text>
        <Text>
          E-Mail:{" "}
          <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="mailto:info@bsz-ae-dd.de">
            info@bsz-ae-dd.de
          </Link>
        </Text>
        <Text>
          Tel.:{" "}
          <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="tel:+493514350940">
            0351 / 435094 0
          </Link>
        </Text>
        <Text>
          Fax:{" "}
          <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="tel:+4935143509420">
            0351 / 435094 20
          </Link>
        </Text>
      </div>
    </div>
  );
}
