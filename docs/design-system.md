# Designsystem & Token-Leitfaden

Dieser Leitfaden bündelt die aktualisierten Design Tokens, Typografie- und Spacing-Regeln sowie die wichtigsten Komponentenrichtlinien des Redesigns. Ergänzende Analysen bleiben in `docs/entwurf-und-analyse.md` dokumentiert.

## Technischer Überblick

- **UI-Stack:** Tailwind CSS + shadcn/ui (Buttons, Dialoge, Tabs, Tabellen, Form Controls)
- **Formulare:** react-hook-form + zod
- **Icons:** lucide-react
- **Realtime:** Socket.io Hooks (`@/hooks/useRealtime`)
- **Design-Tokens:** `src/design-system/tokens.json` bündelt jetzt einen parametrischen Aufbau (`parameters` mit Farbfamilien und Token-Regeln) und die daraus berechneten `modes`. Nach jeder Änderung `pnpm design-system:tokens` ausführen – das aktualisiert sowohl `src/app/design-tokens.css` als auch die aufbereiteten Tokenwerte im JSON.

## Farbpalette

Die Farbwerte liegen vollständig in OKLCH vor und werden parametriert aus Farbfamilien (Basis-Hue, Chroma, Lightness) generiert. Für helle und dunkle Modi sorgen dynamische Delta-Regeln für konsistente Kontrastabstände. Die Hex-Werte dienen zur schnellen visuellen Referenz (Swatches unter `docs/swatches`).

### Material-3-inspirierte Tonal Paletten

Ergänzend zu den bestehenden Familien stehen nun zwei vollständige Tonal-Paletten nach Flutter/Material 3 zur Verfügung. Die Stufen orientieren sich an den offiziellen Spezifikationen (`0` → `100`) und bilden die Basis für Container-, Surface- und State-Tokens.

| Palette | Tonstufe | Hex | Verwendung |
| --- | --- | --- | --- |
| Primary | `primary-10` | `#21005D` | `--primary-darkest`, Fokus-Indikatoren |
| Primary | `primary-40` | `#6750A4` | `--primary` (Light), prominente Aktionen |
| Primary | `primary-80` | `#D0BCFF` | Soft-Flächen, getönte Badges |
| Primary | `primary-90` | `#EADDFF` | `--primary-container` (Light) |
| Primary | `primary-95` | `#F6EDFF` | High-Contrast-Flächen, Hover-Staaten |
| Secondary | `secondary-10` | `#1D192B` | `--secondary-darkest`, Kontraste im Dark Mode |
| Secondary | `secondary-40` | `#625B71` | `--secondary` (Light), ergänzende Aktionen |
| Secondary | `secondary-80` | `#CCC2DC` | Sekundäre Container |
| Secondary | `secondary-90` | `#E8DEF8` | `--secondary-container` (Light) |
| Secondary | `secondary-95` | `#F6EDFF` | Tonale Hintergründe |

> **Hinweis:** Die Paletten-Werte stehen als SVG-Swatches (`docs/swatches/primary-*.svg`, `secondary-*.svg`) und JSON (`docs/swatches/palette.sample.json`) bereit und speisen `--primary-container`, `--secondary-container`, `--surface-tint` sowie die erweiterten Surface-Token.

## Parametrisches Farbsystem

Die Token-Konfiguration besteht aus zwei Ebenen:

1. **Farbfamilien (`parameters.families`)** definieren neutrale und farbige Grundwerte in OKLCH – z. B. `neutral`, `brand`, `accent`, `success`. Jede Familie besitzt pro Modus eine Ausgangs-Lightness, Chroma und Hue, was spätere Anpassungen (z. B. leicht andere Chroma-Werte im Dark-Mode) erlaubt.
2. **Semantische Tokens (`parameters.tokens`)** greifen auf diese Familien zu und modifizieren sie parametrisch (`deltaL`, `scaleC`, absolute `l`/`c`/`h`-Werte). Dadurch bleiben Abstände wie „Primärfarbe ist 0.48 Lightness heller als die neutrale Ausgangsfläche“ nachvollziehbar und können zentral verändert werden.

Der Build-Script schreibt daraus die finalen `modes` (Light/Dark) zurück ins JSON und erzeugt die CSS-Custom-Properties. Änderungen an Familienparametern wirken sich automatisch auf sämtliche abhängige Tokens aus – die Wartung reduziert sich auf wenige Kernwerte.

