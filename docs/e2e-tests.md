# E2E-Tests & Screenshots (lokal und Staging)

Playwright-Tests und Screenshots von Seiten, für die man angemeldet sein muss.
Die Anmeldung läuft über `/api/dev/screenshot-session` mit den festen Testnutzern
aus `src/lib/auth-dev-test-users.ts` (`member@example.com` … `owner@example.com`).

## Wann ist der Test-Login aktiv?

| Umgebung           | Bedingung                                 | Nutzer                  |
| ------------------ | ----------------------------------------- | ----------------------- |
| `next dev` / Tests | `NODE_ENV !== "production"`               | Testnutzer oder `email` |
| Staging            | `E2E_LOGIN_SECRET` gesetzt + Header passt | nur feste Testnutzer    |
| Produktion         | Variable nie gesetzt → **404**            | –                       |

- Auf Staging muss der Header `x-e2e-login-secret` den Wert von `E2E_LOGIN_SECRET`
  tragen (Vergleich in `src/lib/e2e-login.ts`, mindestens 32 Zeichen).
- Das Secret erzeugt der vault-config-operator (`RandomSecret`, Config-LimitlessGreen
  `infrastructure/vault/config/theater-website-staging-e2e.yaml`) unter
  `apps/theater-website-staging/theater-website-staging-e2e`. Config-Theaterserver
  bindet es nur im Staging-Deployment ein (Secret `theater-website-e2e`).
- Die Testnutzer landen in der Staging-DB. Der Prod→Staging-Sync entfernt sie, beim
  nächsten Test-Login werden sie neu angelegt. Echte Mitglieder und Authentik bleiben
  unberührt.
- **Nie** `E2E_LOGIN_SECRET` in der Produktion setzen.

## Lokal

```bash
pnpm dev                 # http://localhost:3000 (nicht 127.0.0.1 – next dev blockt fremde Origins)
pnpm e2e                 # Setup legt Sessions an (e2e/.auth/, ignoriert), dann Tests (alle Viewports)
pnpm e2e:desktop         # nur chromium (Desktop Chrome, schneller Pfad)
pnpm e2e:responsive      # nur der Overflow-Test über Handy/Tablet/Desktop
pnpm e2e:screenshots -- --role admin /mitglieder /mitglieder/profil
pnpm e2e:screenshots -- --viewport all
```

Im `next dev`-Betrieb braucht der Test-Login **kein** Secret – geprüft wird es nur in
Production-Builds. Ein lokales `E2E_LOGIN_SECRET` in `.env` wird von den Skripten ebenfalls
gelesen, `.env.e2e.local` hat dabei Vorrang.

## CI

Der `playwright`-Job in `.github/workflows/ci.yml` bringt einen Postgres-16-Service mit, wendet
`prisma migrate deploy` an und seedet die Testdaten. Playwright startet den Dev-Server selbst über
`SCAN_E2E_START_COMMAND=pnpm exec next dev --turbo` (`playwright.config.ts` → `webServer`).
Der Dev-Modus ist nötig, weil `/api/dev/screenshot-session` außerhalb von `next dev` ein
`E2E_LOGIN_SECRET` verlangt (siehe Tabelle oben).

## Staging

```bash
pnpm e2e:env             # holt das Secret per kubectl nach .env.e2e.local (ignoriert)
pnpm e2e                 # E2E_BASE_URL kommt aus .env.e2e.local
pnpm e2e:screenshots -- --role member --viewport tablet-portrait
```

- `E2E_ROLES=member,admin,owner` wählt die Rollen für das Setup (Standard: `member,admin`).
- `pnpm e2e:env` braucht einen erreichbaren kubectl-Kontext. Ohne gesetztes `KUBECONFIG` fällt das
  Skript auf `~/.kube/theater-config-lens` zurück, wenn `~/.kube/config` fehlt. Der Cluster ist nur
  im LAN erreichbar – `kubectl get ns` prüft den Zugang.
- Screenshots: hell + dunkel, ganze Seite, nach `test-results/screenshots/<Zeit>/<viewport>/`
  oder `--out <dir>` (dort ebenfalls in `<viewport>`-Unterordnern). Nicht committen (keine Binärdateien im Repo).
- Das Skript wartet auf `.animate-pulse`/`aria-busy`, damit die Client-Session geladen ist.

## Klicks und Hydration (`clickUntil`)

`next dev` liefert das HTML aus, bevor React hydratisiert hat. Die Seite sieht in diesem Fenster
fertig aus, reagiert aber noch nicht: Ein Klick verpufft wirkungslos – kein Request, keine
Fehlermeldung, die Zusicherung läuft in ihren Timeout. Auf schnellen Rechnern ist das Fenster kaum
messbar, im CI reproduzierbar (dort lief der Klick auf „Neue Probe anlegen“ ins Leere, obwohl der
Button sichtbar war).

