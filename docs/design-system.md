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

| Rolle                  | Token                                        | Vorschau                                                          |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| Primär-CTA, Fokus      | `--primary` / `--primary-foreground`         | <img src="swatches/primary-500.svg" width="14" height="14" />     |
| Primär-Soft            | `primary` Soft (`Badge`, Sekundäraktionen)   | <img src="swatches/primary-300.svg" width="14" height="14" />     |
| Sekundär-CTA           | `--secondary` / `--secondary-foreground`     | <img src="swatches/secondary-500.svg" width="14" height="14" />   |
| Sekundär-Soft          | `secondary` Soft-Flächen, Highlights         | <img src="swatches/secondary-200.svg" width="14" height="14" />   |
| Akzent/Interaktion     | `--accent` / `--accent-foreground`           | <img src="swatches/accent-500.svg" width="14" height="14" />      |
| Akzent-Soft            | `accent` Soft States, Pills                  | <img src="swatches/accent-200.svg" width="14" height="14" />      |
| Erfolg                 | `--success` / `--success-foreground`         | <img src="swatches/success-500.svg" width="14" height="14" />     |
| Warnung                | `--warning` / `--warning-foreground`         | <img src="swatches/warning-500.svg" width="14" height="14" />     |
| Info                   | `--info` / `--info-foreground`               | <img src="swatches/info-500.svg" width="14" height="14" />        |
| Destruktiv             | `--destructive` / `--destructive-foreground` | <img src="swatches/destructive-500.svg" width="14" height="14" /> |
| Hintergrund dunkel     | `--background` (Dark)                        | <img src="swatches/neutral-900.svg" width="14" height="14" />     |
| Sekundärflächen dunkel | `--muted` (Dark)                             | <img src="swatches/neutral-700.svg" width="14" height="14" />     |
| Hintergrund hell       | `--background` (Light)                       | <img src="swatches/neutral-100.svg" width="14" height="14" />     |
| Rahmen/Flächen hell    | `--border` & `--muted` (Light)               | <img src="swatches/neutral-200.svg" width="14" height="14" />     |

> **Kontrastprüfung:** Alle Primärfarben erfüllen ≥ 4.5:1 auf ihren Gegenstücken. Die `ring`- und `focus-visible`-Farben greifen auf `--primary` zurück.

## Typografie-Hierarchie

Die Typografie wird über Utility-Klassen (`.text-*`) und neue UI-Komponenten gesteuert. Die Basisschrift ist `var(--font-sans)`; Headings nutzen `var(--font-heading)`.

| Ebene   | Utility         | Verwendung                | Beispiel                    |
| ------- | --------------- | ------------------------- | --------------------------- |
| Display | `.text-display` | Hero Headline             | `<Heading level="display">` |
| H1      | `.text-h1`      | Seitentitel               | `<Heading level="h1">`      |
| H2      | `.text-h2`      | Abschnittstitel           | `<Heading level="h2">`      |
| H3      | `.text-h3`      | Untertitel, Feature Cards | `<Heading level="h3">`      |
| H4      | `.text-h4`      | Kleinere Überschriften    | `<Heading level="h4">`      |
| Lead    | `.text-lead`    | Hero-Text, Einleitungen   | `<Text variant="lead">`     |
| Body L  | `.text-body-lg` | Größerer Fließtext        | `<Text variant="bodyLg">`   |
| Body    | `.text-body`    | Standard-Fließtext        | `<Text variant="body">`     |
| Body S  | `.text-body-sm` | Meta-Angaben              | `<Text variant="small">`    |
| Caption | `.text-caption` | Labels, Legenden          | `<Text variant="caption">`  |
| Eyebrow | `.text-eyebrow` | Kicker, Kategorie         | `<Text variant="eyebrow">`  |

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

### Layout-Container

- `.layout-container` steuert ausschließlich Breite und horizontale Außenabstände. Vertikale Polster fügst du je nach Kontext mit Tailwind-Utilities (`pt`, `pb`, `py`, `space-y` etc.) hinzu.

### Mitgliederbereich: Container-System

