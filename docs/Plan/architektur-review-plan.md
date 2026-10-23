# Plan: Architektur-Review – Duplikationen und Schichten aufräumen

Stand: 2026-10-23. Phase 1–3 umgesetzt (4cc8f6b0, 32c9fa8e), offen Staging-Test und Phase 4–9.
Checkliste am Ende wird gepflegt.

## Ziel

1. Querschnittsthemen (Datum, Anmeldung/Rechte in Routen, Action-Ergebnisse) an genau einer Stelle.
2. Klare Schichten: Seite → `lib/<fach>/queries.ts` → Prisma; `components/` hängt nicht von `app/` ab.
3. Große Dateien in Hooks und Unterkomponenten zerlegen, wenn sie ohnehin angefasst werden.

Kein Umbau um seiner selbst willen: jede Phase ist einzeln auslieferbar und ändert kein Verhalten
(Ausnahmen stehen unter Entscheidungen).

## Ist-Stand (Befunde 2026-10-23)

Codebasis: ~1.300 TS/TSX-Dateien, ~238k Zeilen, 106 API-Routen, 187 Unit-Testdateien.

| #   | Befund                                                                                                                                     | Stelle                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| B1  | Zwei Datumsmodule mit fast gleichem Namen; 127× `new Intl.DateTimeFormat("de-DE")`, 39× `toLocale*String`, ≥27 lokale `formatDate`-Kopien  | `lib/date-time.ts`, `lib/datetime.ts`, verstreut               |
| B2  | `sceneLabel` in fünf leicht verschiedenen Varianten                                                                                        | `lib/ausstattung`, `lib/regie`, `ausstattung/shared.tsx` u. a. |
| B3  | 67 API-Routen mit eigener Anmeldung; `requireAuth()` macht `redirect()`, im `try/catch` wurde daraus 500/pauschal 401                      | `src/app/api/**`                                               |
| B4  | 53 eigene `…Result`-Typen, gemischt `{ ok }` (262) / `{ success }` (30) / `{ error }` (47)                                                 | Server Actions                                                 |
| B5  | 36 `page.tsx` greifen direkt auf Prisma zu (z. B. Mitglieder-Detail: 1.718 Zeilen, 7 Abfragen, ~15 Helfer)                                 | `src/app/(members)/**/page.tsx`                                |
| B6  | 56 Importe aus `components/` nach `@/app/(members)/…/actions`; `lib/dev-sperrliste-fixture.ts` importiert aus `app/api`                    | `components/food/recipes/*` u. a.                              |
| B7  | Dev-Fixtures (`databaseEnabled`) in 8 Dateien unter `app/`                                                                                 | z. B. `api/sperrliste/settings`                                |
| B8  | 60 lose Dateien in `src/lib/` (6× `photo-consent-*`, `member-*`, `onboarding-*`, `server-analytics*`); JS + handgeschriebene `.d.ts`       | `src/lib/*.ts`, `server-analytics-*.js`                        |
| B9  | Zwei Berechtigungsmodelle: feste Rollen (`roles.ts`/`hasRole`, 4 Aufrufe) neben Rechten (`permissions.ts`)                                 | `lib/rbac.ts`                                                  |
| B10 | Sehr große Dateien: `reader.tsx` 2.687, `onboarding-wizard.tsx` 2.141, `member-invite-manager.tsx` 1.888, `assignment-board.tsx` 1.560 …   | siehe Phase 8                                                  |
| B11 | `event-editor.tsx` mit 28 `useState`                                                                                                       | `terminplanung/event-editor.tsx`                               |
| B12 | 137 `revalidatePath` mit Pfaden als String                                                                                                 | verstreut                                                      |
| B13 | Gleichnamige Funktionen mit anderer Bedeutung: `loadInbox` (2×), `formatDuration` (2×)                                                     | `notifications/inbox.ts`, `ausstattung/objects.ts` u. a.       |
| B14 | 32 `eslint-disable`; Wurzelordner prüfen (`cookies.txt`, `dist/`, `playwright-report/`, `test-results/`, `*.tsbuildinfo` in `.gitignore`?) | Repo                                                           |

## Zielbild

- **Datum:** `lib/format/date.ts` (`formatDate` mit Stil `numeric|medium|long`, `formatDateTime`,
  `formatTime`, `formatDateKey`, `dateFormatter(options)` gecacht, immer Europe/Berlin) und
  `lib/format/relative-time.ts`. Keine neuen lokalen `Intl.DateTimeFormat("de-DE")`.
