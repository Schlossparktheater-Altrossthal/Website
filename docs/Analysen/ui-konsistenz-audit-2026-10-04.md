# UI-Ist-Stand des Mitgliederbereichs

Stand: 2026-10-04. Prüfbericht. Beschreibt das **aktuelle** UI-Format des Mitgliederbereichs und
dient als Grundlage für die Regeln in `docs/design-system.md` und `AGENTS.md`. Es wurde **kein
Produktcode geändert**.

## Ziel

Der Bericht hält fest, wie die Oberfläche **heute tatsächlich** aussieht – gerenderte UI (Computed
Styles, Geometrie, Komponenten-Muster je Seite) – damit die Dokumentation den Stand der Website
beschreibt. Wo einzelne Seiten vom Standard der Primitives abweichen, steht das als Ist-Wert hier.

## Methode

- **Erfassung:** 41 statische Routen des Mitgliederbereichs (Liste aus
  `e2e/responsive-overflow.spec.ts`), je in `desktop` (1440×900) und `mobile` (390×844).
- **Werkzeug:** Playwright gegen `pnpm dev` (lokale Postgres via Docker), Anmeldung über
  `/api/dev/screenshot-session` (`role=admin`). Ausgewertet wurde das DOM im gerenderten Zustand
  (`getComputedStyle`, `getBoundingClientRect`).
- **Zusätzlich:** Screenshots aller Routen in `mobile`, `tablet-portrait`, `desktop` × hell/dunkel.
- **Hinweis:** Die Bildschirmfotos ließen sich in dieser Sitzung nicht visuell auswerten
  (Bildinhalte kamen nicht an). Die Werte stützen sich deshalb auf die gemessene Darstellung und
  den Quelltext der Primitives; die Screenshots liegen als Beleg bei.

## Kanonische Werte (Standard der Primitives)

| Baustein                     | Kanonisch                                                                                                                                                                                                     | Quelle                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Card-Radius                  | `rounded-lg`                                                                                                                                                                                                  | `src/components/ui/card.tsx`                     |
| Card-Varianten               | `plain` `border-border/60 bg-card shadow-sm`, `default` `border-border/50 bg-card/60 backdrop-blur`, `muted` `border-transparent bg-muted/40`, `accent` `border-primary/25 bg-primary/5`, `ghost` transparent | `src/components/ui/card.tsx`                     |
| Listenzeile                  | `rounded-md`, `min-h-12 py-2.5` (kompakt `min-h-10`)                                                                                                                                                          | `src/components/ui/list-row.tsx`                 |
| Listengruppe                 | `rounded-lg border border-border`                                                                                                                                                                             | `src/components/ui/list-row.tsx`                 |
| Kennzahl-Kachel              | `rounded-lg border p-3 shadow-sm`                                                                                                                                                                             | `src/components/ui/stat-tile.tsx`                |
| Formularfeld (`Input`)       | `h-10 rounded-md border-input bg-background`                                                                                                                                                                  | `src/components/ui/input.tsx`                    |
| Select-Auslöser              | `h-10 rounded-md border-input bg-background`                                                                                                                                                                  | `src/components/ui/select.tsx`                   |
| Button-Höhen                 | `xs h-8` · `sm h-9` · `md h-10` · `lg h-11` · `xl h-12` · `icon h-9 w-9`                                                                                                                                      | `src/components/ui/button.tsx`                   |
| Umschalter (Segmented/Sect.) | Container `rounded-lg bg-muted/70 p-0.5`, Einträge `h-10`                                                                                                                                                     | `ui/segmented-control.tsx`, `ui/section-nav.tsx` |
| Badge / Pills                | `rounded-full`                                                                                                                                                                                                | `src/components/ui/badge.tsx`                    |
| Seitentitel (H1)             | `text-2xl md:text-3xl font-semibold` (über `PageHeader`)                                                                                                                                                      | `src/components/members/page-header.tsx`         |
| Seiten-Rhythmus              | Shell liefert `space-y-8` (gap `md`); Seite innen `space-y-6`, dichte Arbeitsseiten `space-y-4`                                                                                                               | `src/components/members/members-app-shell.tsx`   |

**Radius-Skala (Standard):** `rounded-md` für Steuerelemente und Listenzeilen, `rounded-lg` für
Container (Cards, Kacheln, Listengruppen, Umschalter), `rounded-full` für Pills und Badges. Im
Bestand zusätzlich `rounded-2xl` (Onboarding-Dashboard-Kopf, mobiler Dialog `rounded-t-2xl`) und
vereinzelt `rounded-xl` außerhalb von Cards.

## Ist-Stand des aktuellen Formats