Der Mitgliederbereich nutzt ein spezialisiertes Container-System, das in `globals.css` als `.members-container` definiert ist:

**CSS-Klassen:**

- `.members-container` - Basis-Container mit CSS-Custom-Properties
- `.members-container--width-{sm,md,lg,xl,2xl,full}` - Breiten-Varianten:
  - `sm`: 40rem (640px)
  - `md`: 48rem (768px)
  - `lg`: 64rem (1024px)
  - `xl`: 80rem (1280px)
  - `2xl`: 96rem (1536px) - **Standard**
  - `full`: 100% der Viewport-Breite
- `.members-container--padding-{none,compact,default,relaxed}` - Padding-Varianten:
  - `none`: 0
  - `compact`: 0.75rem → 1rem (≥640px)
  - `default`: `var(--layout-gutter)` - **Standard** (responsive 1rem → 4rem)
  - `relaxed`: 1.5rem → 2rem (≥640px)

**React-Komponenten:**

- `<MembersContentLayout width="xl" padding="compact" spacing="comfortable" gap="md" />` - Registriert Layout-Präferenzen im App-Shell-Kontext
- `useMembersContentLayout()` - Hook zum Auslesen der effektiven Layout-Werte

**⚠️ WICHTIG - Häufiger Fehler:**
`MembersAppShell` rendert Content automatisch in einem Container mit default-Werten:

- Width: `2xl` (96rem)
- Padding: `default` (`var(--layout-gutter)`)
- Spacing: `comfortable` (`py-6 sm:py-8`)
- Gap: `md` (`space-y-6`)

**❌ NICHT tun:**

```tsx
// FALSCH - doppeltes Padding!
<div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">
  <PageHeader />
  <Content />
</div>
```

**✅ Richtig:**

```tsx
// Korrekt - MembersAppShell kümmert sich um Container
<>
  <PageHeader />
  <Content />
</>

// Oder mit Custom Layout:
<>
  <MembersContentLayout width="full" padding="compact" />
  <PageHeader />
  <Content />
</>
```

**Status Quo (Stand: Oktober 2025):**
Von ~94 Seiten im Mitgliederbereich nutzen nur 3 explizit `<MembersContentLayout>`:

- `inventar-aufkleber`: `width="full" padding="compact"`
- `scan`: `width="xl" padding="compact"`
- `finanzen`: Custom Layout-Config

Die meisten Seiten verwenden korrekt nur `<div className="space-y-6">` ohne eigene Container/Padding-Definitionen.

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

## Dark Mode & Design Token Verwendung

### Semantische Farb-Tokens statt Hard-coded Werte

**❌ Vermeide hard-coded Farben:**

```tsx
// FALSCH - funktioniert nicht im Dark Mode
<div className="bg-white border-slate-200 text-slate-900">
<div className="bg-slate-50 text-slate-600">
<span className="text-gray-500">
```

**✅ Nutze semantische Design-Tokens:**

```tsx
// KORREKT - passt sich automatisch an Light/Dark Mode an
<div className="bg-card border-border text-card-foreground">
<div className="bg-muted text-muted-foreground">
<span className="text-muted-foreground">
```

### Farb-Token Mapping

| Hard-coded (❌)    | Design Token (✅)              | Verwendung               |
| ------------------ | ------------------------------ | ------------------------ |
| `bg-white`         | `bg-card` oder `bg-background` | Karten, Panels           |
| `bg-slate-50`      | `bg-muted`                     | Sekundäre Flächen        |
| `bg-slate-100`     | `bg-muted/40`                  | Hover-States, Highlights |
| `border-slate-200` | `border-border`                | Standard-Rahmen          |
| `border-slate-300` | `border-border/60`             | Subtilere Rahmen         |
| `text-slate-900`   | `text-foreground`              | Haupttext                |
| `text-slate-700`   | `text-foreground`              | Sekundärtext             |
| `text-slate-600`   | `text-muted-foreground`        | Meta-Informationen       |
| `text-slate-500`   | `text-muted-foreground`        | Labels, Platzhalter      |
| `text-slate-400`   | `text-muted-foreground/60`     | Deaktivierte Elemente    |

