# Übergabe: Release v1.17.0 vorbereiten (Stand 2026-10-17)

Zum Weitermachen an anderer Stelle. Plan Regie: `docs/Plan/regie-plan.md`.

## Erledigt heute

- **Regie-Plan Phase 1–7** auf main (bis `9d21aa88`):
  - Phase 6 Probenmappe (`faaa94a1`, ohne Skript `80990733`).
  - Phase 2 Anmeldelink mit QR/Teilen: MB `9aad57d2`, Authentik-Blueprint Config-LimitlessGreen
    `7aaf0dc` (Policy `theater-recovery-login-link`). Anleitung `docs/regie-zugang.md`.
  - Profil: Knopf „Passwort festlegen“ für Konten ohne Passwort (`d3b4cd53`).
  - Phase 7: `e2e/regie.spec.ts` 6/6 grün auf Staging, Build ok, Screenshots aller Größen ok.
- Release-Entwurf der Notizen: unten (Kopie von `~/release-v1.17.0.md`).
- Migrationen: 21 seit v1.16.0; Staging wird nachts aus Prod kopiert und läuft damit fehlerfrei.
- Prod-Env geprüft: S3-Variablen sind in Prod gesetzt (Config-Theaterserver `b04c4d6`).

## Blocker vor dem Release: CI (Playwright) rot seit 2026-10-15

Letzter grüner CI-Lauf: `696d3348` (15.10. mittags). Rot sind 4 Tests, alle **Test-Altlasten**,
keine App-Fehler (lokal mit CI-Nachbau geprüft):

| Test                        | Ursache                                                                                                | Stand                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `planungshilfen` Tagesblatt | Überschrift heißt „Probbar“, Buttons „… auswählen“ (68cf013c)                                          | behoben, lokal grün                         |
| `bausteine` Gewerk-Arbeit   | Grund „Ablauf: …“ nur noch im Tooltip; Vormerken → Termin braucht im Dev-Server >10 s                  | behoben, lokal grün                         |
| `skript` markieren/Notizen  | Wörter stehen einzeln in `[data-w]`-Spans ohne Satzzeichen; Next-„Issues“-Badge verdeckte den Radierer | Test angepasst, **letzter Lauf noch offen** |
| `skript` PDF einlesen       | Folgefehler: Reste des abgebrochenen Notiz-Tests (CI-Retries)                                          | sollte mit obigem grün werden               |

**Noch zu tun:**

1. `.github/workflows/ci.yml`, Job `playwright`, `env:` ergänzen:
   `AUTH_SECRET: e2e-ci-only-not-a-real-secret-0123456789`
   (ohne scheitert das Sync-Token/Realtime → Next zeigt „Issues“-Badge unten links über der
   Skizzen-Werkzeugleiste). Lokal getestet: damit verschwindet das Problem.
2. `e2e/skript.spec.ts` komplett laufen lassen (CI-Nachbau unten), ggf. weitere „Abend,“-Stellen
   o. Ä. anpassen.
3. Committen, pushen, CI grün abwarten.
4. Release: GitHub-Release **v1.17.0** veröffentlichen (Notizen unten). Das löst den Prod-Deploy
   aus (`docker-publish.yml`, `release: published`); ein Entwurf deployt nicht.

## CI lokal nachbauen

Im Repo läuft ein fremder Dev-Server (Demo, :3200) → separater Worktree `/tmp/mb-ci`
(`git worktree add /tmp/mb-ci HEAD --detach`, `pnpm install`, `prisma generate`).
DB `e2e_ci` im Container `mb-test-pg` (Passwort wie im Dev-Server-Env, nicht wie `.env.local`):

```
export DATABASE_URL=postgresql://postgres:<pw>@localhost:15432/e2e_ci?schema=public
pnpm exec prisma migrate deploy && pnpm db:seed   # bei Bedarf DB neu anlegen
export E2E_BASE_URL=http://localhost:3000 SCAN_E2E_BASE_URL=http://localhost:3000 CI=true \
  SCAN_E2E_START_COMMAND="pnpm exec next dev --turbo" E2E_LOGIN_SECRET= \
  AUTH_SECRET=e2e-ci-only-not-a-real-secret-0123456789
pnpm exec playwright test e2e/skript.spec.ts --project=chromium --retries=0 --workers=1
```

`.env.e2e.local` setzt sonst Staging als Basis-URL. Danach Worktree entfernen
(`git worktree remove /tmp/mb-ci --force`).

## Nach dem Release

