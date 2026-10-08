# Demo-Umgebung

**demo.sommertheater-altrossthal.de** zeigt den Mitgliederbereich mit einem erfundenen Ensemble,
damit Interessierte die Verwaltung ausprobieren können – ohne echte Personendaten und ohne
Anbindung an Authentik.

## Was läuft dort

- Staging-Image (`…-staging`), das Tag zieht der Staging-Build in
  `k8s-infrastructure/applications/website-demo/kustomization.yaml` mit.
- `DEMO_MODE=true`: Login-Seite mit Rollen-Buttons (Ensemble, Gewerkleitung, Regie,
  Vorstand & Finanzen, Admin), kein Passwort (`src/lib/demo-mode.ts`, `docs/seiten/login.md`).
- Keine `AUTHENTIK_*`-, VAPID-, E2E- oder Mail-Zugangsdaten, `MAIL_DISABLED=true`.
- Eigene Postgres-Instanz im Namespace `theater-website-demo`; Secrets erzeugt der
  ESO-Password-Generator im Cluster (kein Vault).

## Demo-Daten

`scripts/demo/seed.ts` leert die Datenbank, führt die Migrationen aus und legt an:

- Stammdaten aus `scripts/demo/data/stammdaten.json.gz`: Rechte und Rollen, Gewerk-Blaupausen,
  Themes, Sperrlisten-Einstellungen, Lager-Struktur, Lebensmittel (Open Food Facts, ODbL;
  BLS 4.0, CC BY 4.0). Keine Personen, keine Freitexte von Mitgliedern.
- 33 erfundene Personen mit Profil, Maßen, Ernährungshinweisen, Fotoerlaubnis, Interessen.
- „Ein Sommernachtstraum“ (aktiv, Premiere an einem Samstag in etwa acht Wochen) mit Rollen,
  Besetzung, Szenen, Gewerken samt Aufgaben, Meilensteinen, Proben mit Rückmeldungen,
  Anwesenheit und Protokollen, Bautagen, Endprobenwoche mit Diensten, Vorstellungen, Finanzen,
  Rezepten, Lager (`scripts/demo/lager.ts`), Feedback und Benachrichtigungen.
- „Der zerbrochne Krug“ als abgeschlossene Vorjahresproduktion.

Alle Termine liegen relativ zum Tag des Resets. Personen und Produktionen haben feste IDs
(`demo-user-*`, `demo-show-*`), damit Sitzungen und Produktionsauswahl den Reset überstehen.

Zurückgesetzt wird nachts um 3:30 Uhr (CronJob `demo-reset`) und nach jedem ArgoCD-Sync
(PostSync-Hook, also auch bei neuem Image); danach startet die App neu.

## Lokal

```bash
docker exec mb-test-pg psql -U postgres -c "CREATE DATABASE demo_test"
DATABASE_URL=postgresql://postgres:pw@localhost:15432/demo_test pnpm demo:seed
DEMO_MODE=true DATABASE_URL=… pnpm dev
```

Der Seed löscht die ganze Datenbank und läuft deshalb nur mit `DEMO_MODE=true` oder gegen
localhost. Im Image läuft das von `pnpm demo:bundle` (CI) gebaute `scripts/demo/dist/seed.cjs`;
`scripts/demo/auth-stub.ts` ersetzt dort `src/auth.ts`.

## Stammdaten aktualisieren

Wenn neue Rechte, Blaupausen oder Lebensmitteldaten in die Demo sollen:

```bash
kubectl -n theater-website-staging port-forward pod/postgresql-0 25432:5432
SOURCE_DATABASE_URL=postgresql://theater:…@127.0.0.1:25432/theater_staging \
  node scripts/demo/export-stammdaten.mjs
```

Vorher prüfen, dass die exportierten Tabellen weiterhin keinen Personenbezug haben (das Repo ist
öffentlich). Spalten, die es später nicht mehr gibt, ignoriert der Import; neue Spalten bekommen
ihren Default.
