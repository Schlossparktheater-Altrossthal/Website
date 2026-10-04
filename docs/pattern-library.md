# Pattern Library

Diese Notiz sammelt die aktuellen UI-Patterns, die auf Basis von Tailwind, shadcn/ui und den Design-Tokens umgesetzt wurden. Layout-Patterns liegen unter `src/components/members` und `src/components/ui`.

## Page Header

Der `PageHeader` aus `src/components/members/page-header.tsx` bündelt Titel, Beschreibung, Aktionen und Metadaten einer Mitgliederseite. Er projiziert Titel und Status in die `MembersAppShell`-Topbar und Beschreibung sowie Aktionen in den Content-Header.

- `title`: Seitentitel (erscheint in der Topbar)
- `description`: optionale Beschreibung im Content-Header
- `actions`: rechte Spalte für Aktionen oder Status-Badges
- `breadcrumbs`: optionale Breadcrumbs in der Topbar
- `quickActions`: optionale Schnellzugriffe in der Topbar
- `status`: optionaler Status-Chip in der Topbar
- `variant`: `"page"` (Standard) oder `"section"` für Unterbereiche

Beispiel:

```tsx
<PageHeader
  title="Mitglieder-Dashboard"
  description="Aktuelle Kennzahlen, Aktivitäten und Schnellzugriffe auf einen Blick."
  status={
    <ConnectionStatusBadge state="online" icon={<WifiIcon className="h-4 w-4" />}>
      Live verbunden
    </ConnectionStatusBadge>
  }
/>
```

## Tokens einsetzen

Alle Patterns lesen Farben und Radii aus den CSS-Variablen des aktiven Website-Themes (tweakcn-Format, siehe `docs/design-system.md`).

## Kanonische Bausteine

Verbindliche Werte und Herleitung: `docs/design-system.md` (Abschnitt „Kanonische UI-Werte") und
`docs/Analysen/ui-konsistenz-audit-2026-10-04.md`.

### Card

Immer `Card` aus `src/components/ui/card.tsx` verwenden – sie bringt Radius und Rahmen mit
(`rounded-lg`; `plain` `border-border/60 bg-card shadow-sm`, `default` `border-border/50 bg-card/60
backdrop-blur`). Radius und Rahmen kommen aus der Komponente – für neue Karten keine eigenen
Werte. (Ausnahme im Bestand: Onboarding-Dashboard-Kopf `rounded-2xl`.)

```tsx
<Card variant="plain" size="md">
  <CardHeader>
    <CardTitle>Titel</CardTitle>
  </CardHeader>
  <CardContent>…</CardContent>
</Card>
```

### Listenzeile

`ListRow` (`rounded-md`, `min-h-12`, `hover:bg-muted/50`) in einer `ListRowGroup`
(`rounded-lg border border-border`). Keine eigenen Zeilen-Container.

### Werkzeugzeile

Suche links (`Input` mit Suchicon `pl-9`), primäre Aktion rechts, in einer Zeile
(`flex flex-wrap items-center gap-2`, Aktionsgruppe `ml-auto`). Höhe innerhalb der Zeile
einheitlich: Standard `h-10`, für 44-px-Touch-Ziele `h-11`.

### Seitengerüst

`PageHeader` (H1 `text-2xl md:text-3xl font-semibold`) → Bereichs-Navigation → Werkzeugzeile →
`Card`s. Innen `<div className="space-y-6">`; die Shell stapelt ihre Bereiche mit `space-y-8`.

### Leerzustand

`py-12 text-center text-sm text-muted-foreground`, Icon optional in `text-muted-foreground`.

Weitere Patterns (z. B. Guided Steps, Toolbar-Layouts) folgen demselben Schema: Wiederverwendbarer
Container + klar dokumentierte Props in dieser Datei.