1. Authentik-Blueprint laden (Watcher verpasst Änderungen manchmal):
   `kubectl exec -n authentik deploy/authentik-worker -- ak apply_blueprint mounted/cm-authentik-blueprints-theater/theater.yaml`
2. Anmeldelink in Prod mit Testkonto testen (Staging hat keinen API-Token): Link erzeugen, auf
   dem Handy Passkey einrichten, abmelden, per Passkey anmelden, „Passwort festlegen“ prüfen.
3. Gewerke Regie/Regieassistenz je Produktion anlegen, Personen zuordnen, „Nur Regie-Ansicht“.
4. Test mit der Regie auf ihrem Handy.

## Release-Notizen v1.17.0 (Entwurf)

## Skript

- **Skript-Leser:** Regiebuch-PDF wird in Szenen, Sätze und Hinweise zerlegt, geprüft und freigegeben. Leser mit Hervorhebung der eigenen Rolle, Vorschau auf die nächste Passage, Hinweise am Rand oder darunter, Vollbild, Tablet-Szenenleiste.
- **Notizen im Skript:** private Markierungen und Randnotizen, Zeichen (Pausen, Atmer, Betonung, Bögen, Stimmungen), Skizzen; Notizen wandern in neue Fassungen mit und funktionieren offline.
- **Fassungen:** vergleichen mit Fokus auf die eigenen Rollen, Absätze im Leser korrigieren, PDF-Export mit Deckblatt.
- **Lernmodus:** Szenenablauf, Abfrage Wort für Wort, Wiederholung nach FSRS, geänderte Passagen zuerst, Endspurt, Statistik und Belohnungen, offline nutzbar.

## Regie

- **Regie-Dashboard** mit eigener Ansicht ohne Menü: nächste Proben, Szenen × Personen, Verfügbarkeit (ohne Gründe), Besetzung, Probenprotokolle, Ausstattung, Skript – jeweils lesend und als PDF.
- **Wünsche an die Planung:** Regie und Regieassistenz schicken Wünsche mit Bezug auf Szenen, Zeitraum oder Personen; die Planung plant ein, antwortet oder lehnt mit Grund ab. Hinweise in Terminplanung und Termineditor.
- **Probenmappe:** gewählte Listen als ein PDF mit Deckblatt und Inhalt.
- **Anmeldelink:** Admins erzeugen in der Mitgliederverwaltung einen Einmal-Link oder QR-Code, mit dem z. B. die Regie ohne Passwort einen Passkey einrichtet.

## Proben & Planung

- **Probenmodus:** Fotos, Sprachmemos und Musik an Notizen und Blöcken, Einträge bearbeiten, Aufgaben an mehrere, Proben vorbereiten, ruhigere Anwesenheit; neue Blöcke Durchlauf, Musiknummer, Pause.
- **Terminplanung:** Rollen und Gewerke bei Personen, unbesetzte Szenen ausgeblendet, kompakte einzeilige Terminliste mit Abwesenheiten, Ablauf-PDFs mit Szenen, Wochen und Ferien, Termine im Editor wechseln.
- **Sperrliste-PDF** kompakter: Proben, Ferien/Feiertage als Balken, Rollen und probbare Szenen je Tag.
- Personenlisten nach Vorname sortiert (umschaltbar), Schauspielrollen sichtbar.

## Kartenbuchung

- Online-Reservierung (auch für mehrere Vorstellungen), Kartenbüro mit Telefonbuchung, Freikarten, Einlass mit QR-Zugang, Kassieren an der Tür mit Wechselgeld-Hilfe, Einlass-Checkliste als PDF.

## Gewerke & Zuweisung

- Zuweisung in zwei Ansichten (Gewerke/Rollen), Wünsche nach Stufe mit Ampel, Wunschliste als PDF (Liste/Matrix), höchster Wunsch markiert, Wünsche nachtragen.

## Konto & Sicherheit

- Profil „Anmeldung & Sicherheit“: Passwort ändern bzw. festlegen, Passkeys und freiwillige Authenticator-App über das Theater-Konto.
- Mitgliederverwaltung, Karte „Anmeldung“: Geräte eines Mitglieds sehen und entfernen, Zwei-Faktor zurücksetzen, Mail „Passwort festlegen“.
- Alle PDFs tragen den Hinweis „nur für den internen Gebrauch“ und nutzen die Schrift Inter.

## Technik

- Medienablage in S3 (RustFS) für Fotos und Audio.
- 21 Datenbank-Migrationen.
