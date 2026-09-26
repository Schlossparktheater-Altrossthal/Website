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

## Viewports & Playwright-Projekte

Der Overflow-Test `e2e/responsive-overflow.spec.ts` läuft in vier Projekten
(`playwright.config.ts`): `chromium` (1280×720), `mobile` (390×844), `tablet-portrait`
(834×1112) und `tablet-landscape` (1024×768). Smoke/Sync laufen nur in `chromium`.

Für Screenshots akzeptiert `--viewport` die Presets `mobile`, `tablet-portrait`,
`tablet-small` (768×1024), `tablet-landscape`, `desktop` sowie Komma-Listen und `all`.
`--mobile` bleibt als Alias für `mobile` erhalten.

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
horizontaler Überlauf.

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