| Rolle | Token | Vorschau |
| --- | --- | --- |
| Primär-CTA, Fokus | `--primary` / `--primary-foreground` | <img src="swatches/primary-500.svg" width="14" height="14" /> |
| Primär-Container | `--primary-container` / `--on-primary-container` | <img src="swatches/primary-90.svg" width="14" height="14" /> |
| Primär-Soft | `primary` Soft (`Badge`, Sekundäraktionen) | <img src="swatches/primary-300.svg" width="14" height="14" /> |
| Sekundär-CTA | `--secondary` / `--secondary-foreground` | <img src="swatches/secondary-500.svg" width="14" height="14" /> |
| Sekundär-Container | `--secondary-container` / `--on-secondary-container` | <img src="swatches/secondary-90.svg" width="14" height="14" /> |
| Sekundär-Soft | `secondary` Soft-Flächen, Highlights | <img src="swatches/secondary-200.svg" width="14" height="14" /> |
| Akzent/Interaktion | `--accent` / `--accent-foreground` | <img src="swatches/accent-500.svg" width="14" height="14" /> |
| Akzent-Soft | `accent` Soft States, Pills | <img src="swatches/accent-200.svg" width="14" height="14" /> |
| Erfolg | `--success` / `--success-foreground` | <img src="swatches/success-500.svg" width="14" height="14" /> |
| Warnung | `--warning` / `--warning-foreground` | <img src="swatches/warning-500.svg" width="14" height="14" /> |
| Info | `--info` / `--info-foreground` | <img src="swatches/info-500.svg" width="14" height="14" /> |
| Destruktiv | `--destructive` / `--destructive-foreground` | <img src="swatches/destructive-500.svg" width="14" height="14" /> |
| Hintergrund dunkel | `--surface` (Dark) | <img src="swatches/neutral-900.svg" width="14" height="14" /> |
| Container dunkel | `--surface-container-high` (Dark) | <img src="swatches/neutral-700.svg" width="14" height="14" /> |
| Hintergrund hell | `--surface` (Light) | <img src="swatches/neutral-100.svg" width="14" height="14" /> |
| Container hell | `--surface-container` (Light) | <img src="swatches/neutral-200.svg" width="14" height="14" /> |

> **Kontrastprüfung:** Alle Primärfarben erfüllen ≥ 4.5:1 auf ihren Gegenstücken. Die `ring`- und `focus-visible`-Farben greifen auf `--primary` zurück.

## Typografie-Hierarchie

Die Typografie wird über Utility-Klassen (`.text-*`) und neue UI-Komponenten gesteuert. Die Basisschrift ist `var(--font-sans)`; Headings nutzen `var(--font-heading)`.

| Ebene | Utility | Verwendung | Beispiel |
| --- | --- | --- | --- |
| Display | `.text-display` | Hero Headline | `<Heading level="display">` |
| H1 | `.text-h1` | Seitentitel | `<Heading level="h1">` |
| H2 | `.text-h2` | Abschnittstitel | `<Heading level="h2">` |
| H3 | `.text-h3` | Untertitel, Feature Cards | `<Heading level="h3">` |
| H4 | `.text-h4` | Kleinere Überschriften | `<Heading level="h4">` |
| Lead | `.text-lead` | Hero-Text, Einleitungen | `<Text variant="lead">` |
| Body L | `.text-body-lg` | Größerer Fließtext | `<Text variant="bodyLg">` |
| Body | `.text-body` | Standard-Fließtext | `<Text variant="body">` |
| Body S | `.text-body-sm` | Meta-Angaben | `<Text variant="small">` |
| Caption | `.text-caption` | Labels, Legenden | `<Text variant="caption">` |
| Eyebrow | `.text-eyebrow` | Kicker, Kategorie | `<Text variant="eyebrow">` |

**Komponenten:**
- `Heading` (in `@/components/ui/typography`) kapselt Level, Tonalität (`tone`) und Ausrichtung.
- `Text` deckt Body-, Lead- und Caption-Typen ab und erlaubt `tone`, `align`, `weight` sowie das Rendern via `asChild`.

## Spacing & Grid Tokens

Die Layout-Variablen folgen einem 8pt-System, ergänzt um halbe Schritte:

- `--space-3xs`: 0.25rem (4px)
- `--space-2xs`: 0.5rem (8px)
- `--space-xs`: 0.75rem (12px)
- `--space-sm`: 1rem (16px)
- `--space-md`: 1.5rem (24px)
- `--space-lg`: 2rem (32px)
- `--space-xl`: 3rem (48px)
- `--space-2xl`: 4rem (64px)
- `--space-3xl`: 6rem (96px)

