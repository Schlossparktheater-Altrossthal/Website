# UI-Konsistenz-Audit (Mitgliederbereich)

Stand: 2026-10-04. Prüfbericht. Grundlage für die generellen UI-Regeln in
`docs/design-system.md` und `AGENTS.md`. Es wurde **kein Produktcode geändert** – dieser Bericht
und die daraus abgeleiteten Regeln sind die einzige Änderung.

## Ziel

Der Mitgliederbereich soll überall gleich aussehen. Dafür wurde die **gerenderte** UI aller
Routen erfasst und ausgewertet: Computed Styles, Geometrie und Komponenten-Muster je Seite.
Abweichungen von den Primitives (`Card`, `ListRow`, `Input`, `Button`, …) werden hier belegt und
anschließend in den Regeln festgeschrieben.

## Methode

- **Erfassung:** 41 statische Routen des Mitgliederbereichs (Liste aus
  `e2e/responsive-overflow.spec.ts`), je in `desktop` (1440×900) und `mobile` (390×844).
- **Werkzeug:** Playwright gegen `pnpm dev` (lokale Postgres via Docker), Anmeldung über
  `/api/dev/screenshot-session` (`role=admin`). Ausgewertet wurde das DOM im gerenderten Zustand
  (`getComputedStyle`, `getBoundingClientRect`) – nicht der Quelltext.
- **Zusätzlich:** Screenshots aller Routen in `mobile`, `tablet-portrait`, `desktop` × hell/dunkel
  als Belege (`pnpm e2e:screenshots`-Muster).
- **Hinweis:** Die Bildschirmfotos ließen sich in dieser Sitzung nicht visuell auswerten
  (Bildinhalte kamen nicht an). Die Befunde stützen sich deshalb auf die gemessene Darstellung und
  den Quelltext der Primitives; die Screenshots liegen als Beleg bei.

## Kanonische Werte (Ist-Stand der Primitives)

Diese Werte sind der verbindliche Maßstab. Sie stammen aus den geteilten Komponenten, nicht aus
Einzelseiten:

| Baustein                     | Kanonisch                                                                                       | Quelle                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Card-Radius                  | `rounded-lg`                                                                                    | `src/components/ui/card.tsx`                     |
| Card-Fläche                  | `bg-card` (plain) bzw. `bg-card/60` + `backdrop-blur` (default)                                 | `src/components/ui/card.tsx`                     |
| Card-Rahmen                  | `border-border/60` (plain) / `border-border/50` (default)                                       | `src/components/ui/card.tsx`                     |
| Listenzeile                  | `rounded-md`, `min-h-12 py-2.5` (kompakt `min-h-10`)                                            | `src/components/ui/list-row.tsx`                 |
| Listengruppe                 | `rounded-lg border border-border`                                                               | `src/components/ui/list-row.tsx`                 |
| Kennzahl-Kachel              | `rounded-lg border p-3 shadow-sm`                                                               | `src/components/ui/stat-tile.tsx`                |
| Formularfeld (`Input`)       | `h-10 rounded-md border-input bg-background`                                                    | `src/components/ui/input.tsx`                    |
| Select-Auslöser              | `h-10 rounded-md border-input bg-background`                                                    | `src/components/ui/select.tsx`                   |
| Button-Höhen                 | `xs h-8` · `sm h-9` · `md h-10` · `lg h-11` · `xl h-12` · `icon h-9 w-9`                        | `src/components/ui/button.tsx`                   |
| Umschalter (Segmented/Sect.) | Container `rounded-lg bg-muted/70 p-0.5`, Einträge `h-10`                                       | `ui/segmented-control.tsx`, `ui/section-nav.tsx` |
| Badge / Pills                | `rounded-full`                                                                                  | `src/components/ui/badge.tsx`                    |
| Seitentitel (H1)             | `text-2xl md:text-3xl font-semibold`                                                            | `src/components/members/page-header.tsx`         |
| Seiten-Rhythmus              | Shell liefert `space-y-8` (gap `md`); Seite innen `space-y-6`, dichte Arbeitsseiten `space-y-4` | `src/components/members/members-app-shell.tsx`   |

**Radius-Skala:** `rounded-md` für Steuerelemente und Listenzeilen, `rounded-lg` für Container
(Cards, Kacheln, Listengruppen, Umschalter), `rounded-full` für Pills/Badges. `rounded-xl` und
`rounded-2xl` kommen im System nur als Sonderfall vor (Dialog auf dem Handy `rounded-t-2xl`).

## Befunde

