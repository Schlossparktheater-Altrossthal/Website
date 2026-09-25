# Seiten-Dokumentation

Dieser Ordner beschreibt die Seiten der Website strukturiert nach Bereich. Er dient als
Orientierung für die Weiterentwicklung: Was gehört zusammen, welche Berechtigungen gelten,
welche Komponenten und Datenpfade sind beteiligt und welche bekannten Baustellen es gibt.

## Mitgliederbereich (`/mitglieder`)

| Bereich      | Datei                              | Kurzbeschreibung                                              |
| ------------ | ---------------------------------- | ------------------------------------------------------------- |
| Dashboard    | [dashboard.md](dashboard.md)       | Übersichtsseite nach Login                                    |
| Proben       | [proben.md](proben.md)             | Probenplanung, einzelne Proben, Meine Proben                  |
| Gewerke      | [gewerke.md](gewerke.md)           | Meine Gewerke und Aufgaben (Todos)                            |
| Profil       | [profil.md](profil.md)             | Eigenes Profil, Körpermaße, Fotoerlaubnisse                   |
| Sperrliste   | [sperrliste.md](sperrliste.md)     | Nicht-Verfügbarkeiten der Ensemblemitglieder                  |
| Produktionen | [produktionen.md](produktionen.md) | Stücke, Besetzung, Gewerke, Szenen, Rückmeldungen             |
| Verwaltung   | [verwaltung.md](verwaltung.md)     | Mitglieder-, Rollen- und Rechteverwaltung                     |
| Onboarding   | [onboarding.md](onboarding.md)     | Aufnahme neuer Mitglieder, Talentprofile                      |
| Login        | [login.md](login.md)               | Anmeldung über das Theater-Konto (Authentik)                  |
| Website      | [website.md](website.md)           | Theme-/Branding-Einstellungen, Sichtbarkeit Mitglieder-Seiten |
| Server       | [server.md](server.md)             | Server-Einstellungen und Server-Analytics                     |

## Konventionen

- **Permissions** folgen dem Schema `VISIBILITY.PAGE.CONTEXT.ACTION` (siehe `AGENTS.md`).
- **Design-Tokens** statt harter Farben; Details in `docs/design-system.md`.
- **Responsive Muster** (Tabs, Header, Sidebar) sind in `AGENTS.md` unter „RESPONSIVE DESIGN PATTERNS" festgehalten; Breakpoints/Nutzerklassen in `docs/design-system.md`, Status je Seite in `docs/responsiveness-matrix.md`.
