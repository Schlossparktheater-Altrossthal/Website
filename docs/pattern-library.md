# Pattern Library

Diese Notiz sammelt die aktuellen UI-Patterns, die auf Basis von Tailwind, shadcn/ui und den neuen Design-Tokens umgesetzt wurden. Komponenten liegen unter `src/design-system/patterns` und können in React-Dateien via `@/design-system/patterns` importiert werden.

## Page Header

Der `PageHeader` bündelt Titel, Beschreibung und Metadaten eines Bereichs.

- `PageHeader`: Container mit responsiver Flex-Verteilung
- `PageHeaderTitle`: gerenderter `<h1>` mit konsistenter Typografie
- `PageHeaderDescription`: optionale Beschreibung unter dem Titel
- `PageHeaderActions`: rechte Spalte für Aktionen oder Status
- `PageHeaderStatus`: Badge-ähnlicher Status-Chip mit Varianten `online`, `offline`, `warning`, `error`, `idle`

Beispiel:

```tsx
<PageHeader>
  <div className="space-y-1.5">
    <PageHeaderTitle>Mitglieder-Dashboard</PageHeaderTitle>
    <PageHeaderDescription>
      Schneller Überblick über Live-Status und aktuelle Aktivitäten.
    </PageHeaderDescription>
  </div>
  <PageHeaderActions>
    <PageHeaderStatus state="online" icon={<Wifi className="h-4 w-4" />}>
      Live verbunden
    </PageHeaderStatus>
  </PageHeaderActions>
</PageHeader>
```

## Tokens einsetzen

Alle Patterns lesen Farben und Radii aus den generierten CSS-Variablen (`src/app/design-tokens.css`). Änderungen an den Tokens erfolgen in `src/design-system/tokens.json`. Anschließend `pnpm design-system:tokens` ausführen, damit die Styles aktualisiert werden.

Weitere Patterns (z. B. Guided Steps, Toolbar-Layouts) sollten dem Schema folgen: Wiederverwendbarer Container + klar dokumentierte Props in dieser Datei.
