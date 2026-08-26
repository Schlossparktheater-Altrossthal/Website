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

Alle Patterns lesen Farben und Radii aus den generierten CSS-Variablen (`src/app/design-tokens.css`). Änderungen an den Tokens erfolgen in `src/design-system/tokens.json`. Anschließend `pnpm design-system:tokens` ausführen, damit die Styles aktualisiert werden.

Weitere Patterns (z. B. Guided Steps, Toolbar-Layouts) sollten dem Schema folgen: Wiederverwendbarer Container + klar dokumentierte Props in dieser Datei.