- Die Bereiche einer Seite hydratisieren **unabhängig** voneinander. Ein bedienbarer Kalender sagt
  nichts über den Seitenkopf – ein „bin ich interaktiv?“-Testklick auf ein Nachbarelement und
  `waitUntil: "networkidle"` sind deshalb keine verlässlichen Signale.
- Klicks auf Client-Aktionen nach einem vollen Seitenaufruf laufen über `clickUntil()`
  (`e2e/helpers.ts`): Der Klick wird wiederholt, bis die erwartete Wirkung eintritt. Ein doppelter
  Klick ist ausgeschlossen, weil der Button während der Aktion seinen Namen ändert (`AsyncButton`
  zeigt den Ladetext und ist `disabled`) und der Selektor ihn dann nicht mehr findet.

```ts
// e2e/bausteine.spec.ts: „Neu“ öffnet ein Menü – erst danach ist geklickt.
await clickUntil(page.getByRole("button", { name: "Neu", exact: true }), () =>
  expect(page.getByRole("menuitem", { name: "Probe" })).toBeVisible({ timeout: 2_000 }),
);
```

- Nach einer Client-Navigation (`router.push`, `<Link>` mit aktiver Hydration) ist das nicht nötig:
  React rendert die neue Seite im Browser und hängt die Handler sofort an.
- Links (`<a href>`) funktionieren auch ohne Hydration. Kritisch ist der jeweils **erste
  Client-Button** einer frisch geladenen Seite.

## Demo-Daten: Termin mit Bausteinen

Für Terminplanung Phase 6 (`docs/Plan/terminplanung-plan.md`) gibt es einen wiederholbaren Demo-Termin:

```bash
DATABASE_URL=postgresql://…@localhost:15432/<db> pnpm demo:bausteine           # (neu) anlegen
DATABASE_URL=postgresql://…@localhost:15432/<db> pnpm demo:bausteine --remove  # entfernen
```

- Legt „Demo: Stellprobe + Bautag“ (vorgemerkt, in 11 Tagen) mit zwei Szenen, einem Gewerk- und
  einem freien Baustein an; `admin@example.com` wird Leitung des Gewerks. Läuft nur gegen
  `localhost`-Datenbanken.
- Die DB muss die sein, mit der `next dev` läuft (`DATABASE_URL` des Dev-Servers).
- Das Skript gibt die Routen und fertige Befehle aus: `pnpm e2e:screenshots … --viewport mobile,desktop`
  und `pnpm ui:check … --steps-file e2e/scenarios/baustein-organisieren.json` (klickt
  „Baustein organisieren“ → Raum → Speichern, liest „Euer Teil …“ zurück).
- Der Playwright-Test `e2e/bausteine.spec.ts` braucht keine Demo-Daten: Er legt über die
  Oberfläche eine Probe mit Gewerk-Baustein an, merkt sie vor, organisiert den Baustein im
  Gewerk-Dashboard, prüft den seitlichen Überlauf und löscht die Probe wieder
  (`pnpm e2e:desktop bausteine`).
- Fehler wie „Value 'TENTATIVE' not found in enum“ bedeuten einen veralteten Prisma-Client im
  laufenden `next dev` (nach neuen Migrationen): Dev-Server neu starten.

## Demo-Daten: Termine für „Meine Termine"

Für Phase 0 des Plans `docs/Plan/meine-termine-plan.md` gibt es einen wiederholbaren Satz Demo-Termine:

```bash
pnpm dev:termine           # anlegen bzw. zeitlich neu legen
pnpm dev:termine --remove  # entfernen
```

- Legt für `admin@example.com` neun Termine an, damit `/mitglieder/meine-proben` jeden Zustand
  zeigt: zwei Proben am selben Tag, eine gestaffelte Probe mit persönlicher Zeit (Optional), einen
  abgesagten Termin mit Grund, zwei „Für alle"-Termine (einer innerhalb der Sperrfrist), einen
  Gewerk-Termin, eine vorgemerkte Probe und einen vergangenen Termin. Ein Termin trägt
  „Noch offen" als Ort.
- `admin@example.com` wird dabei Mitglied des ersten Gewerks der aktuellen Produktion, damit der
  Gewerk-Termin in der Übersicht erscheint; `--remove` entfernt nur die Termine.
- Die DB muss die sein, mit der `next dev` läuft; `DATABASE_URL` lädt das Skript selbst aus `.env`.
  Läuft nur gegen `localhost`-Datenbanken.
- Sinnvoll für Screenshots (`pnpm e2e:screenshots -- --role admin --viewport all /mitglieder/meine-proben`)
  und für die Prüfung von Absage-, Gruppierungs- und Kalenderzuständen.