### Corner-Radii (Material 3)

Die Corner-Radii lehnen sich an die Flutter/Material-3-Defaults an und stehen als CSS-Custom-Properties bereit:

- `--corner-xs`: 0.25rem (4px) – kompakte Chips, Dividers
- `--corner-sm`: 0.5rem (8px) – Inputs, Segmented Controls
- `--corner-md`: 0.75rem (12px) – Buttons, Avatare mit Bildanteil
- `--corner-lg`: 1rem (16px) – Karten, modale Container
- `--corner-xl`: 1.75rem (28px) – „Surface“ Elemente, Bottom Sheets
- `--corner-full`: 62.5rem – Pill-/Circular-Shapes

Tailwind nutzt diese Werte über `rounded-{xs|sm|…}` automatisch; `--radius` zeigt auf `--corner-lg` für Rückwärtskompatibilität.

### Elevation & Shadow-Level

Material-3-Elevationsstufen stehen als Token (`--shadow-level-{1…5}`) bereit und entsprechen Flutter`s `Elevation`-Mapping:

| Level | Token | Einsatz |
| --- | --- | --- |
| 1 | `--shadow-level-1` | Karten, kleinere Hover-Flächen |
| 2 | `--shadow-level-2` | Primäre Filled Buttons |
| 3 | `--shadow-level-3` | Dialoge, ausgeprägte Cards |
| 4 | `--shadow-level-4` | Modal-Sheets, Overlays |
| 5 | `--shadow-level-5` | Persistente Navigation, High-Contrast-Highlights |

Tailwind stellt die Klassen `shadow-level-{n}` bereit. Zusätzlich existiert `.surface-tinted` als Utility, um `surface` + `surface-tint` kombiniert auf Karten anzuwenden.

### Motion Tokens

Die neuen Motion-Variablen folgen dem Material-3-Standard:

- `--motion-duration-short`: 150 ms (Click/Toggle)
- `--motion-duration-medium`: 250 ms (Modal, Slide)
- `--motion-duration-long`: 400 ms (Large Surfaces)
- `--motion-ease-standard`: `cubic-bezier(0.2, 0, 0, 1)` (Allround)
- `--motion-ease-decelerate`: `cubic-bezier(0.05, 0.7, 0.1, 1)` (Easing-Out)
- `--motion-ease-emphasized`: `cubic-bezier(0.2, 0, 0, 1)` kombiniert mit `--motion-duration-long` für aufmerksamkeitsstarke Übergänge

Utilities `.motion-slide` und `.motion-scale` kapseln diese Parameter für Slideover-/Sheet-Animationen und skalierende Hover-States.

Weitere Layout-Konstanten:
- `--layout-max-width`: 90rem (1440px Bühne)
- `--layout-gutter`: responsive Außenabstände (mobile 1rem → Desktop 3–4rem)
- `--header-height`: 4rem (mobile) / 5rem (≥768px)

### Layout-Container

- `.layout-container` steuert ausschließlich Breite und horizontale Außenabstände. Vertikale Polster fügst du je nach Kontext mit Tailwind-Utilities (`pt`, `pb`, `py`, `space-y` etc.) hinzu.

## Komponentenrichtlinien

### Mitgliederbereich: App Shell & Seitenaufbau

- `MembersAppShell` organisiert den Mitgliederbereich semantisch: Die Topbar sitzt oberhalb eines `main`-Containers, der konsequent in `header`, `section` und `footer` gegliedert ist. Standardmäßig greifen alle Bereiche auf die bekannten Containerbreiten (`max-w-screen-2xl`, `px-4` → `sm:px-6` → `lg:px-8`) zurück, über das optionale `contentLayout`-Prop lassen sich Breite, Innenabstände und vertikale Polster aber pro Layout variieren.
- Für Seitenspezifika steht zusätzlich die Client-Komponente `MembersContentLayout` bereit. Sie registriert geänderte `width`-, `padding`-, `spacing`- oder `gap`-Parameter beim App-Shell-Kontext und sorgt automatisch für konsistente Header-, Content- und Footer-Container. Mit `useMembersContentLayout` lassen sich die effektiven Werte auslesen, um z. B. Sektionen oder Grid-Komponenten daran auszurichten.
- Die Topbar wird über `MembersTopbar` konfiguriert und stellt Slots für Brotkrumen (`MembersTopbarBreadcrumbs`), den Seitentitel (`MembersTopbarTitle`), optionale Schnellaktionen (`MembersTopbarQuickActions`) sowie Status-Badges (`MembersTopbarStatus`) bereit. Unterhalb von `lg` erscheint der Sidebar-Trigger automatisch, auf größeren Viewports rückt an dessen Stelle der Titel.
- Seiten können ihren Header deklarativ über `MembersContentHeader` und `MembersPageActions` aufbauen. Der Bereich landet automatisch im semantischen `header` des Layouts und behält dadurch konsistente Abstände.
- Ein optionaler `MembersContentFooter` ermöglicht nachgelagerte Hinweise oder sekundäre Aktionen, die am Ende der Seite stehen sollen.
- Der Mitglieder-spezifische `PageHeader` (`@/components/members/page-header`) registriert Topbar- und Header-Inhalte automatisch, solange `variant="page"` verwendet wird. Für abschnittsweise Zwischenüberschriften kann `variant="section"` gesetzt werden – dann bleibt der Eintrag lokal im Content.

**Beispiel:**

```tsx
<MembersTopbar>
  <MembersTopbarBreadcrumbs>Mitglieder · Probenplanung</MembersTopbarBreadcrumbs>
  <MembersTopbarTitle>Probenplanung</MembersTopbarTitle>
  <MembersTopbarStatus>
    <Badge variant="info">Planung aktiv</Badge>
  </MembersTopbarStatus>
  <MembersTopbarQuickActions>
    <Button size="sm">Neue Probe</Button>
  </MembersTopbarQuickActions>
