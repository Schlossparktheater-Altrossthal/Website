# Responsiveness-Matrix (Mitgliederbereich)

Status je Seite über die drei Nutzerklassen **Handy** (<640px), **Tablet** (768–1023px) und
**Desktop** (≥1024px). Definitionen: `docs/design-system.md` (Abschnitt „Breakpoints & Responsive").

Legende: ✅ ok · ⚠️ funktioniert, aber mit Einschränkung (siehe „offene Punkte") · ❓ unklar · ➖ Redirect/Platzhalter

Automatisch geprüft wird horizontaler Überlauf über `e2e/responsive-overflow.spec.ts` in den
Projekten `chromium` (1280×720), `mobile` (390×844), `tablet-portrait` (834×1112) und
`tablet-landscape` (1024×768). Seiten mit dynamischen Segmenten (IDs) werden visuell über
`pnpm e2e:screenshots` geprüft.

| Route                                                    | Muster                                                    | Handy | Tablet | Desktop | Prüfung                           | Offene Punkte                                                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------- | ----- | ------ | ------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/mitglieder` (Dashboard)                                | Grid (`grid-cols-2 lg:grid-cols-4`)                       | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/dashboard`                                  | –                                                         | ➖    | ➖     | ➖      | –                                 | Redirect auf `/mitglieder`                                                                                                                                           |
| `/mitglieder/meine-proben`                               | Grid + `sm:flex-row`                                      | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/probenplanung`                              | `sm:flex-row`, Kalender mit `overflow-x-auto` → `sm:grid` | ✅    | ✅     | ✅      | automatisch                       | `month-calendar.tsx:114` `sm:min-w-[640px] lg:min-w-[720px]`                                                                                                         |
| `/mitglieder/probenplanung/proben/[id]`                  | `md:grid-cols-3`, `lg:grid-cols-2`                        | ✅    | ✅     | ✅      | visuell (dynamisch)               | –                                                                                                                                                                    |
| `/mitglieder/proben/[id]`                                | Kartenliste `sm:flex-row`                                 | ✅    | ✅     | ✅      | visuell (dynamisch)               | –                                                                                                                                                                    |
| `/mitglieder/produktionen`                               | `md:grid-cols-2`                                          | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/produktionen/[showId]`                      | `sm:grid-cols-3`, `sm:flex-row`                           | ✅    | ✅     | ✅      | visuell (dynamisch)               | –                                                                                                                                                                    |
| `/mitglieder/produktionen/[showId]/ensemble`             | unklar                                                    | ❓    | ❓     | ❓      | visuell (dynamisch)               | `ensemble-forms-client.tsx` ohne Breakpoint-Klassen gefunden (Phase 2)                                                                                               |
| `/mitglieder/produktionen/besetzung`                     | `sm:grid-cols-2 lg:grid-cols-3`                           | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/produktionen/gewerke`                       | `sm:grid-cols-2 lg:grid-cols-3`                           | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/produktionen/gewerke/[id]`                  | `md:grid-cols-3`, `xl:grid-cols-[2fr_1fr]`                | ✅    | ✅     | ✅      | visuell (dynamisch)               | –                                                                                                                                                                    |
| `/mitglieder/produktionen/szenen`                        | `lg:grid-cols-[1fr_auto]`, `md:grid-cols-4`               | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/produktionen/rueckmeldungen-auswertung`     | –                                                         | ➖    | ➖     | ➖      | –                                 | Platzhalter                                                                                                                                                          |
| `/mitglieder/sperrliste`                                 | Karten↔Tabelle (`sm:hidden`/`hidden sm:block`)            | ✅    | ⚠️     | ✅      | automatisch (Tablet übersprungen) | Timeline `min-w-[900px]` (`TimelineView.tsx:133,204`), Sticky-Spalte `w-[280px]` + 7 Tagesspalten (`desktop-table.tsx`) → horizontales Scrollen auf Tablet (Phase 2) |
| `/mitglieder/profil`                                     | Drill-down `?bereich=` (`lg:grid-cols-[15rem_1fr]`)       | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/koerpermasse`                               | Karten↔Tabelle                                            | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/fotoerlaubnisse`                            | `lg:flex-row`, `md:grid-cols-2 xl:grid-cols-3`            | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/mitgliederverwaltung`                       | Karten↔Tabelle                                            | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/mitgliederverwaltung/[userId]`              | `xl:grid-cols-[320px_1fr]`, Tabs                          | ✅    | ✅     | ✅      | visuell (dynamisch)               | –                                                                                                                                                                    |
| `/mitglieder/mitgliederverwaltung/aufbewahrung`          | `flex-wrap`-Listen                                        | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/rollenverwaltung`                           | –                                                         | ➖    | ➖     | ➖      | –                                 | Redirect                                                                                                                                                             |
| `/mitglieder/rechte`                                     | Karten↔Tabelle (`md:hidden`/`hidden md:block`)            | ✅    | ✅     | ✅      | automatisch                       | Umschaltung erst bei `md` (768) – Tablet-Grenzfall (Phase 2)                                                                                                         |
| `/mitglieder/website`                                    | `sm:grid-cols-2`, `lg:grid-cols-3`                        | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/pages/seitensteuerung`                      | Flex-Zeilen/Switches                                      | ✅    | ✅     | ✅      | visuell (Screenshots)             | –                                                                                                                                                                    |
| `/mitglieder/server-analytics`                           | Karten↔Tabelle (`md:hidden`/`hidden md:block`)            | ✅    | ✅     | ✅      | automatisch                       | Umschaltung erst bei `md` (768) – Tablet-Grenzfall (Phase 2)                                                                                                         |
| `/mitglieder/server-einstellungen`                       | `md:grid-cols-2`                                          | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/onboarding`                                 | `lg:flex-row`                                             | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/onboarding/[onboardingId]/talente/[userId]` | `sm:grid-cols-2`, `lg:grid-cols-2`                        | ✅    | ✅     | ✅      | visuell (dynamisch)               | –                                                                                                                                                                    |
| `/mitglieder/meine-gewerke`                              | `sm:grid-cols-2 xl:grid-cols-4`                           | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |
| `/mitglieder/meine-gewerke/[slug]`                       | `xl:flex-row`, `lg:flex-row`                              | ✅    | ✅     | ✅      | visuell (dynamisch)               | –                                                                                                                                                                    |
| `/mitglieder/meine-gewerke/todos`                        | `md:grid-cols-3`                                          | ✅    | ✅     | ✅      | automatisch                       | –                                                                                                                                                                    |

## Priorisierter Backlog (Phase 2)

1. **Sperrliste (Tablet):** Timeline (`sperrliste/overview/TimelineView.tsx:133,204`) erzwingt
   `min-w-[900px]`, die Desktop-Tabelle (`sperrliste/overview/desktop-table.tsx`) hat eine
   Sticky-Spalte `w-[280px]` plus sieben Tagesspalten à `min-w-[110px]` (≈1050px). Auf Tablet
   scrollt die Seite dadurch horizontal. Der Overflow-Test überspringt `/mitglieder/sperrliste`
   deshalb auf den Tablet-Projekten (`e2e/responsive-overflow.spec.ts`).
2. **Ensemble:** `produktionen/[showId]/ensemble/ensemble-forms-client.tsx` hat keine
   Breakpoint-Klassen – Verhalten auf Handy/Tablet prüfen und Muster ergänzen.
3. **Rechte / Server-Analytics:** schalten erst bei `md` (768px) auf Tabellen um; Tablet liegt
   genau auf der Grenze – gezielt bei 768px prüfen.
4. **Alle 32 Seiten systematisch:** dynamische Routen (IDs) visuell per Screenshot nachziehen und
   die restlichen `min-w-[…]`-/`overflow-x-auto`-Fundstellen (38 bzw. 16 Treffer) auf Seitebene
   bewerten.

## Bekannte Responsive-Sünden (Code-Stand)

- `overflow-x-auto`/`overflow-x-scroll`: 16 Treffer in 12 Dateien (überwiegend in
  `hidden md:block`-Desktop-Zweigen – dort beabsichtigt).
- `min-w-[…]`/`w-[NNNpx]`: 38 Treffer in 18 Dateien; kritisch vor allem Sperrliste und
  `components/calendar/month-calendar.tsx:114`.
- Hardcode-Overrides: `sperrliste/overview/sperrliste-styles.css:165–200` (`.bg-white`,
  `.bg-slate-*`, `.border-slate-*`, `.text-slate-*`) – live über `overview-content.tsx`.
