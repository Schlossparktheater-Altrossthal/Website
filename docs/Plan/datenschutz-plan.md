# Datenschutz im Mitgliederbereich

Stand: 2026-10-22

## Ausgangslage

- Der Mitgliederbereich (MB) hat **keine eigene Datenschutzerklärung**, keine Bestätigung beim Onboarding und keine Versionierung.
  Einzige Ausnahme: die Fotoerlaubnis (`PhotoConsent` + `PhotoConsentVersion`).
- Die öffentliche Erklärung liegt in Drupal (`/datenschutz`, Stand September 2026). Sie deckt den MB nur mit einem Satz ab
  und ist teilweise überholt:
  - „Magic Link, keine Passwörter“ → heute Authentik mit Passkey, TOTP und Passwort.
  - „keine Analyse-Werkzeuge“ → es gibt Umami (selbst gehostet) und die eigene Ladezeit-Messung (RUM).
- Gespeichert werden u. a.:
  - Allergien (`DietaryRestriction`, Gesundheitsdaten nach Art. 9 DSGVO)
  - Körpermaße und Konfektionsgrößen
  - Geburtsdatum, Schule/Klasse
  - Fotos und Fotoerlaubnisse
  - Sperrtermine, Anwesenheit, Skript-Notizen, Mitlesen
  - Push-Abos, E-Mail-Outbox, Kartenbuchungen

## Rechtlicher Rahmen (Einschätzung, keine Rechtsberatung)

- **Verantwortlicher:** der Förderverein (Freunde und Förderer des BSZ für Agrarwirtschaft und Ernährung e.V.) als Träger
  der Website. Das Theater ist ein Angebot der Schule, Teilnehmende sind keine Vereinsmitglieder (keine Beiträge).
- **Rechtsgrundlagen:**
  - Organisation (Konto, Proben, Sperrtermine, Rollen, Kontakt): Art. 6 Abs. 1 b (Nutzungsverhältnis MB) bzw. f.
  - Allergien: **ausdrückliche Einwilligung**, Art. 9 Abs. 2 a.
  - Körpermaße, Push: Einwilligung bzw. freiwillige Angabe, jederzeit widerrufbar.
  - Fotos: bestehende Fotoerlaubnis.
- **Alter:** Für den Verein gilt die Grenze 16 (Art. 8). Laut Theaterleitung gibt es keine Teilnehmenden unter 16
  → keine Elternzettel. Sicherheitsnetz im Code (s. Phase 4).
- **Schule ↔ Förderverein:** kurze schriftliche Abrede zur Verantwortung (Art. 26) empfohlen. Klärt die Theaterleitung im
  laufenden Austausch mit der Schulleitung, das blockiert die Umsetzung nicht.

## Entscheidungen

- Der Text liegt **versioniert im Code**, nicht im UI editierbar.
- Die öffentliche Erklärung (Website, Cloudflare, Kartenbuchung, Umami) bleibt in Drupal. Der MB bekommt eine eigene
  Erklärung, beide verweisen aufeinander.
- „Gelesen“ ist eine Kenntnisnahme, keine Einwilligung. Einwilligungen werden getrennt und einzeln widerrufbar erfasst.

## Phasen

1. **Text und Registry**
   - `src/content/datenschutz/<version>.md` plus `registry.ts` mit `{ version, gueltigAb, wesentlich, aenderungen[] }`.
   - Öffentliche Seiten `/datenschutz` (aktuelle Fassung) und `/datenschutz/[version]` (Archiv), ohne Login erreichbar.
   - Links im Footer, auf dem Login, im Profil und in der Kartenbuchung (zusätzlich zur Drupal-Erklärung).
2. **Datenmodell**
   - `PrivacyAcknowledgement { userId, version, acknowledgedAt }`, eindeutig über `[userId, version]`.
   - `DataConsent { userId, kind (HEALTH | MEASUREMENTS | PUSH), version, grantedAt, revokedAt }` mit Verlauf statt Überschreiben.
