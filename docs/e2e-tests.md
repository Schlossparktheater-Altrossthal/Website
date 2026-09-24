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
pnpm e2e                 # Setup legt Sessions an (e2e/.auth/, ignoriert), dann Tests
pnpm e2e:screenshots -- --role admin /mitglieder /mitglieder/profil
```

## Staging

```bash
pnpm e2e:env             # holt das Secret per kubectl nach .env.e2e.local (ignoriert)
pnpm e2e                 # E2E_BASE_URL kommt aus .env.e2e.local
pnpm e2e:screenshots -- --role member --mobile
```

- `E2E_ROLES=member,admin,owner` wählt die Rollen für das Setup (Standard: `member,admin`).
- Screenshots: hell + dunkel, ganze Seite, nach `test-results/screenshots/<Zeit>/`
  oder `--out <dir>`. Nicht committen (keine Binärdateien im Repo).
- Das Skript wartet auf `.animate-pulse`/`aria-busy`, damit die Client-Session geladen ist.

## Playwright-MCP (nur lokal)

Für interaktives Debugging durch Claude Code: den Playwright-MCP nur im lokalen
Scope registrieren (nicht in `.mcp.json` committen):

```bash
claude mcp add playwright --scope local -- npx @playwright/mcp@latest
```

Anmelden: im MCP-Browser `/api/dev/screenshot-session?role=admin&target=/mitglieder`
öffnen (lokal). Auf Staging braucht die Route den Header – dort die Skripte oben
nutzen oder Playwright-MCP mit `--storage-state e2e/.auth/<rolle>.json` starten.
