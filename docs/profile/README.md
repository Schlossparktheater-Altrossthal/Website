# Mitgliederprofil – Funktionsanforderungen

## Ausgangslage
- Die aktuelle Mitglieder-Profilroute (`src/app/(members)/mitglieder/profil/page.tsx`) zeigt nur einen Hinweis, dass der Bereich vorübergehend deaktiviert ist.
- Diese Notiz soll als Grundlage dienen, um die zuvor vorhandenen Funktionen bei einer künftigen Neuimplementierung vollständig wiederherzustellen.

## Kernmodule & erwartete Funktionen

### 1. Stammdaten & Zugangsdaten
- Formular für Vor- und Nachname, kombinierter Anzeigename, primäre E-Mail-Adresse und Geburtsdatum.
- Optionales Zurücksetzen des Passworts (neues Passwort + Bestätigung) mit Mindestlänge.
- Avatarverwaltung mit drei Quellen (Gravatar, Initialen, Upload) inkl. Upload-Validierung (PNG/JPG/WebP bis 2 MB) und Möglichkeit, bestehende Uploads zu löschen.
- Nach erfolgreicher Speicherung Aktualisierung der Session-Daten, damit Navigation und Badges sofort den neuen Status anzeigen.

### 2. Profilüberblick & Highlights
- Zusammenfassungskarte mit Avatar, Rollenbadges und primärer Kontaktadresse.
- Highlight-Kacheln für Foto-Status, Onboarding-Fokus, aktive Rollen, letzte Aktualisierungen von Maßen sowie Checklistenkontext.
- Fortschrittsanzeige der Profil-Checkliste (Prozentbalken, nächster offener Schritt).

### 3. Profil-Checkliste
- Verwendung des `ProfileCompletionProvider`, um folgende Items zu pflegen:
  - `basics` (Stammdaten vollständig)
  - `birthdate` (Geburtsdatum hinterlegt)
  - `dietary` (Ernährungsstil gepflegt)
  - `measurements` (mindestens ein Maß, sofern berechtigt)
  - `photo-consent` (Fotoeinverständnis bestätigt)
- Karten-UI mit Fortschrittsanzeige und Sprungmarken zu den jeweiligen Tabs.

### 4. Ernährung & Allergien
- Anzeige des aktuellen Ernährungsstils inkl. Strengegrad oder individueller Bezeichnung.
- Verwaltung von Allergien/Unverträglichkeiten (Anlegen, Bearbeiten, Löschen) mit Schweregrad-Badges, Notizen, Symptomen und Behandlungsangaben.
- Sofortiges Feedback via Toaster und Abgleich mit `/api/allergies`.

### 5. Körpermaße
- Liste vorhandener Maße inkl. Typ, Einheit, Notiz und Zeitstempel.
- Dialog zum Anlegen/Bearbeiten einzelner Maße über `/api/measurements`.
- Hinweistext zu Sichtbarkeitsbeschränkungen (nur Mitglied + Kostüm-Team) und Datenschutzhinweis.
- Aktualisierung der Checkliste (`measurements`) sobald mindestens ein Eintrag existiert.

### 6. Interessen
- Verwaltung freier Schlagworte (max. `MAX_INTERESTS_PER_USER`) über `/api/profile/interests`.
- Validierung auf Mindestlänge, Duplikate sowie unmittelbares Feedback beim Hinzufügen/Entfernen.
- Speichern erst nach explizter Bestätigung; Ladeanzeige und Fehlermeldungen im Formular.

### 7. Onboarding-Angaben
- Formular zur Pflege von Schwerpunkt (`acting`, `tech`, `both`), schulischem/beruflichem Hintergrund, optionaler Klasse/Jahrgang, Mitglied seit Jahr sowie Team-Notizen.
- Kontextabhängige Vorschläge/Chips aus `BACKGROUND_TAGS` und serverseitige Suggestions für Klassen.
- Validierung der Feldlängen und Jahresangabe, Speicherung via `/api/profile/onboarding` inkl. Zeitstempel-Anzeige („Zuletzt bearbeitet …“).

### 8. Fotoeinverständnis
- Status-Badge (none/pending/approved/rejected) mit Hinweis auf letzten Bearbeitungszeitpunkt.
- Banner-Hinweis, sofern Geburtsdatum fehlt, Dokument aussteht oder Status „abgelehnt“/„none“ ist.
- CTA „Jetzt erledigen“, der den Bereich „Freigaben“ fokussiert.

### 9. WhatsApp-Onboarding-Link
- Anzeige eines Callouts, sofern `whatsappLink` (aus Show-Metadaten) gesetzt ist, der Besuch jedoch nicht bestätigt wurde (`whatsappLinkVisitedAt` leer).
- CTA „WhatsApp öffnen“ öffnet den Link in neuem Tab und ruft gleichzeitig `/api/onboarding/whatsapp-visit` auf, um den Besuch zu speichern.
- Nach erfolgreicher Bestätigung Ausblenden des Hinweises und Aktualisierung des Zeitstempels (`whatsappLinkVisitedAt` in `profiles` bzw. `memberRedemptions`).

### 10. Navigations- & UX-Details
- Tab-Navigation zwischen „Stammdaten“, „Ernährung“, „Maße“, „Interessen“, „Freigaben“ und „Onboarding“.
- Beim Wechsel zu Editoren Scroll-zu-Bereich + Fokusring, damit Nutzer direkt in den relevanten Bereich springen.
- Messbereich nur anzeigen, wenn Berechtigung (`canManageMeasurements`) gesetzt ist.

## Technische Abhängigkeiten & APIs
- `/api/profile` (PUT) – Stammdaten & Avatar.
- `/api/allergies` (POST/DELETE) – Allergienverwaltung.
- `/api/measurements` (POST) – Körpermaße.
- `/api/profile/interests` (GET/PUT) – Interessenliste.
- `/api/profile/onboarding` (PUT) – Onboarding-Fokus & Hintergrund.
- `/api/onboarding/whatsapp-visit` (POST) – Tracking des WhatsApp-Besuchs.
- `/api/photo-consent` (vorhandene Server Actions/Routes) – Status & Dokumente.

## Berechtigungen & Sichtbarkeit
- Profilseite weiterhin hinter Berechtigungsprüfung belassen (`requireMember` o. Ä.).
- Maße nur für das Mitglied selbst sowie Rollen mit Kostüm-Zugriff anzeigen.
- Allergien und Onboarding-Notizen sind intern; keine öffentliche API-Ausgabe ohne Auth.

## Offene Punkte für die Neuimplementierung
- Prüfen, ob zusätzliche Checklisteneinträge (z. B. Telefonnummer) aufgenommen werden sollen.
- Klar definieren, wann `photo-consent` als vollständig gilt (Abgleich mit Backend-Status).
- Entscheiden, ob künftige Releases weitere Messaging-Kanäle statt WhatsApp berücksichtigen sollen.
