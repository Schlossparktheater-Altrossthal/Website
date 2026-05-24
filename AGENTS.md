# AGENTS.md

## Einführung
Diese Datei definiert die Projektstandards für die Website des Sommertheaters Altrossthal. Jeder, der an diesem Code arbeitet, soll diese Regeln einhalten, damit der Code verständlich, konsistent und wartbar bleibt.

## Benennungskonventionen
- Permission-Keys folgen dem Schema `VISIBILITY.PAGE.CONTEXT.ACTION`.
  - `VISIBILITY` ist `PUBLIC` für öffentliche Seiten (Home, Mystery, Chronik, Über uns, Schulkatze).
  - `VISIBILITY` ist `PRIVATE` für den Mitgliederbereich.
- Feature-Keys folgen dem Schema `FEATURE.PAGE.CONTEXT`.
- TypeScript-Variablen verwenden `camelCase` mit beschreibenden englischen Namen.
- Konstanten verwenden `SCREAMING_SNAKE_CASE`.
- React-Komponenten verwenden `PascalCase`.
- Funktionen verwenden `camelCase` und beginnen mit einem Verb wie `get`, `resolve`, `read`, `save`, `handle`, `ensure`.

## Icons
- Alle Standard-Icons sind in `src/components/ui/action-icons.tsx` definiert und müssen von dort importiert werden, nicht direkt aus `lucide-react`.
- Neue Icons, die projektweit gebraucht werden, müssen zuerst in `src/components/ui/action-icons.tsx` ergänzt werden.
- Seitenspezifische dekorative Icons dürfen weiterhin direkt aus `lucide-react` importiert werden.

## UI-Komponenten
- Buttons verwenden die `Button`-Komponente aus `src/components/ui/button.tsx` mit dem passenden Variant:
  - `primary` für Hauptaktionen
  - `destructive` für Löschaktionen
  - `outline` für Sekundäraktionen
  - `ghost` für Tertiäraktionen
- Löschaktionen verwenden immer `variant="destructive"` und das `TrashIcon`.
- Bearbeitungsaktionen verwenden immer das `EditIcon`.
- Dialoge für destruktive Aktionen müssen vor der Ausführung eine Bestätigung abfragen.

## Design-Tokens
- Farben müssen immer über die semantischen CSS-Variablen aus `src/design-system/tokens.json` verwendet werden, zum Beispiel `text-primary`, `text-destructive`, `bg-muted`.
- Hardcodierte Farbwerte sind nicht erlaubt.

## Seiten-Patterns
- Seiten-Header verwenden das `PageHeader`-Pattern aus `src/design-system/patterns/page-header.tsx`.
- Metric-Cards verwenden das `KeyMetricCard`-Pattern aus `src/design-system/patterns/key-metric.tsx`.
