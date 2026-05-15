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
      <Text>Stand: 15. Mai 2026</Text>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          1. Verantwortlicher
        </Heading>
        <Text>Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne der DSGVO ist:</Text>
        <Text>Freunde und Förderer des Beruflichen Schulzentrums für Agrarwirtschaft und Ernährung e.V.</Text>
        <Text>Altroßthal 1, 01169 Dresden</Text>
        <Text>Vertreten durch: Dr. Falk Hohmann (1. Vorsitzender), Anke Habich (2. Vorsitzende)</Text>
        <Text>
          E-Mail: <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="mailto:info@bsz-ae-dd.de">info@bsz-ae-dd.de</Link>
        </Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          2. Allgemeines zur Datenverarbeitung
        </Heading>
        <Text>
          Wir nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Diese Datenschutzerklärung informiert Sie darüber, welche
          personenbezogenen Daten wir auf unserer Website sommertheater-altrossthal.de erheben, wie wir diese nutzen und welche Rechte
          Ihnen zustehen.
        </Text>
        <Text>
          Rechtsgrundlagen für die Verarbeitung personenbezogener Daten sind insbesondere Art. 6 DSGVO. Soweit wir für
          Verarbeitungsvorgänge eine Einwilligung einholen, dient Art. 6 Abs. 1 lit. a DSGVO als Rechtsgrundlage. Sofern die Verarbeitung
          zur Wahrung berechtigter Interessen erforderlich ist und die Interessen der betroffenen Person nicht überwiegen, ist Art. 6
          Abs. 1 lit. f DSGVO Rechtsgrundlage.
        </Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          3. Hosting und Server-Logfiles
        </Heading>
        <Text>Diese Website wird auf einem selbst betriebenen Virtual Private Server (VPS) gehostet.</Text>
        <Text>Beim Aufruf unserer Website übermittelt Ihr Browser automatisch Informationen an unseren Server. Diese sogenannten Server-Logfiles enthalten:</Text>
        <ul className="list-disc space-y-1 pl-6 text-foreground">
          <li>IP-Adresse des anfragenden Rechners</li>
          <li>Datum und Uhrzeit des Zugriffs</li>
          <li>Name und URL der abgerufenen Datei</li>
          <li>Meldung über erfolgreichen Abruf (HTTP-Statuscode)</li>
          <li>Übertragene Datenmenge</li>
          <li>Browsertyp und Browserversion</li>
          <li>Betriebssystem</li>
        </ul>
        <Text>
          Die Verarbeitung erfolgt auf Basis von Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt in der technischen
          Bereitstellung und Sicherstellung des Betriebs der Website. Die Logfiles werden nach spätestens 30 Tagen gelöscht, sofern keine
          sicherheitsrelevante Auswertung erforderlich ist.
        </Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          4. Cloudflare (CDN und DDoS-Schutz)
        </Heading>
        <Text>
          Diese Website nutzt Dienste von Cloudflare Inc., 101 Townsend St., San Francisco, CA 94107, USA, als vorgelagerten Reverse
          Proxy und zum Schutz vor Angriffen (DDoS-Schutz). Alle Anfragen an unsere Website werden zunächst über die Server von
          Cloudflare geleitet.
        </Text>
        <Text>
          Dabei können technische Daten wie IP-Adresse, HTTP-Header und Anfragedaten verarbeitet werden. Cloudflare verarbeitet diese
          Daten gemäß seiner Datenschutzrichtlinie. Eine Übermittlung in die USA erfolgt auf Basis von Standardvertragsklauseln gemäß
          Art. 46 Abs. 2 lit. c DSGVO.
        </Text>
        <Text>
          Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Sicherheit und Verfügbarkeit der Website).
        </Text>
        <Text>
          Weitere Informationen: <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">https://www.cloudflare.com/privacypolicy/</Link>
        </Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          5. Kontaktaufnahme per E-Mail
        </Heading>
        <Text>
          Wenn Sie uns per E-Mail kontaktieren, werden die von Ihnen übermittelten Daten (E-Mail-Adresse, Name, Inhalt) zum Zweck der
          Bearbeitung Ihrer Anfrage gespeichert. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.
        </Text>
        <Text>
          Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Bearbeitung von Anfragen) bzw. Art. 6 Abs. 1 lit. b
          DSGVO, soweit Ihre Anfrage auf den Abschluss eines Vertrags gerichtet ist.
        </Text>
        <Text>
          Die Daten werden gelöscht, sobald Ihre Anfrage abschließend bearbeitet wurde und keine gesetzlichen Aufbewahrungspflichten
          entgegenstehen.
        </Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          6. Mitgliederbereich und Anmeldung (Magic Link)
        </Heading>
        <Text>
          Unsere Website verfügt über einen passwortgeschützten Mitgliederbereich, der ausschließlich registrierten Mitgliedern zugänglich
          ist. Für die Anmeldung verwenden wir ein sogenanntes Magic-Link-Verfahren: Sie geben Ihre E-Mail-Adresse ein und erhalten einen
          Einmal-Link zur Anmeldung.
        </Text>
        <Text>Im Zuge der Nutzung des Mitgliederbereichs verarbeiten wir folgende Daten:</Text>
        <ul className="list-disc space-y-1 pl-6 text-foreground">
          <li>E-Mail-Adresse (zur Authentifizierung und Kommunikation)</li>
          <li>Name (soweit angegeben)</li>
          <li>Vereinsrolle (z. B. Vorstand, Ensemble, Mitglied)</li>
          <li>Zeitstempel von Anmeldungen (Session-Daten)</li>
          <li>Hochgeladene oder erstellte Inhalte innerhalb der Plattform</li>
        </ul>
        <Text>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung im Rahmen der Vereinsmitgliedschaft) sowie Art. 6 Abs. 1 lit. f DSGVO.</Text>
        <Text>
          Die Daten werden gelöscht oder gesperrt, sobald die Mitgliedschaft endet oder der Zweck der Speicherung entfällt, sofern keine
          gesetzlichen Aufbewahrungspflichten bestehen.
        </Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          7. Nextcloud (Dateiablage)
        </Heading>
        <Text>
          Für die vereinsinterne Dateiablage und Zusammenarbeit betreiben wir eine eigene Nextcloud-Instanz unter
          cloud.sommertheater-altrossthal.de. Dabei werden Nutzerdaten (E-Mail-Adresse, hochgeladene Dateien, Aktivitätsprotokolle)
          ausschließlich auf unserem eigenen Server gespeichert und nicht an Dritte übermittelt.
        </Text>
        <Text>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vereinsmitgliedschaft).</Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          8. Cookies und Session-Daten
        </Heading>
        <Text>
          Unsere Website verwendet technisch notwendige Cookies, um den Betrieb des Mitgliederbereichs zu ermöglichen (Session-Cookie für
          den Login). Diese Cookies enthalten keine personenbezogenen Daten im eigentlichen Sinne, sondern lediglich eine zufällig
          generierte Session-ID.
        </Text>
        <Text>Wir verwenden keine Tracking-Cookies, keine Werbe-Cookies und kein Cookie-basiertes Analyse-Tracking.</Text>
        <Text>
          Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Technisch notwendige Cookies erfordern keine Einwilligung gemäß § 25 Abs. 2 TTDSG.
        </Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          9. Keine Drittanbieter-Tracking-Dienste
        </Heading>
        <Text>
          Wir setzen auf dieser Website keine Analyse- oder Tracking-Werkzeuge von Drittanbietern ein (z. B. Google Analytics, Facebook
          Pixel o. Ä.). Es findet keine Weitergabe Ihrer Daten zu Werbe- oder Analysezwecken an Dritte statt.
        </Text>
        <Text>
          Hinweis: Sollten zu einem späteren Zeitpunkt externe Dienste eingebunden werden (z. B. eingebettete Videos, Kartendienste,
          externe Schriftarten), wird diese Datenschutzerklärung entsprechend aktualisiert.
        </Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          10. Ihre Rechte als betroffene Person
        </Heading>
        <Text>Sie haben gegenüber uns folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:</Text>
        <ul className="list-disc space-y-1 pl-6 text-foreground">
          <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
          <li>Recht auf Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Recht auf Löschung (Art. 17 DSGVO)</li>
          <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruchsrecht gegen die Verarbeitung (Art. 21 DSGVO)</li>
          <li>Recht auf Widerruf erteilter Einwilligungen (Art. 7 Abs. 3 DSGVO)</li>
        </ul>
        <Text>Zur Ausübung Ihrer Rechte wenden Sie sich bitte an die oben genannte Kontaktadresse.</Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          11. Beschwerderecht bei der Aufsichtsbehörde
        </Heading>
        <Text>
          Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen Daten durch uns
          zu beschweren. Die zuständige Aufsichtsbehörde richtet sich nach dem Bundesland des Vereinssitzes.
        </Text>
        <Text>
          Hinweis: Sächsischer Datenschutzbeauftragter (SächsDSB)
          <br />
          Website: <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="https://www.saechsdsb.de" target="_blank" rel="noreferrer">https://www.saechsdsb.de</Link>
        </Text>
        <Text>
          Eine Übersicht aller deutschen Datenschutz-Aufsichtsbehörden finden Sie unter: <Link className="underline underline-offset-4 transition-colors hover:text-primary" href="https://www.bfdi.bund.de/DE/Infothek/Anschriften_Links/anschriften_links-node.html" target="_blank" rel="noreferrer">https://www.bfdi.bund.de/DE/Infothek/Anschriften_Links/anschriften_links-node.html</Link>
        </Text>
      </section>

      <section className="mb-8 space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          12. Datensicherheit
        </Heading>
        <Text>
          Wir treffen technische und organisatorische Maßnahmen, um Ihre Daten gegen Verlust, Zerstörung, Manipulation und unberechtigten
          Zugriff zu schützen. Alle Verbindungen zu unserer Website werden per TLS/HTTPS verschlüsselt übertragen. Unsere Server sind
          durch Zugangskontrollen und aktuelle Sicherheitsupdates geschützt.
        </Text>
      </section>

      <section className="space-y-2 border-t border-border pt-6">
        <Heading level="h2" className="text-xl" weight="bold">
          13. Aktualität und Änderungen dieser Datenschutzerklärung
        </Heading>
        <Text>
          Diese Datenschutzerklärung ist aktuell gültig. Durch die Weiterentwicklung unserer Website oder aufgrund geänderter gesetzlicher
          Vorgaben kann es notwendig werden, diese Datenschutzerklärung anzupassen. Die jeweils aktuelle Fassung ist jederzeit auf unserer
          Website unter sommertheater-altrossthal.de/datenschutz abrufbar.
        </Text>
      </section>
    </div>
  );
}