| #   | Thema                  | Aktueller Stand                                                                                                                                                                                                                                             | Beleg                                                                                                                          |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Shell-Gap              | Stufen `none/xs/sm/md/lg/xl` → `space-y-0/4/6/8/10/12`; Standard `md` = `space-y-8`                                                                                                                                                                         | `src/components/members/members-app-shell.tsx:67`                                                                              |
| 2   | Seitentitel            | Standard über `PageHeader` (`text-2xl md:text-3xl font-semibold`); abweichend: `datenportal` `text-2xl`, `produktionen/[showId]` `text-3xl`, `…/[showId]/ensemble` `text-2xl`, `onboarding/…/talente/[userId]` `text-3xl font-bold sm:text-4xl`             | `page-header.tsx:111`, `datenportal/page.tsx:55`, `produktionen/[showId]/page.tsx:101`                                         |
| 3   | Kopf ohne `PageHeader` | Eigene `<h1>`: `website` und `server-einstellungen` (`text-3xl font-semibold tracking-tight`); Onboarding-Dashboard eigener Kopf (`text-xl sm:text-2xl`) in einer `Card rounded-2xl border border-border/40 bg-card/70`                                     | `website/page.tsx:61`, `server-einstellungen/page.tsx:54`, `dashboard/onboarding/[onboardingId]/_components/header-bar.tsx:92` |
| 4   | Bereichs-Navigation    | Orange `TabsList`-Pills in `mitgliederverwaltung/[userId]`, `website` (Theme-Manager) und im Onboarding-Dashboard (`dashboard-client`, `ranking-tab`); alle übrigen Bereiche nutzen `SectionNav`, `SegmentedControl`, `ViewSwitcher` oder die Bereichsliste | `mitgliederverwaltung/[userId]/page.tsx:931`, `website/theme-settings-manager.tsx:1010`, `dashboard-client.tsx:205`            |
| 5   | Rahmen                 | Standard `border-border`, abgeschwächt `border-border/60`; Cards `border-border/50` (default) und `/60` (plain); im Bestand außerdem `/30`, `/40`, `/70`, `/80` (aggregiert gemessen); Formularfelder `border-input`                                        | Audit aggregiert: /60 134 · /70 72 · /40 16 · /50 14 · /80 2 · /30 2                                                           |
| 6   | Werkzeugzeilen-Suche   | `Input` mit Suchicon (`pl-9`), Höhe `h-10` (Input-Standard); in `Stück` und `Teams & Zuweisung` `h-11`; `assignment-board` als eigenes `h-11`-Feld                                                                                                          | `members-table.tsx:424`, `produktionen/stueck/ui.tsx:45`, `zuweisung/assignment-board.tsx:374`                                 |
| 7   | Leerzustand            | Überwiegend `py-12 text-center text-sm text-muted-foreground` (40 Vorkommen im Quelltext); nicht auf jeder Seite in genau dieser Form                                                                                                                       | Audit                                                                                                                          |

## Verbindliche Werte

Die Werte, die die Website über die Primitives durchgängig verwendet und die die Dokumentation als
Standard führt (Ausnahmen stehen oben):

1. **Primitives** (`src/components/ui`) liefern die Werte; Einzelseiten definieren nur in den
   genannten Ausnahmen eigene Radien, Höhen oder Rahmenstärken.
2. **Radius:** `rounded-md` (Steuerelemente, Zeilen), `rounded-lg` (Container), `rounded-full`
   (Pills/Badges).
3. **Rahmen:** `border-border`, abgeschwächt `border-border/60`; Cards `border-border/50`–`/60`;
   Formularfelder `border-input`.
4. **Seitenkopf:** H1 `text-2xl md:text-3xl font-semibold` über `PageHeader`.
5. **Steuerelement-Höhe:** `h-10` (`Input`, `Select`, `Button md`, Umschalter).
6. **Seiten-Rhythmus:** Shell `space-y-8` (gap `md`); Seite innen `space-y-6`, dichte Arbeitsseiten
   `space-y-4`.
7. **Bereichs-Navigation:** `SectionNav`, `SegmentedControl`, `ViewSwitcher` oder Bereichsliste.
8. **Leerzustand:** `py-12 text-center text-sm text-muted-foreground`.

## Abdeckung

- Statische Routen des Mitgliederbereichs (Liste aus `e2e/responsive-overflow.spec.ts`), je
  Desktop (1440×900) und Mobile (390×844).
- Screenshots aller Routen in `mobile`, `tablet-portrait`, `desktop` × hell/dunkel als Belege.
- Dynamische Detailrouten (`…/[showId]`, `…/[userId]`, `…/[rehearsalId]`) stichprobenartig über die
  Screenshots erfasst.