- **Szenen:** `lib/produktionen/scenes.ts` (`formatSceneLabel`, `formatSceneShort`).
- **API-Routen:** `withRoute({ name, permission?, errorMessage? }, handler)` aus `lib/api/route.ts`;
  Fehler per `throw new HttpError(status, msg)`, Body per `parseJson(request, schema)`. Eigene
  Prüf-Helfer nutzen `requireApiSession()`. `requireAuth()` nur noch in Seiten/Actions.
- **Server Actions:** `ActionResult<T>` aus `lib/actions/result.ts` (`actionOk`, `actionError`,
  `actionValidationError`); später `defineAction({ permission, schema }, fn)` analog zu `withRoute`.
- **Daten:** Seiten lesen über `lib/<fach>/queries.ts`; Actions liegen in `lib/<fach>/actions.ts`
  oder werden als Props an Komponenten gegeben.

## Phasen

1. **Datum vereinheitlichen** – Module zusammenführen, Formatierer, erste Kopien ersetzt. ✅ 4cc8f6b0
2. **Szenen-Bezeichnung** – fünf Varianten → `lib/produktionen/scenes.ts`. ✅ 4cc8f6b0
3. **API-Routen auf `withRoute`** – 57 Routen, `requireApiSession` für Helfer-Routen, Test-Mocks um
   `getSession` ergänzt; `ActionResult<T>` angelegt. ✅ 32c9fa8e
   - 3a: E2E-Lauf auf Staging (Staging vorher wecken, siehe `docs/sablier-on-demand.md`).
4. **Restliche Datumsformatierer** – verbleibende lokale `Intl.DateTimeFormat`/`toLocale*String`
   in Kalender, Lager, Benachrichtigungen, PDF auf `lib/format/date.ts` umstellen (B1).
5. **Server Actions** – `defineAction` bauen, neue Actions damit; bestehende `…Result`-Typen beim
   Anfassen auf `ActionResult<T>` umstellen (B4).
6. **Schichten** – `components/` → `app/`-Importe auflösen (B6), Dev-Fixtures hinter Datenquelle
   (B7), Prisma aus den 36 Seiten in `queries.ts` ziehen, beginnend mit Mitglieder-Detail (B5).
7. **`lib/` ordnen** – Fachordner (`photo-consent/`, `members/`, `onboarding/`, `analytics/`,
   `sperrliste/`), JS nach TS (B8), `hasRole`-Restfälle auf Rechte (B9), Namen entdoppeln (B13).
8. **Große Komponenten zerlegen** – beim nächsten Anfassen: Zustand in Hook/Reducer, Darstellung in
   Unterkomponenten (B10, B11).
9. **Kleinkram** – `revalidatePath`-Konstanten oder `revalidateTag` (B12), `eslint-disable`
   durchgehen, `.gitignore` prüfen (B14).

## Entscheidungen (2026-10-23)

- E1: Anzeige-Formatierer formatieren immer in Europe/Berlin. Stellen, die vorher die
  Server-Zeitzone (UTC) nutzten, zeigen späte Uhrzeiten jetzt auf dem richtigen Tag.
- E2: API-Routen leiten nie um, sondern antworten mit JSON: 401 ohne Sitzung, 403 bei fehlendem
  Recht oder deaktiviertem Konto, 500 nur bei echten Fehlern (mit Log unter `name`).
- E3: `/api/dashboard/overview` liefert die Offline-Fixture nur noch angemeldet.
- E4: Routen mit eigener Anmeldung (öffentlich, Cron, Sync-Token, Webhooks) bleiben ohne `withRoute`.
- E5: Phasen 5–8 schrittweise „beim Anfassen“, kein Großumbau in einem Commit.

## Checkliste

- [x] Phase 1 Datum vereinheitlichen
- [x] Phase 2 Szenen-Bezeichnung
- [x] Phase 3 API-Routen auf `withRoute`, `ActionResult<T>` angelegt
- [ ] Phase 3a E2E auf Staging
- [ ] Phase 4 restliche Datumsformatierer
- [ ] Phase 5 `defineAction` + `ActionResult<T>`
- [ ] Phase 6 Schichten (Importe, Fixtures, Prisma aus Seiten)
- [ ] Phase 7 `lib/` ordnen
- [ ] Phase 8 große Komponenten zerlegen
- [ ] Phase 9 Kleinkram