3. **Bestätigung**
   - Ein Schritt im Onboarding.
   - Für Bestandsmitglieder und bei Fassungen mit `wesentlich = true` fängt `proxy.ts` ab und zeigt eine Zwischenseite
     `/datenschutz/bestaetigen` mit den Änderungen. API, Logout und `/datenschutz` bleiben dabei erreichbar.
   - Bei unwesentlichen Änderungen: nur Hinweis-Banner und Benachrichtigung über Glocke bzw. E-Mail.
4. **Einwilligungen Gesundheit/Maße**
   - Ohne aktive Einwilligung sind Allergie- und Maßfelder gesperrt.
   - Widerruf im Profil löscht die Daten (mit Bestätigungsdialog).
   - Bestandsdaten: einmalig Einwilligung einholen. Ohne Einwilligung bis Stichtag X werden die Daten gelöscht.
   - Sicherheitsnetz: Bei `dateOfBirth` < 16 Jahre bleiben die Felder gesperrt, mit Hinweis.
5. **Verwaltung und Betroffenenrechte**
   - Mitgliederverwaltung: Spalte „Datenschutz (Version/Datum)“, Filter „fehlt“, Einwilligungsstatus je Person.
   - Profil: bestätigte Versionen und Einwilligungen anzeigen und widerrufen.
   - Datenauskunft als PDF/JSON (Art. 15/20) über die PDF-Engine.
6. **Drupal-Erklärung anpassen**
   - Login-Abschnitt korrigieren, Umami und RUM ergänzen, auf die MB-Erklärung verweisen.
   - Stand-Datum aktualisieren.

## Inhalt MB-Erklärung (Gliederung für den Entwurf)

Verantwortlicher; Rolle der Schule; Datenkategorien mit Zweck, Rechtsgrundlage und Speicherdauer (Konto/Authentik,
Profil, Schule/Klasse, Termine/Sperren/Anwesenheit, Skript/Notizen, Allergien, Maße, Fotos/Immich/Nextcloud, Dateien,
Benachrichtigungen/E-Mail/Push, Ladezeit-Messung, Server-Logs); Empfänger und Auftragsverarbeiter (Hosting, Cloudflare,
Mail, Push-Dienste von Google/Apple); Löschkonzept (deaktivierte/anonymisierte Konten); Betroffenenrechte; Beschwerde
beim SächsDSB; Versionierung.

## Fristen (festgelegt 2026-10-22)

Gemessen ab Ende der letzten Produktion, wie bisher in `src/lib/retention.ts` (E4):

| Daten             | Frist                                                               |
| ----------------- | ------------------------------------------------------------------- |
| Allergien         | bis Widerruf, max. 2 Jahre (vorhanden)                              |
| Körpermaße/Größen | bis Widerruf, max. 2 Jahre (**neu**, in `RETENTION_YEARS` ergänzen) |
| Fotoerlaubnis     | 5 Jahre (vorhanden)                                                 |
| Konto             | Anonymisierung nach 6 Jahren (vorhanden)                            |
| E-Mail-Inhalte    | 30 Tage (vorhanden)                                                 |
| Statistik         | Seiten 60 Tage, Sitzungen 180 Tage (vorhanden)                      |
| Datenportal-Audit | 12 Monate (vorhanden)                                               |
| Server-Logs       | max. 30 Tage                                                        |
| Reservierungen    | Anonymisierung 90 Tage nach Vorstellung (vorhanden)                 |

Bestandsdaten Allergien/Maße: Nach dem Aktivieren werden alle zur Einwilligung aufgefordert.
**8 Wochen** danach werden die Daten ohne Einwilligung gelöscht, mit Erinnerung nach 4 und 7 Wochen.

## Stand

- 2026-10-22: Text (Fassung `2026-11`, Entwurf) in `src/lib/datenschutz/`, Seite `/datenschutz` hinter
  `PRIVACY_POLICY_ENABLED` (Standard aus → 404). Phase 1 ohne Links, Phase 2–6 offen.

## Offen

- Den Text segnet der Vorstand des Fördervereins ab, gegebenenfalls in Abstimmung mit der Schulleitung. Danach das Flag setzen.
- `[PRÜFEN]` im Text: Hosting-Anbieter und Auftragsverarbeitungsvertrag.
