import { Heading, Text } from "@/components/ui/typography";

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