| #   | Befund                                                                                                                                                                                                                                                                 | Stelle / Beleg                                                                                                                                                               | Bewertung     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Doku nennt Cards als `rounded-xl border border-border bg-card` – tatsächlich ist die Card `rounded-lg` mit `border-border/50 bg-card/60` bzw. `plain` `border-border/60`                                                                                               | `docs/design-system.md` (Abschnitt „Seiten-Muster“, Punkt 4) vs. `src/components/ui/card.tsx:7`                                                                              | Doku falsch   |
| 2   | Doku nennt Listenzeilen `min-h-16 rounded-xl border border-border bg-card p-3` – tatsächlich `ListRow` `rounded-md`, `min-h-12`; die Gruppe liefert Rahmen/Radius                                                                                                      | `docs/design-system.md` (Punkt 4) vs. `src/components/ui/list-row.tsx:48`                                                                                                    | Doku falsch   |
| 3   | Doku mappt den Shell-Gap falsch: „`md` (`space-y-6`)“ – `md` ist `space-y-8`, `sm` ist `space-y-6`                                                                                                                                                                     | `docs/design-system.md:114` vs. `src/components/members/members-app-shell.tsx:67`                                                                                            | Doku falsch   |
| 4   | Orange gefüllte `TabsList`-Pills stehen laut Doku auf Mitglieder-Detail, Server-Analytics und Website & Theme – Server-Analytics nutzt inzwischen `SectionNav`, dafür nutzt das Onboarding-Dashboard sie                                                               | `docs/design-system.md:675`, `AGENTS.md`; Audit: `tablist with bg-primary` nur auf `/mitglieder/website` und `/mitglieder/onboarding`                                        | Doku veraltet |
| 5   | Seitentitel weichen ab: `/mitglieder/datenportal` eigenes `<h1 class="text-2xl">` (24 px statt 30 px), `/mitglieder/produktionen/[showId]/ensemble` `<h1 class="text-2xl">`, `/mitglieder/onboarding/[onboardingId]/talente/[userId]` `text-3xl sm:text-4xl font-bold` | Audit + `src/app/(members)/mitglieder/datenportal/page.tsx:55`, `…/produktionen/[showId]/ensemble/page.tsx:186`, `…/onboarding/[onboardingId]/talente/[userId]/page.tsx:117` | Abweichung    |
| 6   | Kopf ohne `PageHeader`: `/mitglieder/website` und `/mitglieder/server-einstellungen` rendern ein eigenes `<h1 class="text-3xl tracking-tight">`, das Onboarding-Dashboard einen eigenen Header (24 px)                                                                 | `…/website/page.tsx:61`, `…/server-einstellungen/page.tsx:54`, `…/dashboard/onboarding/[onboardingId]/_components/header-bar.tsx:96`                                         | Abweichung    |
| 7   | Rahmen-Alpha ohne Skala: `border-border/30`, `/40`, `/50`, `/60`, `/70`, `/80` parallel im Einsatz                                                                                                                                                                     | Audit (aggregiert): /60 134 · /70 72 · /40 16 · /50 14 · /80 2 · /30 2                                                                                                       | Abweichung    |
| 8   | Werkzeugzeilen-Suchfeld nicht einheitlich hoch: `<Input class="pl-9">` ist `h-10` (40 px, unter der 44-px-Touch-Vorgabe), einige Seiten setzen `h-9` (36 px), `assignment-board` baut ein eigenes `h-11`-Feld                                                          | Audit (Suchfeldhöhen 36/40 px), `…/zuweisung/assignment-board.tsx:374`, Doku `h-11` (`docs/design-system.md:655`)                                                            | Abweichung    |
| 9   | Leerzustand nicht überall `py-12 text-center text-sm text-muted-foreground` (nur 4 von 41 Routen messbar in dieser Form)                                                                                                                                               | Audit: `/mitglieder/produktionen`, `…/rueckmeldungen-auswertung`, `…/terminfinder` (2×)                                                                                      | Ausbaufähig   |

## Abgeleitete generelle Regeln

1. **Primitives statt Eigenbau.** Cards, Listen, Kacheln, Felder, Buttons, Umschalter und Badges
   immer aus `src/components/ui` nehmen. Wenn ein Wert dort steht, gilt er – Einzelseiten
   definieren keine eigenen Radien, Höhen oder Rahmenstärken.
2. **Radius-Skala einhalten:** `rounded-md` (Steuerelemente, Zeilen), `rounded-lg` (Container),
   `rounded-full` (Pills/Badges). Kein `rounded-xl` für Cards/Container.
3. **Rahmen einheitlich:** Standard `border-border`; abgeschwächt `border-border/60`. Neue
   Zwischenstufen (`/30`, `/40`, `/50`, `/70`, `/80`) nur mit Begründung.
4. **Ein Seitenkopf pro Seite** über `PageHeader` (`text-2xl md:text-3xl`). Kein eigenes `<h1>`,
   keine zweite Größe.
5. **Steuerelement-Höhe `h-10`** (`Input`, `Select`, `Button md`, Umschalter). Touch-Ziele auf dem
   Handy mindestens 44 px – Werkzeugzeilen dürfen dafür auf `h-11` gehen, aber innerhalb einer
   Zeile einheitlich.
6. **Seiten-Rhythmus:** Shell liefert `space-y-8`; Seite innen `space-y-6`, dichte Arbeitsseiten
   `space-y-4`.
7. **Bereichs-Navigation** über eines der vier Muster (`SectionNav`, `SegmentedControl`,
   `ViewSwitcher`, Bereichsliste). Orange gefüllte `TabsList`-Pills nur noch als Bestand;
   Neues damit ist unzulässig.
8. **Leerzustand** `py-12 text-center text-sm text-muted-foreground`, Icon optional.

## Offene Punkte

- Abweichungen 5, 6, 7 und 8 sind Code-Themen. Sie sind in diesem Bericht bewusst nur dokumentiert;
  ein Fix gehört in eigene `fix(...)`-Commits (bzw. Issues), nicht in eine Doku-Änderung.
- Der Audit deckt die statischen Routen ab. Dynamische Detailrouten (`…/[showId]`, `…/[userId]`,
  `…/[rehearsalId]`) wurden stichprobenartig über die Screenshots erfasst.
