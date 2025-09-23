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

## Parametrisches Farbsystem

Die Token-Konfiguration besteht aus zwei Ebenen:

1. **Farbfamilien (`parameters.families`)** definieren neutrale und farbige Grundwerte in OKLCH – z. B. `neutral`, `brand`, `accent`, `success`. Jede Familie besitzt pro Modus eine Ausgangs-Lightness, Chroma und Hue, was spätere Anpassungen (z. B. leicht andere Chroma-Werte im Dark-Mode) erlaubt.
2. **Semantische Tokens (`parameters.tokens`)** greifen auf diese Familien zu und modifizieren sie parametrisch (`deltaL`, `scaleC`, absolute `l`/`c`/`h`-Werte). Dadurch bleiben Abstände wie „Primärfarbe ist 0.48 Lightness heller als die neutrale Ausgangsfläche“ nachvollziehbar und können zentral verändert werden.

Der Build-Script schreibt daraus die finalen `modes` (Light/Dark) zurück ins JSON und erzeugt die CSS-Custom-Properties. Änderungen an Familienparametern wirken sich automatisch auf sämtliche abhängige Tokens aus – die Wartung reduziert sich auf wenige Kernwerte.

| Rolle | Token | Vorschau |
| --- | --- | --- |
| Primär-CTA, Fokus | `--primary` / `--primary-foreground` | <img src="swatches/primary-500.svg" width="14" height="14" /> |
| Primär-Soft | `primary` Soft (`Badge`, Sekundäraktionen) | <img src="swatches/primary-300.svg" width="14" height="14" /> |
| Sekundär-CTA | `--secondary` / `--secondary-foreground` | <img src="swatches/secondary-500.svg" width="14" height="14" /> |
| Sekundär-Soft | `secondary` Soft-Flächen, Highlights | <img src="swatches/secondary-200.svg" width="14" height="14" /> |
| Akzent/Interaktion | `--accent` / `--accent-foreground` | <img src="swatches/accent-500.svg" width="14" height="14" /> |
| Akzent-Soft | `accent` Soft States, Pills | <img src="swatches/accent-200.svg" width="14" height="14" /> |
| Erfolg | `--success` / `--success-foreground` | <img src="swatches/success-500.svg" width="14" height="14" /> |
| Warnung | `--warning` / `--warning-foreground` | <img src="swatches/warning-500.svg" width="14" height="14" /> |
| Info | `--info` / `--info-foreground` | <img src="swatches/info-500.svg" width="14" height="14" /> |
| Destruktiv | `--destructive` / `--destructive-foreground` | <img src="swatches/destructive-500.svg" width="14" height="14" /> |
| Hintergrund dunkel | `--background` (Dark) | <img src="swatches/neutral-900.svg" width="14" height="14" /> |
| Sekundärflächen dunkel | `--muted` (Dark) | <img src="swatches/neutral-700.svg" width="14" height="14" /> |
| Hintergrund hell | `--background` (Light) | <img src="swatches/neutral-100.svg" width="14" height="14" /> |
| Rahmen/Flächen hell | `--border` & `--muted` (Light) | <img src="swatches/neutral-200.svg" width="14" height="14" /> |

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

Weitere Layout-Konstanten:
- `--layout-max-width`: 90rem (1440px Bühne)
- `--layout-gutter`: responsive Außenabstände (mobile 1rem → Desktop 3–4rem)
- `--header-height`: 4rem (mobile) / 5rem (≥768px)

## Komponentenrichtlinien

### Mitgliederbereich: App Shell & Seitenaufbau

- `MembersAppShell` organisiert den Mitgliederbereich nun semantisch: Die Topbar sitzt oberhalb eines `main`-Containers, der konsequent in `header`, `section` und `footer` gegliedert ist. Alle Bereiche nutzen weiterhin die etablierten Containerbreiten (`max-w-screen-2xl`, `px-4` → `sm:px-6` → `lg:px-8`).
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

## Pflege & Workflow

1. Tokens bearbeiten (`src/design-system/tokens.json`), anschließend `pnpm design-system:tokens` ausführen.
2. Farbänderungen in `docs/swatches/palette.sample.json` pflegen und per `pnpm swatches:gen` aktualisieren.
3. Typografie/Spacing-Anpassungen in `src/app/globals.css` dokumentieren und in diesem Leitfaden vermerken.
4. Für UI-Komponenten Beispiele in Storybook/Playground ergänzen (falls vorhanden) und die Varianten in Commit-Messages erwähnen.