| Hard-coded Status (❌)              | Design Token (✅)             | Verwendung              |
| ----------------------------------- | ----------------------------- | ----------------------- |
| `text-red-600`                      | `text-destructive`            | Fehlermeldungen         |
| `bg-red-500` / `bg-rose-500`        | `bg-destructive`              | Fehler, gesperrt        |
| `bg-emerald-500` / `text-emerald-*` | `bg-success` / `text-success` | Erfolg, aktiv           |
| `bg-amber-500` / `text-amber-*`     | `bg-warning` / `text-warning` | Ausstehend, Hinweis     |
| `bg-orange-500`                     | `bg-warning`                  | Warnung                 |
| `bg-sky-500` / `bg-indigo-500`      | `bg-info`                     | Info, neutraler Hinweis |

### Status-Farben

Für Status-Indikatoren nutze die semantischen Tokens statt direkter Farbnamen:

```tsx
// ✅ Erfolg
<Badge variant="success">Erfolgreich</Badge>
<div className="bg-success/15 text-success border-success/40">

// ✅ Warnung
<Badge variant="warning">Achtung</Badge>
<div className="bg-warning/15 text-warning border-warning/40">

// ✅ Fehler
<Badge variant="destructive">Fehler</Badge>
<div className="bg-destructive/15 text-destructive border-destructive/40">

// ✅ Info
<Badge variant="info">Information</Badge>
<div className="bg-info/15 text-info border-info/40">
```

**Hinweisboxen** nutzen die abgeschwächte Form mit `-foreground`-Text:

```tsx
// Erfolg
<div className="border-success/40 bg-success/10 text-success-foreground rounded-lg p-4">
// Warnung
<div className="border-warning/50 bg-warning/10 text-warning-foreground rounded-lg p-4">
// Fehler
<div className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg p-4">
```

### Kategorie- und Identitätsfarben

Rollen, Gewerke und Interessen besitzen bewusst feste Identitätsfarben, die sich nicht über die
Status-Tokens abbilden lassen. Diese Farben werden **ausschließlich zentral** in
`src/config/category-colors.ts` gepflegt:

- `FOCUS_BADGE_STYLES` – Onboarding-Fokus (Schauspiel / Gewerke / beides)
- `FOCUS_ACCENT_STYLES` – Verlaufs-Akzente für Fokus-Karten
- `INTEREST_CLUSTER_STYLES` – Interessen-Cluster der Wortwolken-Auswertung
- `RANKING_ROLE_STYLES` – Ranking-Rollen (Schauspiel- und Crew-Untergruppen)

Komponenten importieren diese Maps, statt Farben lokal zu definieren. Neue Kategorie-Farben gehören
ausschließlich in diese Datei. Sobald das Design-System eigene Kategorie-Tokens besitzt, werden die
Zuordnungen dort auf Tokens umgestellt.

### CSS-Override-Strategie für Legacy-Komponenten

Für bestehende Komponenten mit vielen hard-coded Farben (z.B. Sperrlistenübersicht) kann eine CSS-Override-Strategie verwendet werden:

**Beispiel: `sperrliste-styles.css`**

```css
@layer components {
  .sperrlisten-overview {
    color-scheme: light dark;
  }

  /* Map hard-coded Tailwind classes to design tokens */
  .sperrlisten-overview .bg-white,
  .sperrlisten-overview .bg-white\/80 {
    background-color: hsl(var(--card)) !important;
  }

  .sperrlisten-overview .bg-slate-50,
  .sperrlisten-overview .bg-slate-100 {
    background-color: hsl(var(--muted) / 0.4) !important;
  }

  .sperrlisten-overview .border-slate-200,
  .sperrlisten-overview .border-slate-300 {
    border-color: hsl(var(--border) / 0.6) !important;
  }

  .sperrlisten-overview .text-slate-900,
  .sperrlisten-overview .text-slate-800 {
    color: hsl(var(--foreground)) !important;
  }

  .sperrlisten-overview .text-slate-600,
  .sperrlisten-overview .text-slate-500 {
    color: hsl(var(--muted-foreground)) !important;
  }
}
```

**Verwendung:**

