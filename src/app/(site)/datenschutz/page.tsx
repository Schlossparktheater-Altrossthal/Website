import type { Metadata } from "next";
import Link from "next/link";

import { Heading, Text } from "@/components/ui/typography";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzhinweise des Sommertheaters Altrossthal.",
  alternates: {
    canonical: "/datenschutz",
  },
};

export default function DatenschutzPage() {
  return (
    <div className="layout-container space-y-6 py-12">
      <Heading level="h1">Datenschutzerklärung</Heading>

      <div className="space-y-3">
        <Heading level="h2" className="text-xl" weight="bold">
          1. Verantwortlicher
        </Heading>
        <Text>Freunde und Förderer des BSZ für Agrarwirtschaft und Ernährung e.V.</Text>
        <Text>Altroßthal 1, 01169 Dresden</Text>
      </div>

      <div className="space-y-3">
        <Heading level="h2" className="text-xl" weight="bold">
          2. Allgemeine Hinweise zur Datenverarbeitung
        </Heading>
        <Text>
          Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung unserer Website
          sowie zur Bearbeitung von Anfragen erforderlich ist.
        </Text>
        <Text>
          Eine Nutzung zu Werbezwecken findet nicht statt. Auf dieser Website werden keine
          personalisierten Werbeeinblendungen eingesetzt.
        </Text>
      </div>

      <div className="space-y-3">
        <Heading level="h2" className="text-xl" weight="bold">
          3. Kontaktaufnahme per E-Mail oder Kontaktformular
        </Heading>
        <Text>
          Wenn Sie uns per E-Mail oder über ein Kontaktformular kontaktieren, verarbeiten wir die von
          Ihnen übermittelten Angaben (z. B. Name, E-Mail-Adresse, Nachricht), um Ihre Anfrage zu
          bearbeiten.
        </Text>
        <Text>
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche bzw. vertragliche
          Kommunikation) oder Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Bearbeitung
          von Anfragen).
        </Text>
      </div>

      <div className="space-y-3">
        <Heading level="h2" className="text-xl" weight="bold">
          4. Keine Tracking- und Analyse-Tools
        </Heading>
        <Text>
          Wir setzen keine Tracking- oder Analyse-Tools ein, die Ihr Nutzungsverhalten
          personenbezogen auswerten.
        </Text>
      </div>

      <div className="space-y-3">
        <Heading level="h2" className="text-xl" weight="bold">
          5. Speicherdauer
        </Heading>
        <Text>
          Wir speichern personenbezogene Daten nur so lange, wie dies zur Bearbeitung Ihrer Anfrage
          oder zur Erfüllung gesetzlicher Aufbewahrungspflichten erforderlich ist.
        </Text>
      </div>

      <div className="space-y-3">
        <Heading level="h2" className="text-xl" weight="bold">
          6. Ihre Rechte
        </Heading>
        <Text>
          Sie haben nach der DSGVO das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
          Verarbeitung, Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung Ihrer Daten,
          soweit die gesetzlichen Voraussetzungen vorliegen.
        </Text>
        <Text>
          Außerdem haben Sie das Recht, sich bei einer Datenschutzaufsichtsbehörde zu beschweren.
        </Text>
      </div>

      <div className="space-y-3">
        <Heading level="h2" className="text-xl" weight="bold">
          7. Kontakt
        </Heading>
        <Text>
          Bei Fragen zum Datenschutz erreichen Sie uns unter{" "}
          <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="mailto:info@bsz-ae-dd.de">
            info@bsz-ae-dd.de
          </Link>
          .
        </Text>
      </div>
    </div>
  );
}
