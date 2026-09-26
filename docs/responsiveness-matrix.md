# Responsiveness-Matrix (Mitgliederbereich)

Status je Seite über die drei Nutzerklassen **Handy** (<640px), **Tablet** (768–1023px) und
**Desktop** (≥1024px). Definitionen: `docs/design-system.md` (Abschnitt „Breakpoints & Responsive“).

Legende: ✅ ok · ⚠️ funktioniert, aber mit Einschränkung · ❓ unklar · ➖ Redirect/Platzhalter

**Prüfwege**

- **automatisch** — horizontaler Überlauf über `e2e/responsive-overflow.spec.ts` in den Projekten
  `chromium` (1280×720), `mobile` (390×844), `tablet-portrait` (834×1112) und
  `tablet-landscape` (1024×768).
- **gemessen** — zusätzlich über `pnpm ui:check <route> --viewport all --scheme all` verifiziert
  (fünf Viewports, hell und dunkel, 2026-09-26). Gemessen wird die Dokumentbreite gegen die
  Viewportbreite; Inhalte in einem inneren `overflow-x-auto`-Container gelten nicht als Überlauf.
- **visuell (dynamisch)** — Routen mit Segmenten (IDs) werden per Screenshot geprüft.

## Status der acht Hauptbereiche

| Route                                                    | Handy | Tablet | Desktop | Prüfung               | Anmerkung                                                     |
| -------------------------------------------------------- | ----- | ------ | ------- | --------------------- | ------------------------------------------------------------- |
| `/mitglieder` (Dashboard)                                | ✅    | ✅     | ✅      | gemessen              | Grid `grid-cols-2 lg:grid-cols-4`                             |
| `/mitglieder/profil`                                     | ✅    | ✅     | ✅      | gemessen              | Drill-down `?bereich=`, `lg:grid-cols-[15rem_1fr]`            |
| `/mitglieder/meine-gewerke`                              | ✅    | ✅     | ✅      | gemessen              | `sm:grid-cols-2 xl:grid-cols-4`                               |
| `/mitglieder/meine-gewerke/[slug]`                       | ✅    | ✅     | ✅      | visuell (dynamisch)   | Portal mit `?ansicht=`                                        |
| `/mitglieder/produktionen`                               | ✅    | ✅     | ✅      | gemessen              | `md:grid-cols-2`                                              |
| `/mitglieder/produktionen/zuweisung`                     | ✅    | ✅     | ✅      | gemessen              | zwei `SegmentedControl`, Bottom-Sheet mobil                   |
| `/mitglieder/produktionen/stueck`                        | ✅    | ✅     | ✅      | gemessen              | `SectionNav`; Auftritte-Tabelle scrollt innen                 |
| `/mitglieder/sperrliste`                                 | ✅    | ✅     | ✅      | gemessen              | Karten↔Tabelle, Tag-Stufen; frühere Tablet-Schuld ist behoben |
| `/mitglieder/terminplanung`                              | ✅    | ✅     | ✅      | gemessen              | Liste nach Monaten                                            |
| `/mitglieder/probenplanung`                              | ✅    | ✅     | ✅      | automatisch           | Kalender mit innerem `overflow-x-auto`                        |
| `/mitglieder/datenportal`                                | ✅    | ✅     | ✅      | gemessen              | Ergebnistabelle scrollt innen (`hidden md:block`)             |
| `/mitglieder/mitgliederverwaltung`                       | ✅    | ✅     | ✅      | gemessen              | Karten↔Tabelle, `SectionNav`                                  |
| `/mitglieder/mitgliederverwaltung/[userId]`              | ✅    | ✅     | ✅      | visuell (dynamisch)   | `xl:grid-cols-[320px_1fr]`                                    |
| `/mitglieder/mitgliederverwaltung/aufbewahrung`          | ✅    | ✅     | ✅      | gemessen              | Listen                                                        |
| `/mitglieder/meine-proben`                               | ✅    | ✅     | ✅      | automatisch           | Grid + `sm:flex-row`                                          |
| `/mitglieder/koerpermasse`                               | ✅    | ✅     | ✅      | automatisch           | Karten↔Tabelle                                                |
| `/mitglieder/fotoerlaubnisse`                            | ✅    | ✅     | ✅      | automatisch           | `lg:flex-row`                                                 |
| `/mitglieder/rechte`                                     | ✅    | ✅     | ✅      | automatisch           | Karten↔Tabelle, Umschaltung ab `md`                           |
| `/mitglieder/website`                                    | ✅    | ✅     | ✅      | automatisch           | `sm:grid-cols-2 lg:grid-cols-3`                               |
| `/mitglieder/pages/seitensteuerung`                      | ✅    | ✅     | ✅      | visuell (Screenshots) | Flex-Zeilen/Switches                                          |
| `/mitglieder/server-analytics`                           | ✅    | ✅     | ✅      | automatisch           | Karten↔Tabelle, Umschaltung ab `md`                           |
| `/mitglieder/server-einstellungen`                       | ✅    | ✅     | ✅      | automatisch           | `md:grid-cols-2`                                              |
| `/mitglieder/onboarding`                                 | ✅    | ✅     | ✅      | automatisch           | `lg:flex-row`                                                 |
| `/mitglieder/onboarding/[onboardingId]/talente/[userId]` | ✅    | ✅     | ✅      | visuell (dynamisch)   | `sm:grid-cols-2`                                              |

## Redirects und Platzhalter

| Route                                                | Zustand                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| `/mitglieder/dashboard`                              | ➖ Redirect auf `/mitglieder`                                    |
| `/mitglieder/rollenverwaltung`                       | ➖ Redirect                                                      |
| `/mitglieder/produktionen/besetzung`                 | ➖ Redirect auf `/mitglieder/produktionen/stueck?ansicht=rollen` |
| `/mitglieder/produktionen/szenen`                    | ➖ Redirect auf das Stück                                        |
| `/mitglieder/produktionen/rueckmeldungen-auswertung` | ➖ Platzhalter                                                   |

## Offene Punkte

1. **Ensemble:** `produktionen/[showId]/ensemble/ensemble-forms-client.tsx` hat keine
   Breakpoint-Klassen – Verhalten auf Handy/Tablet prüfen und das Seiten-Muster ergänzen.
2. **Rechte / Server-Analytics:** schalten erst bei `md` (768px) auf Tabellen um; Tablet liegt
   genau auf der Grenze – gezielt bei 768px prüfen.
3. **Dynamische Routen systematisch:** alle ID-Routen per Screenshot (Handy/Tablet/Desktop,
   hell/dunkel) nachziehen; der Kalender der Probenplanung scrollt bewusst innerhalb seiner Karte
   (`min-w-[540px] sm:min-w-[640px] lg:min-w-[720px]`, `month-calendar.tsx`).

> Hinweis: `e2e/responsive-overflow.spec.ts` überspringt `/mitglieder/sperrliste` auf den
> Tablet-Projekten weiterhin (`TABLET_OVERFLOW_KNOWN`), obwohl die Seite seit dem Redesign
> (2026-09, „Runde 3“) nicht mehr horizontal scrollt. Der Skip kann entfernt werden, sobald die
> Testdatei angefasst wird – das ist eine Code-Änderung außerhalb der Doku.