</MembersTopbar>

<MembersContentHeader>
  <PageHeader>
    <div className="space-y-1.5">
      <PageHeaderTitle>Probenplanung</PageHeaderTitle>
      <PageHeaderDescription>
        Termine anlegen, veröffentlichen und Rückmeldungen im Blick behalten.
      </PageHeaderDescription>
    </div>
  </PageHeader>
</MembersContentHeader>

{/* Hauptinhalt folgt im Section-Bereich */}
<div className="space-y-6">
  …
</div>
```

### Buttons (`@/components/ui/button`)
- **Varianten:** `primary` (alias `default`), `secondary`, `accent`, `outline`, `ghost`, `subtle`, `link`, `destructive`, `success`, `info`.
- **States:** Hover reduziert Deckkraft bzw. hebt Konturen hervor; `focus-visible` nutzt `ring` + Offset, `disabled` setzt `opacity-60` und deaktiviert Pointer Events.
- **Sizes:** `xs`–`xl` plus `icon`, alle auf das 8pt-Raster abgestimmt.
- **Icons:** Buttons besitzen standardmäßig `inline-flex` + `gap-2`. Platziere führende oder nachgestellte Icons direkt in der Button-Children-Hierarchie (z. B. `<Sparkles className="h-4 w-4" aria-hidden />`). Auf XS-Screens dürfen Labels zugunsten eines Icons mit `sr-only sm:not-sr-only` ausgeblendet werden, solange ein `title` oder das Screenreader-Label erhalten bleibt.
- **Utilities:** `.btn-filled` und `.btn-outlined` bündeln Motion (`--motion-duration-*`) und Elevation (`shadow-level-2/3`). Farbvarianten setzen via `.btn-tone-*` (`primary`, `secondary`, `accent`, `success`, `info`, `destructive`) ihre Tokens und ermöglichen konsistente Container-/Label-Kontraste.

### Symbolsprache & Icon-Buttons

- **Quelle:** Alle Icons stammen aus `lucide-react`. Nutze `import type { LucideIcon }` für konfigurierbare Icon-Props.
- **Größen:** In Buttons `size="sm"` bis `"lg"` funktionieren Icons mit `className="h-4 w-4"`. Für `size="xl"` darf `h-5 w-5` verwendet werden.
- **Textersatz:** Für kompakte Quick-Actions oder Toolbars sind reine Icon-Buttons erlaubt (`size="icon"`). Kombiniere Icon + `span.sr-only`, um den Text nur für Screenreader bereitzustellen.
- **Responsives Labeling:** Möchtest du Labels ab einer bestimmten Breite wiedergeben, nutze `className="sr-only sm:not-sr-only"` für den Text und vergib zusätzlich `title="…"` am Button/Link.
- **Abstände:** Bei Buttons mit Icon und Text kein zusätzliches Padding setzen – die Komponenten bringen bereits konsistente `gap`- und Paddingwerte mit. Für Sonderfälle kann ein Wrapper-`span` die Reihenfolge oder Animationen steuern.
- **Beispiel:**

```tsx
import { Button } from "@/components/ui/button";
import { CalendarCog } from "lucide-react";

