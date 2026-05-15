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

      <div className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          1. Verantwortlicher
        </Heading>
        <Text>Freunde und Förderer des Beruflichen Schulzentrums für Agrarwirtschaft und Ernährung e.V.</Text>
        <Text>Altroßthal 1, 01169 Dresden</Text>
        <Text>
          E-Mail:{" "}
          <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="mailto:info@bsz-ae-dd.de">
            info@bsz-ae-dd.de
          </Link>
        </Text>
        <Text>Vertreten durch: Dr. Falk Hohmann (1. Vorsitzender), Anke Habich (2. Vorsitzende)</Text>
      </div>

      <div className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          2. Hosting
        </Heading>
        <Text>Eigener Server in Deutschland.</Text>
        <Text>Beim Aufruf der Website werden Server-Logs gespeichert (IP-Adresse, Zeitstempel, aufgerufene Seiten).</Text>
        <Text>Speicherdauer: 7 Tage.</Text>
        <Text>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Sicherheit und Stabilität).</Text>
      </div>

      <div className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          3. Nutzerkonto und Login (Magic Link)
        </Heading>
        <Text>Zur Nutzung des Mitgliederbereichs wird eine E-Mail-Adresse benötigt.</Text>
        <Text>Der Login erfolgt per Magic Link (einmaliger Link per E-Mail, kein Passwort).</Text>
        <Text>Die E-Mail-Adresse wird gespeichert zur Authentifizierung und Verwaltung der Mitgliedschaft.</Text>
        <Text>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</Text>
      </div>

      <div className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          4. Cookies und Session
        </Heading>
        <Text>Nach dem Login wird ein Session-Cookie gesetzt, der die Anmeldung aufrechterhält.</Text>
        <Text>Es werden keine Tracking-Cookies, keine Analyse-Tools und keine Werbecookies verwendet.</Text>
      </div>

      <div className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          5. Keine Weitergabe an Dritte
        </Heading>
        <Text>Personenbezogene Daten werden nicht an Dritte weitergegeben.</Text>
        <Text>Kein Einsatz von Google Analytics, Facebook, oder ähnlichen Diensten.</Text>
      </div>

      <div className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          6. Betroffenenrechte (Art. 15–21 DSGVO)
        </Heading>
        <Text>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch.</Text>
        <Text>
          Kontakt:{" "}
          <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="mailto:info@bsz-ae-dd.de">
            info@bsz-ae-dd.de
          </Link>
        </Text>
      </div>

      <div className="space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          7. Beschwerderecht
        </Heading>
        <Text>Bei der Sächsischen Datenschutz- und Transparenzbeauftragten:</Text>
        <Text>
          <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="https://www.saechsdsb.de" target="_blank" rel="noreferrer">
            https://www.saechsdsb.de
          </Link>
        </Text>
      </div>
    </div>
  );
}
