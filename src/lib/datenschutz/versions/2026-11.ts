import type { PrivacyPolicyVersion } from "../policy";

/**
 * Erste Fassung der Datenschutzerklärung für den Mitgliederbereich.
 * ENTWURF – vor dem Aktivieren vom Vorstand des Fördervereins freigeben lassen.
 * Fristen entsprechen `src/lib/retention.ts`, `src/lib/email/outbox.ts`,
 * `server-analytics-settings-constants.js` und `TicketingSettings.retentionDays`.
 */
export const PRIVACY_POLICY_2026_11: PrivacyPolicyVersion = {
  version: "2026-11",
  validFrom: "2026-11-01",
  significant: true,
  changes: ["Erste Datenschutzerklärung für den Mitgliederbereich."],
  sections: [
    {
      heading: "1. Verantwortlicher",
      paragraphs: [
        "Freunde und Förderer des Beruflichen Schulzentrums für Agrarwirtschaft und Ernährung e.V., Altroßthal 1, 01169 Dresden, vertreten durch den Vorstand. Kontakt über die im Impressum der Website genannte E-Mail-Adresse.",
        "Das Sommertheater ist ein Angebot des Beruflichen Schulzentrums für Agrarwirtschaft und Ernährung Dresden. Der Förderverein betreibt als Träger die Website und diesen Mitgliederbereich, über den die Theaterarbeit organisiert wird.",
      ],
    },
    {
      heading: "2. Worum es geht",
      paragraphs: [
        "Diese Erklärung gilt für den Mitgliederbereich, also den geschützten Bereich für alle, die an Produktionen mitwirken (Ensemble, Gewerke, Leitung). Für die öffentliche Website und die Kartenbuchung gilt zusätzlich die Datenschutzerklärung der Website.",
        "Wir verarbeiten nur, was für die Theaterarbeit nötig ist. Freiwillige Angaben sind als solche gekennzeichnet und können jederzeit gelöscht werden.",
      ],
    },
    {
      heading: "3. Welche Daten wir verarbeiten und warum",
      items: [
        "Konto und Anmeldung: Name, E-Mail-Adresse, Rollen und Rechte, Anmeldeverfahren (Passkey, Einmalcode-App, Passwort) über unseren eigenen Anmeldedienst (Authentik). Zweck: Zugang zum Mitgliederbereich. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzung des Mitgliederbereichs).",
        "Profil: Geburtsdatum, Schule/Ausbildung/Klasse, Interessen, Rollen- und Gewerkewünsche, Profilbild. Zweck: Besetzung, Einteilung und Planung. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und f DSGVO.",
        "Organisation: Mitwirkung an Produktionen, Rollen, Gewerke, Termine, Sperrtermine, Anwesenheit, Aufgaben, Probenprotokolle, Notizen und Markierungen im Skript, Lernfortschritt, Ausleihen aus dem Lager. Zweck: Durchführung der Proben und Aufführungen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und f DSGVO.",
        "Allergien und Unverträglichkeiten: Gesundheitsdaten im Sinne von Art. 9 DSGVO. Zweck: sichere Verpflegung, z. B. in der Endprobenwoche. Rechtsgrundlage: ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO, jederzeit widerrufbar. Ernährungsweise (z. B. vegetarisch) ist eine freiwillige Angabe.",
        "Körpermaße und Konfektionsgrößen: Zweck: Kostüme. Rechtsgrundlage: Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO, jederzeit widerrufbar.",
        "Fotos und Fotoerlaubnis: Fotos aus Proben und Aufführungen sowie die Fotoerlaubnis mit gewählter Stufe und Unterschrift. Rechtsgrundlage: Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO, jederzeit für die Zukunft widerrufbar.",
        "Benachrichtigungen: Benachrichtigungen im Mitgliederbereich, E-Mails und – wenn du sie einschaltest – Push-Nachrichten. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO, Push-Nachrichten nach Einwilligung.",
        "Kalender-Abo: Auf Wunsch ein persönlicher Kalender-Link mit deinen Terminen. Wer den Link kennt, kann die Termine sehen; du kannst das Abo jederzeit abschalten.",
        "Technik und Statistik: Server-Logs, Ladezeiten und pseudonymisierte Nutzungsstatistik (aufgerufene Seiten, Gerätetyp, Bildschirmgröße, Verbindungsart), ohne Tracking-Cookies und ohne Drittanbieter. Zweck: Betrieb, Sicherheit und Verbesserung. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.",
      ],
    },
    {
      heading: "4. Wer die Daten sieht",
      paragraphs: [
        "Innerhalb des Mitgliederbereichs sehen Mitwirkende nur, was ihre Rolle erfordert. Allergien, Körpermaße und Gründe für Sperrtermine sehen nur Personen mit dem jeweiligen Recht (z. B. Verpflegung, Kostüm, Planung). Jeder Zugriff auf Gesundheitsdaten über Auswertungen wird protokolliert.",
        "Eine Weitergabe an Dritte zu Werbezwecken findet nicht statt. Technische Dienstleister:",
      ],
      items: [
        "Hosting: eigene Server des Theaters bei einem Rechenzentrumsbetreiber in Deutschland. [PRÜFEN: Anbieter und Auftragsverarbeitungsvertrag eintragen]",
        "Cloudflare (USA) als vorgelagerter Schutz vor Angriffen, Übermittlung auf Basis von Standardvertragsklauseln.",
        "E-Mail-Versand über unseren eigenen Mailserver.",
        "Push-Nachrichten laufen über den Push-Dienst deines Browsers (z. B. Google, Apple, Mozilla). Übermittelt werden nur verschlüsselte Inhalte an eine Geräte-Adresse.",
        "Fotos werden in unserer eigenen Foto-Verwaltung (Immich) und Dateiablage (Nextcloud) gespeichert.",
      ],
    },
    {
      heading: "5. Wie lange wir Daten speichern",
      items: [
        "Allergien und Unverträglichkeiten: bis zum Widerruf, längstens 2 Jahre nach Ende deiner letzten Produktion.",
        "Körpermaße und Konfektionsgrößen: bis zum Widerruf, längstens 2 Jahre nach Ende deiner letzten Produktion.",
        "Fotoerlaubnisse: 5 Jahre nach Ende der Produktion, als Nachweis für veröffentlichte Fotos.",
        "Konto und übrige Profildaten: Das Konto wird 6 Jahre nach Ende deiner letzten Produktion anonymisiert. Auf Wunsch löschen oder anonymisieren wir früher, soweit keine Nachweispflichten entgegenstehen.",
        "E-Mail-Inhalte im Versandprotokoll: 30 Tage.",
        "Seitenaufrufe der Nutzungsstatistik: 60 Tage, Sitzungsdaten: 180 Tage, danach nur noch zusammengefasste Zahlen.",
        "Protokoll der Auswertungen mit Gesundheitsdaten: 12 Monate.",
        "Server-Logs: höchstens 30 Tage.",
        "Push-Abos: bis du Push abschaltest oder das Gerät nicht mehr erreichbar ist.",
        "Kartenreservierungen (eigene Freikarten): Name und Kontaktdaten werden 90 Tage nach der Vorstellung anonymisiert.",
      ],
    },
    {
      heading: "6. Alter",
      paragraphs: [
        "Der Mitgliederbereich richtet sich an Personen ab 16 Jahren. Für Jüngere sind Gesundheitsdaten und Körpermaße gesperrt; diese Angaben können nur mit Zustimmung der Sorgeberechtigten über die Theaterleitung erfasst werden.",
      ],
    },
    {
      heading: "7. Deine Rechte",
      items: [
        "Auskunft über deine Daten (Art. 15 DSGVO)",
        "Berichtigung (Art. 16) – vieles kannst du direkt im Profil ändern",
        "Löschung (Art. 17) und Einschränkung der Verarbeitung (Art. 18)",
        "Datenübertragbarkeit (Art. 20)",
        "Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21)",
        "Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3), im Profil oder formlos an die Theaterleitung",
        "Beschwerde bei der Aufsichtsbehörde: Sächsischer Datenschutz- und Transparenzbeauftragter, www.datenschutz.sachsen.de",
      ],
    },
    {
      heading: "8. Sicherheit",
      paragraphs: [
        "Alle Verbindungen sind verschlüsselt (HTTPS). Zugriffe sind über Rollen und Rechte beschränkt, Daten werden regelmäßig gesichert.",
      ],
    },
    {
      heading: "9. Änderungen",
      paragraphs: [
        "Wir passen diese Erklärung an, wenn sich der Mitgliederbereich ändert. Jede Fassung hat eine Versionsnummer und bleibt abrufbar. Bei wesentlichen Änderungen bitten wir dich beim nächsten Anmelden, die neue Fassung zur Kenntnis zu nehmen.",
      ],
    },
  ],
};