- Die Termine liegen relativ zu „jetzt", werden also bei jedem Lauf neu gelegt.

## Test: „Meine Termine" (`e2e/termine.spec.ts`)

`pnpm e2e:desktop termine` prüft die Seite durchgängig über die Oberfläche (Chromium, Desktop):

- Ansicht, Suche und Vergangenheit stehen in der URL (`ansicht=kalender`, `q=…`, `vergangen=1`),
  Deep-Links laden dieselbe Ansicht.
- Eine Absage **innerhalb** der Sperrfrist (Zieltag: morgen) wird zur Notfall-Absage: Grund Pflicht,
  der Tag trägt in der Sperrliste „Notfall".
- Eine Absage **außerhalb** der Frist (Zieltag: heute + 20) sperrt den Tag als „Gesperrt".
- „Doch dabei" entfernt den Eintrag in der Sperrliste wieder.

Die Tests legen ihren „Termin für alle" selbst über die Terminplanung an (Titel `E2E Absage …`) und
löschen ihn am Ende; das Aufräumen läuft in `finally` und wird mitgeschrieben, wenn es scheitert.
Zwei Eigenheiten des Themas sind dabei eingebaut:

- Eintrag und Absage hängen am **Tag**, nicht am Termin: Nach einem liegen gebliebenen Lauf löst sich
  die Verknüpfung mit dem Termin, und ein neuer Lauf wird den Eintrag nicht mehr über „Doch dabei"
  los. Deshalb räumt der Test vorher einen eigenen Eintrag am Zieltag weg.
- Solange an dem Tag noch ein anderer abgesagter Termin steht, bleibt der Eintrag absichtlich
  stehen. Zwei **parallele** Läufe desselben Tests würden sich also den Zieltag wegnehmen: für
  Wiederholungen `--repeat-each` zusammen mit `--workers=1` verwenden.

## Viewports & Playwright-Projekte

Der Overflow-Test `e2e/responsive-overflow.spec.ts` läuft in fünf Projekten
(`playwright.config.ts`): `chromium` (1280×720), `mobile` (390×844), `mobile-webkit` (402×874,
`browserName: webkit` – die Engine des iPhones), `tablet-portrait` (834×1112) und
`tablet-landscape` (1024×768). Smoke/Sync laufen nur in `chromium`.

Der Test deckt alle Routen des Mitgliederbereichs ab. Detailrouten bekommen ihre ID aus dem ersten
passenden Link der jeweiligen Übersicht; fehlt der Link, entfällt die Route für den Lauf. Vor der
Messung wartet `waitForStableWidth` (`scripts/lib/e2e-session.mjs`) auf das Ende des Ladezustands
und auf zwei gleiche Messungen der Dokumentbreite hintereinander. Ohne diese Wartezeit meldet die
Prüfung gegen einen kalten Dev-Server Seiten als überlaufend, die im warmen Lauf grün sind (am
2026-09-29 fünf Fehlbefunde). Ein Fehlschlag nennt die äußerste überstehende Box und den Inhalt,
der sie aufreißt. Lokal einmalig `pnpm exec playwright install chromium webkit`.

Zur stabilen Breite gehört die **gleiche Adresse**. Zusätzlich überlebt die Messung einen
Client-Redirect: Next liefert das `redirect()` einer Seite als Anweisung im RSC-Payload aus (HTTP
200, kein 3xx), wenn ein Elter-Layout davor schon gestreamt hat – die Umleitung läuft dann erst
nach der Hydration im Browser. Betroffen sind die eingedampften Alt-Routen
`/mitglieder/probenplanung` und `/mitglieder/probenplanung/terminfinder`. Reißt dieser Wechsel die
laufende `page.evaluate`-Messung ab, beginnt sie auf der Zielseite neu, statt den Lauf mit
„Execution context was destroyed“ zu beenden (CI am 2026-09-30, sechs Fehlschläge). Während des
Dokumentwechsels ist `document.documentElement` kurz `null`; dieser Zwischenstand liefert bewusst
keinen Wert (eine `0` würde als „kein Überlauf“ durchgehen).

Für Screenshots akzeptiert `--viewport` die Presets `mobile`, `mobile-iphone` (402×874),
`tablet-mini` (744×1133, iPad mini hochkant), `tablet-portrait`, `tablet-small` (768×1024),
`tablet-landscape`, `desktop` sowie Komma-Listen und `all`. `--mobile` bleibt als Alias für
`mobile` erhalten. `--browser webkit` schaltet beide Skripte auf die Safari-Engine um – nötig für
Layoutfragen, bei denen Chromium und WebKit auseinandergehen
(`docs/Analysen/handy-ueberlauf-webkit-befunde.md`).

## Interaktiver UI-Check (`pnpm ui:check`)

