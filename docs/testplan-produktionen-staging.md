# Testplan Staging: Produktionen, Onboarding & Fotoerlaubnis

Vor dem Prod-Release (Migrationen `20260923120000` … `20260924140000`).
Plan und Hintergründe: `docs/produktionen-mitglieder-plan.md`.

## Automatisiert: Integrationstests

Die Abschnitte 1–7 unten sind als Integrationstests abgedeckt (`tests/integration/`, eine Datei pro
Abschnitt). Sie laufen gegen einen echten Postgres mit dem Prod-Dump:

```bash
npm run test:integration
```

- `global-setup.ts` legt die Datenbank `mb_it` neu an, lädt den Dump, ergänzt die zweite Produktion
  „???“ (2027) wie in Prod, merkt sich den Stand vor der Migration und führt `prisma migrate deploy` aus.
- Voreinstellung: Container `mb-test-pg` (Port 15432, Passwort `pw`), Dump `~/theater_prod_dump.sql`;
  anpassbar über `IT_PG_CONTAINER`, `IT_PG_URL`, `IT_DB_NAME`, `IT_DUMP`. Für einen aktuellen Stand
  vorher einen frischen Prod-Dump ziehen.
- Echt sind Datenbank, Rechteprüfung, API-Routen und Server-Actions. Ersetzt werden nur Login
  (Authentik), Mailversand (Mails werden mitgeschrieben), Authentik-Gruppen, Next-Cache/Cookies, Realtime.
- Dateien laufen nach Namen; `01-migration` prüft den unberührten Stand, die übrigen legen eigene
  Testkonten (`it-…@example.org`) und Testproduktionen an.

Nicht automatisiert, daher als **Smoke-Test auf Staging** (ca. 10 Minuten):

- [ ] Nach Deploy + db-sync: Produktionsübersicht, Ensemble, Fotoerlaubnis-Verwaltung und Datenpflege
      laden ohne Fehler und zeigen die Werte aus Abschnitt 1.
- [ ] Rückkehrer-Login mit echtem Authentik: Testkonto deaktivieren → „Ehemalige einladen“ → Link kopieren
      (Staging verschickt keine Mails, `MAIL_DISABLED`) → Anmelden → Wizard (Allergien vorausgefüllt,
      Bestätigungs-Häkchen) → Mitgliederbereich erreichbar.
- [ ] „Fotoliste (CSV)“ in Excel/LibreOffice öffnen (Umlaute, Spalten).
- [ ] Aufräumen: Testproduktion archivieren, Testkonto deaktivieren.

Mails (✉️) einmalig nach dem Prod-Release mit einem eigenen Testkonto prüfen.

---

Die folgende ausführliche Checkliste dient als Referenz für die Tests bzw. für manuelle Nachtests.

Vorbereitung (manuell):

- Staging frisch aus Prod synchronisieren (db-sync-Job), damit die Migrationen wie in Prod am Stück laufen.
- Zwei Testkonten: **A** (normales Mitglied) und **B** (Mitglied, das später deaktiviert wird).
- Staging verschickt keine Mails (`MAIL_DISABLED=true`): Punkte mit ✉️ über die angezeigten Links testen.

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
