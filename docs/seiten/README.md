# Seiten-Dokumentation

Dieser Ordner beschreibt die Seiten der Website strukturiert nach Bereich. Er dient als
Orientierung für die Weiterentwicklung: Was gehört zusammen, welche Berechtigungen gelten,
welche Komponenten und Datenpfade sind beteiligt und welche bekannten Baustellen es gibt.

## Mitgliederbereich (`/mitglieder`)

| Bereich          | Datei                                | Kurzbeschreibung                                        |
| ---------------- | ------------------------------------ | ------------------------------------------------------- |
| Dashboard        | [dashboard.md](dashboard.md)         | Übersichtsseite nach Login                              |
| Proben           | [proben.md](proben.md)               | Probenplanung, einzelne Proben, Meine Proben            |
| Gewerke          | [gewerke.md](gewerke.md)             | Meine Gewerke und Aufgaben (Todos)                      |
| Profil           | [profil.md](profil.md)               | Eigenes Profil, Körpermaße, Fotoerlaubnisse             |
| Sperrliste       | [sperrliste.md](sperrliste.md)       | Nicht-Verfügbarkeiten der Ensemblemitglieder            |
| Produktionen     | [produktionen.md](produktionen.md)   | Stücke, Besetzung, Gewerke, Szenen, Rückmeldungen       |
| Verwaltung       | [verwaltung.md](verwaltung.md)       | Mitglieder-, Rollen- und Rechteverwaltung               |
| Onboarding       | [onboarding.md](onboarding.md)       | Aufnahme neuer Mitglieder, Talentprofile                |
| Website          | [website.md](website.md)             | Theme-/Branding-Einstellungen, Inhalte, Seitensteuerung |
| Server           | [server.md](server.md)               | Server-Einstellungen und Server-Analytics               |
| Mystery (intern) | [mystery-tipps.md](mystery-tipps.md) | Verwaltung der Mystery-Tipps                            |

## Öffentliche Seiten

| Bereich    | Datei                                                  | Kurzbeschreibung                   |
| ---------- | ------------------------------------------------------ | ---------------------------------- |
| Home       | [oeffentlich-home.md](oeffentlich-home.md)             | Startseite mit Premieren-Countdown |
| Chronik    | [oeffentlich-chronik.md](oeffentlich-chronik.md)       | Vergangene Produktionen            |
| Mystery    | [oeffentlich-mystery.md](oeffentlich-mystery.md)       | Öffentliches Rätsel                |
| Über uns   | [oeffentlich-ueber-uns.md](oeffentlich-ueber-uns.md)   | Vorstellung des Vereins            |
| Schulkatze | [oeffentlich-schulkatze.md](oeffentlich-schulkatze.md) | Die Schulkatze des BSZ Altrossthal |
| Sonstige   | [oeffentlich-sonstige.md](oeffentlich-sonstige.md)     | Galerie, Datenschutz, Impressum    |

## Konventionen

- **Permissions** folgen dem Schema `VISIBILITY.PAGE.CONTEXT.ACTION` (siehe `AGENTS.md`).
- **Feature-Keys** für öffentliche Seiten liegen in `FEATURE_DEFINITIONS` (`src/lib/frontend-editing.ts`).
- **Design-Tokens** statt harter Farben; Details in `docs/design-system.md`.
- **Responsive Muster** (Tabs, Header, Sidebar) sind in `AGENTS.md` unter „Responsive Design Patterns" festgehalten.
