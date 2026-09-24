# Testplan Staging: Produktionen, Onboarding & Fotoerlaubnis

Vor dem Prod-Release (Migrationen `20260923120000` … `20260924140000`) einmal auf Staging durchgehen.
Plan und Hintergründe: `docs/produktionen-mitglieder-plan.md`.

Vorbereitung:

- Staging frisch aus Prod synchronisieren (db-sync-Job), damit die Migrationen wie in Prod am Stück laufen.
- Zwei Testkonten: **A** (normales Mitglied) und **B** (Mitglied, das später deaktiviert wird). Beide mit echter,
  erreichbarer E-Mail-Adresse.
- Mailversand in den Server-Einstellungen eingerichtet (SMTP), sonst Punkte mit ✉️ über die angezeigten Links testen.

## 1. Migration (direkt nach dem Deploy)

- [ ] Produktionsübersicht: „Die unendliche Geschichte“ steht auf **Aktiv**, „???“ auf **In Planung**.
- [ ] Fotoerlaubnis-Verwaltung, Filter „Die unendliche Geschichte“: alle bisherigen Erlaubnisse (Prod-Stand ~34),
      Freigaben unverändert. Filter „???“: leer.
- [ ] Ensemble „Die unendliche Geschichte“: alle aktiven Mitglieder, Status **Aktiv**; Ensemble/Technik wie vorher.
- [ ] Onboarding-Dashboard „Die unendliche Geschichte“: Teilnehmerzahl und Fotoerlaubnis-Quote plausibel.
- [ ] Mitgliederverwaltung → Datenpflege: keine Löschkandidaten.
- [ ] Rollen stichprobenartig: Vorstand/Finanzen/Owner haben **nicht** zusätzlich „Ensemble“ bekommen.

## 2. Aktive Produktion & Saisonabschluss

- [ ] Im Admin-Menü die aktive Produktion wechseln → **niemand** wird deaktiviert (Mitgliederliste unverändert).
- [ ] „Saison abschließen“ → Vorschau zeigt nur Personen **ohne** laufende Produktion; mit Abbrechen verlassen.

## 3. Ensemble & Rollen

- [ ] Konto A im Ensemble auf „Technik“ setzen → in der Mitgliederverwaltung hat A die Rolle Technik.
- [ ] Rolle wieder entfernen → Technik ist weg. Funktion (z. B. „Licht“) speichern.
- [ ] Rollen-Editor der Mitgliederverwaltung: „Ensemble“ bei A setzen → erscheint im Ensemble der **ausgewählten**
      Produktion.
- [ ] Mitglied aufnehmen (ohne Onboarding) → Status **Eingeladen**.

## 4. Neue Produktion & Einladungslink

- [ ] Testproduktion anlegen (Status „In Planung“), WhatsApp-Link setzen.
- [ ] Mitgliederverwaltung → Einladungslinks → „Link erstellen“ für die Testproduktion.
- [ ] Beim Erstellen sind nur geplante/aktive Produktionen wählbar (nicht „Die unendliche Geschichte“, falls beendet).
- [ ] Link im privaten Fenster öffnen → „Los geht's“ → bei E-Mail die Adresse von A eintippen und Feld verlassen →
      Hinweis „Diese Adresse kennen wir schon … Jetzt anmelden“.
- [ ] Mit neuer Adresse komplett durchlaufen → neues Konto ist im Ensemble der Testproduktion **Aktiv**, Onboarding
      abgeschlossen, Fotoerlaubnis **ausstehend**.

## 5. Rückkehrer

- [ ] Konto B deaktivieren.
- [ ] Ensemble der Testproduktion → „Ehemalige einladen“ → B auswählen → ✉️ Mail kommt an (sonst Link kopieren).
- [ ] Den persönlichen Link von B zuerst angemeldet als A öffnen → „Link für eine andere Person“.
- [ ] Mitgliederverwaltung → Einladungslinks: der persönliche Link von B erscheint **nicht** in der Liste, stattdessen
      der Hinweis auf ausgeblendete Rückkehr-Einladungen.
- [ ] Link öffnen → Anmelden (Authentik) → Hinweis „Zugang wird nach Abschluss freigeschaltet“.
- [ ] Während des Wizards `/mitglieder` direkt aufrufen → **kein** Zugriff.
- [ ] Wizard: Allergien sind vorausgefüllt; Absenden ohne Bestätigungs-Häkchen → Fehlermeldung; mit Häkchen → ok.
- [ ] Danach: B ist aktiv, Mitgliederbereich erreichbar, Ensemble zeigt B **Aktiv** mit „Onboarding (Rückkehr)“.
- [ ] Denselben Link erneut öffnen → „Einladung nicht mehr aktiv“ (einmal nutzbar).
- [ ] Passwort vergessen mit deaktiviertem Konto **und** Einladungslink → ✉️ Mail kommt; ohne Einladungslink → keine Mail.

## 6. Fotoerlaubnis pro Produktion

- [ ] Als A (in Test- und aktueller Produktion): Profil zeigt die Erlaubnis der **ausgewählten** Produktion; nach
      Wechsel der Produktion eine neue, leere Erlaubnis.
- [ ] Erlaubnis einreichen → Verwaltung (Filter Testproduktion) → freigeben.
- [ ] Rückkehrer-Update mit geänderter Erlaubnis → Status wieder **ausstehend**.
- [ ] Ensemble → „Fotoliste (CSV)“ öffnet sich korrekt in Excel/LibreOffice (Umlaute, Spalten).
- [ ] ✉️ „Fotoerlaubnis-Erinnerung“ → Mail an Mitglieder ohne Erlaubnis.

## 7. Produktion beenden

- [ ] Testproduktion auf „Beendet“ → Bestätigungsdialog → Mitgliedschaften **Ausgeschieden**, Rollen der
      Testproduktion entfallen.
- [ ] „Saison abschließen“ zeigt jetzt Personen, die nur in der Testproduktion waren.
- [ ] Mitglieder-Detailseite zeigt die Produktionshistorie.

## Aufräumen

- [ ] Testproduktion archivieren, Testkonten deaktivieren.