```tsx
// Wrapper mit CSS-Klasse für Overrides
<div className="sperrlisten-overview">
  {/* Alle child-Elemente mit hard-coded Farben werden automatisch gemappt */}
  <div className="bg-white border-slate-200 text-slate-900">Content</div>
</div>
```

**⚠️ Hinweis:** Diese Strategie sollte nur für Legacy-Code verwendet werden. Neue Komponenten sollten von Anfang an Design-Tokens verwenden.

## Best Practices: Neue Seiten im Mitgliederbereich

### 1. Grundstruktur

```tsx
import { PageHeader } from "@/components/members/page-header";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

export default async function MeineSeitePage() {
  // Data Fetching
  const data = await fetchData();

  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/meine-seite")];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seitentitel"
        description="Kurze Beschreibung der Seite"
        breadcrumbs={breadcrumbs}
      />

      {/* Content */}
      <section className="space-y-4">{/* Komponenten */}</section>
    </div>
  );
}
```

### 2. Custom Layout (optional)

Falls eine Seite eine andere Container-Breite oder Paddings benötigt:

```tsx
import { MembersContentLayout } from "@/components/members/members-app-shell";

export default function BrEiteSeite() {
  return (
    <>
      {/* Layout-Config registrieren */}
      <MembersContentLayout width="full" padding="compact" />

      <div className="space-y-6">
        <PageHeader title="Breite Ansicht" />
        {/* Content */}
      </div>
    </>
  );
}
```

### 3. Typische Fehler vermeiden

**❌ NICHT:**

- Eigene Container mit `mx-auto` erstellen
- Eigene Paddings mit `px-*` hinzufügen
- Hard-coded Farben (`bg-white`, `text-slate-*`) verwenden
- Direkt `<main>` oder `<article>` Tags nutzen (MembersAppShell macht das)

**✅ STATTDESSEN:**

- Nur `space-y-*` für vertikalen Abstand verwenden
- Design-Tokens (`bg-card`, `text-foreground`) nutzen
- MembersAppShell das Layout überlassen
- Bei Bedarf `<MembersContentLayout>` für Anpassungen

### 4. Komponenten-Patterns

```tsx
// Card mit korrekten Design-Tokens
<Card className="border-border/60 bg-card shadow-sm">
  <CardHeader>
    <CardTitle className="text-foreground">Titel</CardTitle>
    <CardDescription className="text-muted-foreground">
      Beschreibung
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>

// Badge mit Varianten
<Badge variant="info">Status</Badge>
<Badge variant="success">Erfolgreich</Badge>
<Badge variant="muted">Neutral</Badge>

// Button mit Icons
<Button variant="outline" size="sm">
  <CalendarIcon className="h-4 w-4" aria-hidden />
  <span>Kalender</span>
</Button>
```

### 5. Responsive Design

```tsx
// Mobile-first approach
<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
  <div className="space-y-1">
    <h2 className="text-lg font-semibold sm:text-xl">Titel</h2>
    <p className="text-sm text-muted-foreground">Beschreibung</p>
  </div>
  <div className="flex flex-wrap gap-2">
    <Button size="sm">Aktion</Button>
  </div>
</div>
```

## Checkliste: Design System Compliance

Beim Erstellen oder Refactoren von Komponenten:

- [ ] Verwendet Design-Tokens statt hard-coded Farben
- [ ] Folgt dem Container-System (keine eigenen `mx-auto`, `px-*`)
- [ ] Nutzt semantische HTML-Elemente (`<section>`, `<article>`, `<header>`)
- [ ] Icons haben `aria-hidden` wenn dekorativ
- [ ] Buttons haben `title` oder `aria-label` bei Icon-only
- [ ] Responsive Breakpoints folgen Tailwind-Defaults (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`)
- [ ] Spacing folgt 8pt-Grid (`space-y-*`, `gap-*`, `p-*`)
- [ ] Typografie nutzt definierte Utilities (`.text-h1`, `.text-body`, etc.)
- [ ] Fokus-States sind sichtbar (`focus-visible:ring-*`)
- [ ] Komponente funktioniert in Light & Dark Mode