<Button variant="outline" size="sm" title="Probenplanung öffnen">
  <CalendarCog aria-hidden className="h-4 w-4" />
  <span className="sr-only sm:not-sr-only">Probenplanung</span>
</Button>;
```

### TextLink (`@/components/ui/text-link`)
- Variants: `default` (primär), `subtle`, `muted`, `ghost`, `accent`, `button`.
- Unterstützt `weight` (`medium`/`semibold`), `asChild` (Integration mit `next/link`) und `disabled` (setzt `aria-disabled`, entfernt Tab-Fokus).
- Fokusring via `ring`-Token, Underline-Offset standardisiert.

### Badges (`@/components/ui/badge`)
- Neue tönungsbasierte Varianten (`default`, `secondary`, `accent`, `muted`, `success`, `warning`, `info`, `destructive`, `outline`, `ghost`) + Größen `sm`, `md`, `lg`.
- Standardmäßig pill-förmig (`rounded-full`) mit getönten Hintergründen; Outline-Variante erzeugt Hover-Hervorhebung.
- SVG-Icons skalieren automatisch (`[&>svg]:size-3`).

## Utility-Übersicht

Die neuen Utilities werden in `src/app/globals.css` gepflegt und können auch direkt in Tailwind-Klassen genutzt werden:

- `.text-display`, `.text-h1` … `.text-eyebrow`
- `.text-body`, `.text-body-lg`, `.text-body-sm`, `.text-caption`
- `--font-body`, `--font-heading`, `--font-display` für zukünftige Schriftwechsel
- `.btn-filled`, `.btn-outlined`, `.btn-tone-*`
- `.surface-tinted`, `.motion-slide`, `.motion-scale`

## Pflege & Workflow

1. Tokens bearbeiten (`src/design-system/tokens.json`), anschließend `pnpm design-system:tokens` ausführen.
2. Farbänderungen in `docs/swatches/palette.sample.json` pflegen und per `pnpm swatches:gen` aktualisieren.
3. Typografie/Spacing-Anpassungen in `src/app/globals.css` dokumentieren und in diesem Leitfaden vermerken.
4. Für UI-Komponenten Beispiele in Storybook/Playground ergänzen (falls vorhanden) und die Varianten in Commit-Messages erwähnen.

## Mitglieder-App UX

### Heuristik- & Geräteanalyse

- **Layout-Konsistenz über Varianten:** `MembersAppShell` bündelt Containerbreite, Innenabstände und vertikale Rhythmik über `membersContent*`-Varianten. Die gleiche Konfiguration speist `header`, `section` und `footer`, wodurch Seiten unabhängig von Content-Overrides gleichmäßig bleiben.【F:src/components/members/members-app-shell.tsx†L23-L175】【F:src/components/members/members-app-shell.tsx†L462-L488】
- **Kontext für Seitenslots:** Die Shell stellt dedizierte Setter für Topbar, Content-Header/-Footer und Layout-Overrides bereit. Kinder-Komponenten registrieren ihre Slots darüber, ohne die Shell mehrfach zu rendern – das reduziert visuelle Sprünge beim Navigieren.【F:src/components/members/members-app-shell.tsx†L207-L555】
- **Device-adaptive Topbar:** Quick Actions, Status und Heim-Link reagieren auf `useSidebar().isMobile`: Desktop bündelt alles rechts, Mobile wickelt Aktionen um und zeigt Status separat, um Touch-Ziele zu entflechten.【F:src/components/members/members-app-shell.tsx†L248-L345】
- **Globale Container-Utilities:** `globals.css` definiert `members-container`-Breiten und Padding-Stufen mit CSS-Custom-Properties. Breakpoints bei `640px` und `1024px` erhöhen die Innenabstände graduell, wodurch Content auf großen Flächen luftiger wirkt.【F:src/app/globals.css†L151-L226】
- **Viewport-Schutzschichten:** Die Shell setzt konsequent auf `min-height: svh/dvh`, sodass auch iOS-Browser mit dynamischen Toolbars ganzseitige Layouts ohne Scroll-Jumps liefern.【F:src/app/globals.css†L130-L149】

### Pain Points nach Endgerät

| Endgerät | Pain Points | Heuristik | Wirkung | Empfehlung |
| --- | --- | --- | --- | --- |
| Desktop ≥1440px | `members-container--width-2xl` deckelt den Content auf 96rem, während `--layout-gutter` ab 1440px auf bis zu 4rem steigt. Extrem breite Tabellen laufen so in sehr langen Zeilen, was die Scanbarkeit mindert.【F:src/app/globals.css†L151-L206】 | Wahrnehmbarkeit & Lesbarkeit | Nutzer scrollen horizontal in Data-Grids oder exportieren Daten, statt sie vor Ort auszuwerten. | Zusätzliche `--width-xl`-Variante mit härterem Cap (z. B. 80rem) für Tabellen-Layouts und alternative Split-Views evaluieren. |
| Tablet quer | Die Topbar reduziert ihre Höhe bei eingeklappter Sidebar auf 48px (`group-has-data`-Klasse), Breadcrumbs behalten aber 12px Uppercase-Typo. Bei mittlerer Icon-Dichte kollidieren Icons/Texte und die berührbare Fläche sinkt.【F:src/components/members/members-app-shell.tsx†L297-L334】 | Konsistentes Mapping zwischen System und Realität | Bedienfehler durch eng stehende Aktionen; Quick Actions werden weniger genutzt. | Breakpoint-spezifisch größere `gap`-Werte setzen und Breadcrumbs auf Satzschrift (Text-xs normal) umstellen. |
| Smartphone <768px | Der Heim-Button erzwingt `whitespace-nowrap` und bleibt immer sichtbar. Bei mehr als zwei Quick Actions entsteht ein zweizeiliges Cluster, das wichtige Status-Badges unter den Fold schiebt.【F:src/components/members/members-app-shell.tsx†L272-L344】 | Sichtbarkeit von Systemstatus | Nutzer übersehen Statusmeldungen (z. B. Sperrlisten-Hinweise) und benötigen zusätzliche Klicks. | Home-Link ab Sticky-Scroll in das Overflow-Menü verschieben und Status-Badges im ersten Flex-Item priorisieren. |
| Smartphone Navigation | `SidebarMobileAutoClose` schließt das Sheet nach jedem Navigationswechsel. Multi-Step-Aufgaben (z. B. mehrere Mitgliederprofile öffnen) benötigen dadurch wiederholtes Öffnen.【F:src/components/members/members-app-shell.tsx†L231-L243】 | Nutzerkontrolle & Freiheit | Flow wird fragmentiert, besonders bei Inventar- oder Rollenpflege. | Persistente „Zuletzt besucht“-Sektion oder optionales „Dock offen lassen“-Toggle ergänzen. |

### Informationsarchitektur & Sitemap

Die priorisierte Sitemap liegt als FigJam-Board **„Mitglieder IA v0.3“** vor (Team-Workspace Figma). Die folgende Übersicht spiegelt die Inhalte der Mappe inklusive Business-Zielen und Nutzungshäufigkeit wider.【3f783d†L1-L44】

#### P0 – Tägliche Journeys

| Route | Beschreibung | Business-Ziel | Nutzung |
| --- | --- | --- | --- |
| `/mitglieder` | Einstieg in das Dashboard (Alias zum gleichen Content wie `/mitglieder/dashboard`). | Lagebild & Aufgabenfokus bereitstellen, um Koordination zu beschleunigen. | Täglich |
| `/mitglieder/dashboard` | KPI- und Aufgaben-Hub des Mitgliederbereichs. | Performance- und Aufgabenmonitoring zentralisieren. | Täglich |
| `/mitglieder/meine-gewerke` | Persönliche Gewerke-Übersicht inkl. Verantwortlichkeiten. | Verantwortung klären, Ownership stärken. | Täglich |
| `/mitglieder/meine-gewerke/todos` | Verdichtete To-Do-Liste je Gewerk. | Aufgabenabarbeitung beschleunigen. | Täglich |
| `/mitglieder/meine-gewerke/[slug]` | Detail-Stack für ein spezifisches Gewerk. | Tiefere Kontextdaten zur Verfügung stellen. | Täglich |
| `/mitglieder/meine-proben` | Eigener Probenkalender inkl. Feedback-Status. | Teilnahmequoten sichern, Verfügbarkeiten pflegen. | Täglich |
| `/mitglieder/proben/[rehearsalId]` | Detailansicht einer Probe mit Rollen & Aufgaben. | Vorbereitung verbessern, No-Shows reduzieren. | Täglich |
| `/mitglieder/probenplanung` | Zentrale Planung laufender Proben. | Ressourcen- & Raumplanung koordinieren. | Täglich |
| `/mitglieder/probenplanung/proben/[rehearsalId]` | Planungs-Stack einer konkreten Probe. | Änderungen schnell kommunizieren. | Täglich |
| `/mitglieder/kalender` | Monats-/Wochenkalender aller Produktionen. | Terminkonflikte transparent machen. | Täglich |
| `/mitglieder/produktionen` | Listenansicht aktiver Produktionen. | Fortschritt der Spielzeit steuern. | Täglich |
| `/mitglieder/produktionen/besetzung` | Casting/Ensemble-Matrix pro Produktion. | Rollenbesetzungen abstimmen. | Täglich |
| `/mitglieder/produktionen/gewerke` | Cross-Gewerk-Status der laufenden Shows. | Schnittstellen synchronisieren. | Täglich |
| `/mitglieder/produktionen/gewerke/[departmentId]` | Detailstack eines Gewerks innerhalb einer Produktion. | Risiken früh erkennen und mitigieren. | Täglich |
| `/mitglieder/produktionen/szenen` | Szenenlisten & Ablaufplanung pro Show. | Probenabläufe choreografieren. | Täglich |
| `/mitglieder/produktionen/[showId]` | Produktions-Hauptseite mit Kennzahlen. | Gesamtstatus und KPIs bündeln. | Täglich |

#### P1 – Wöchentliche Journeys

| Route | Beschreibung | Business-Ziel | Nutzung |
| --- | --- | --- | --- |
| `/mitglieder/endproben-woche` | Drehkreuz für Endprobenphase. | Finale Woche reibungslos orchestrieren. | Wöchentlich |
| `/mitglieder/endproben-woche/menueplan` | Menüplanung für die Crew. | Versorgungssicherheit schaffen. | Wöchentlich |
| `/mitglieder/endproben-woche/essenplanung` | Ernährungs- und Allergiemanagement. | Gesundheit der Crew schützen. | Wöchentlich |
| `/mitglieder/endproben-woche/einkaufsliste` | Einkaufslisten für das Versorgungsteam. | Beschaffung bündeln. | Wöchentlich |
| `/mitglieder/endproben-woche/dienstplan` | Dienst- und Helferpläne. | Schichten koordinieren. | Wöchentlich |
| `/mitglieder/dateisystem` | Filesystem-Root mit Produktionsdokumenten. | Wissensspeicher konsolidieren. | Wöchentlich |
| `/mitglieder/dateisystem/[folderId]` | Unterordner-Ansicht inkl. Freigaben. | Gezielt Assets finden. | Wöchentlich |
| `/mitglieder/inventar-aufkleber` | Generierung/Verwaltung von Inventarlabels. | Inventarisierung beschleunigen. | Wöchentlich |
| `/mitglieder/inventar/[code]` | Einzelnes Inventargut via Code. | Geräteverfolgung absichern. | Wöchentlich |
| `/mitglieder/lagerverwaltung/kostueme` | Kostüm-Lagerflächen & Ausgaben. | Kostümturnover kontrollieren. | Wöchentlich |
| `/mitglieder/lagerverwaltung/technik` | Techniklager-Übersicht. | Verfügbarkeiten transparent machen. | Wöchentlich |
| `/mitglieder/fotoerlaubnisse` | Verwaltung unterschriebener Foto-Freigaben. | Rechtssicherheit gewährleisten. | Wöchentlich |
| `/mitglieder/sperrliste` | Verwaltung von Sperrzeiten & Blockern. | Ressourcenplanung stabil halten. | Wöchentlich |
| `/mitglieder/finanzen/[[...section]]` | Finanzübersichten (Budget, Ausgaben, Forecast). | Budgettreue überwachen. | Wöchentlich |
| `/mitglieder/rollenverwaltung` | Rollen- und Zugriffsmanagement. | Berechtigungen aktuell halten. | Wöchentlich |
| `/mitglieder/rechte` | Überblick über Berechtigungs-Policies. | Compliance dokumentieren. | Wöchentlich |
| `/mitglieder/essenplanung` | Generelle Essenskoordination (außerhalb Endproben). | Versorgung sicherstellen. | Wöchentlich |

#### P2 – Monatliche oder Ad-hoc Journeys

| Route | Beschreibung | Business-Ziel | Nutzung |
| --- | --- | --- | --- |
| `/mitglieder/onboarding` | Leitfaden & Tasks für neue Mitglieder. | Ramp-up-Zeit senken. | Ad-hoc |
| `/mitglieder/profil` | Persönliche Daten & Einstellungen. | Stammdaten aktuell halten. | Monatlich |
| `/mitglieder/mitgliederverwaltung` | Übersicht aller Mitglieder. | Personalplanung koordinieren. | Monatlich |
| `/mitglieder/mitgliederverwaltung/[userId]` | Detailpflege eines Mitglieds. | Datenqualität sichern. | Monatlich |
| `/mitglieder/koerpermasse` | Körpermaß-Archiv für Kostüme. | Passformen optimieren. | Monatlich |
| `/mitglieder/issues` | Bug-/Task-Tracker intern. | Transparente Fehlerkultur fördern. | Ad-hoc |
| `/mitglieder/issues/[issueId]` | Detail eines Tickets. | Problembehebung dokumentieren. | Ad-hoc |
| `/mitglieder/archiv-und-bilder` | Medienarchiv Übersicht. | Wissensmanagement pflegen. | Monatlich |
| `/mitglieder/archiv-und-bilder/[year]` | Jahresarchiv. | Historie auffindbar halten. | Monatlich |
| `/mitglieder/mystery/tipps` | Gamification-/Rätselhilfe. | Engagement erhöhen. | Ad-hoc |
| `/mitglieder/server-analytics` | Monitoring der Infrastruktur. | Verfügbarkeit sichern. | Monatlich |
| `/mitglieder/website` | Verwaltung der öffentlichen Website-Inhalte. | Außenkommunikation steuern. | Monatlich |
| `/mitglieder/scan` | QR-/Barcode-Scan-Utility. | Medienbrüche reduzieren. | Ad-hoc |

### Navigations- & Zustandsregeln (Flutter-inspiriertes Modell)

Wir orientieren die Informationsarchitektur am Flutter-Paradigma „Home + Tabs/Stacks“:

1. **Home-Stack:** `/mitglieder` fungiert als Root-Stack, der das Dashboard rendert. Navigationszustand bleibt bestehen, solange der Nutzer innerhalb des Home-Tabs bleibt (kein Hard-Refresh nötig).【F:src/components/members/members-app-shell.tsx†L438-L493】
2. **Tab-Leisten = Sidebar-Gruppen:** Jede Hauptsektion (z. B. Produktionen, Meine Aufgaben, Ressourcen, Verwaltung) entspricht einem Tab. Der Sidebar-State ersetzt den Flutter-`BottomNavigationBar` und bleibt zwischen Tabs persistent, solange `Sidebar` nicht kollabiert.【F:src/components/members/members-app-shell.tsx†L440-L449】
3. **Stacks pro Tab:** Detailseiten (z. B. `/mitglieder/proben/[rehearsalId]`, `/mitglieder/produktionen/[showId]`) werden als neue Ebenen im jeweiligen Tab-Stack betrachtet. Zurücknavigation erfolgt über die Topbar oder Browser-Historie, ohne den Tab zu wechseln.【F:src/components/members/members-app-shell.tsx†L248-L345】
4. **Cross-Stack Deep Links:** Querlinks zwischen Tabs pushen neue Stacks, behalten aber den Ursprungstab im Sidebar-State, um mentale Modelle nicht zu brechen. Der Shell-Kontext sorgt dafür, dass Topbar/Breadcrumbs sofort aktualisieren.【F:src/components/members/members-app-shell.tsx†L207-L555】
5. **State Persistence:** Layout-Overrides (`MembersContentLayout`) und Slot-Inhalte werden beim Unmount bereinigt. Tabs sollten daher ihre Einstellungen beim Mount erneut registrieren – analog zu Flutter, wo jedes Tab einen eigenen Navigator besitzt.【F:src/components/members/members-app-shell.tsx†L366-L488】
6. **Responsive Behavior:** Auf Mobilgeräten wird der Sidebar-Tab-Selector als modales Sheet gehandhabt; Closing-on-Navigation spiegelt Flutter’s default `Navigator.pop()` nach Push wider, benötigt aber optional eine Setting, um Multi-Step-Flows zu unterstützen.【F:src/components/members/members-app-shell.tsx†L231-L344】

Diese Regeln bilden die Grundlage für komponentenseitige Navigation-Guards, Breadcrumb-Generierung und Priorisierung innerhalb des FigJam-Sitemaps.