`scripts/ui-check.mjs` öffnet eine Seite, führt eine Klickfolge aus, misst horizontales Überlaufen
und legt Screenshots plus `report.json` ab. Gedacht für Prüfungen, bei denen nicht nur ein
Screenshot gebraucht wird, sondern der Zustand _nach_ einer Interaktion.

```bash
# Szenario als Datei
pnpm ui:check /mitglieder/datenportal --steps-file test-results/szenario.json --viewport all
# Einzelne Schritte direkt
pnpm ui:check /mitglieder/proben --viewport mobile --scheme dark --steps '[{"action":"click","target":"button"}]'
```

Schritte sind Objekte mit `action` und optional `target`, `value`, `name`, `ms`, `fullPage`:

| `action`                                                                                       | Wirkung                                                                                     |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `goto`, `click`, `dblclick`, `fill`, `press`, `select`, `check`, `uncheck`, `hover`, `waitFor` | Playwright-Aktion auf `target`                                                              |
| `wait`                                                                                         | Wartezeit `ms` (Standard 500)                                                               |
| `read`                                                                                         | Textinhalt von `target` – mit `attribute` stattdessen das Attribut – im Report unter `name` |
| `count`                                                                                        | Trefferzahl von `target`, im Report unter `name` abgelegt                                   |
| `screenshot`                                                                                   | Screenshot ohne Zustandsänderung                                                            |

Nach jeder verändernden Aktion (Klick, Eingabe, Auswahl) folgen automatisch ein Screenshot und eine
Überlaufmessung. `--no-shots` schaltet die Screenshots je Schritt ab, `--allow-findings` erzwingt
Exit-Code 0 trotz Befunden. Ausgabe landet in `test-results/ui-check/<Zeitstempel>` (gitignored).
Befunde sind: fehlgeschlagene Schritte, `pageerror`/Konsolenfehler, Weiterleitung zum Login und
horizontaler Überlauf. 404s fremder Ressourcen (etwa Gravatar-Avatare mit `d=404`) werden als
Warnung geführt und lassen den Lauf nicht scheitern; die Ressourcen-URL steht in der Meldung.

Popups und Screenshots vertragen sich nicht immer: ein `fullPage`-Screenshot schießt ein offenes
Radix-`Select` zu (gemessen 2026-09-27 auf der Rechte-Matrix – Viewport-Screenshot und
`DropdownMenu` waren unauffällig). Schritte, nach denen ein Select offen bleiben muss, deshalb mit
`"fullPage": false` versehen; das gilt auch für den automatischen Screenshot nach dem Klick.

Die Überlaufmessung meldet nur Elemente, die nicht in einem inneren Scroll-Container liegen –
breite Tabellen und Kalender dürfen laut `AGENTS.md` innerhalb ihrer Karte scrollen.

### Live verfolgen

```bash
pnpm ui:check /mitglieder/proben --headed --slow-mo 200 --keep-open
```

`--headed` öffnet ein echtes Browserfenster mit normalen Klicks (gemessen ~60 Animation-Frames pro
Sekunde, auch wenn das Fenster hinter VS Code liegt), `--slow-mo` verlangsamt die Schritte
(Millisekunden je Aktion) und `--keep-open` lässt das Fenster nach dem Lauf offen, bis Enter
gedrückt wird. Die Throttle-Flags in `scripts/lib/e2e-session.mjs` sind ein Sicherheitsnetz gegen
Chromiums Hintergrund-Drosselung, die Klicks mit `element is not stable` abbrechen lässt.

### Warum dieser Check headless läuft

Playwright prüft vor jeder Aktion, ob das Ziel über zwei aufeinanderfolgende Animation-Frames
stabil liegt. Im versteckten Tab des integrierten Editor-Browsers
(`document.visibilityState === "hidden"`) feuert `requestAnimationFrame` gar nicht: normale Klicks
laufen in den Timeout (`element is not stable`), und Screenshots sind nach einem Viewport-Wechsel
falsch skaliert. Headless läuft rAF normal, deshalb funktionieren hier Klicks ohne `force`.

Gemeinsame Bausteine (Viewport-Presets, Test-Login, Warten auf Skeletons) liegen in
`scripts/lib/e2e-session.mjs` und werden von `e2e-screenshots.mjs` und `ui-check.mjs` genutzt.

## Playwright-MCP (nur lokal)

Für interaktives Debugging durch Claude Code: den Playwright-MCP nur im lokalen
Scope registrieren (nicht in `.mcp.json` committen):

```bash
claude mcp add playwright --scope local -- npx @playwright/mcp@latest
```

Anmelden: im MCP-Browser `/api/dev/screenshot-session?role=admin&target=/mitglieder`
öffnen (lokal). Auf Staging braucht die Route den Header – dort die Skripte oben
nutzen oder Playwright-MCP mit `--storage-state e2e/.auth/<rolle>.json` starten.
