# Designsystem und Farben

Diese Markdown-Variante dient der GitHub‑freundlichen Darstellung von Farbswatches (per SVG‑Bilder). Die Haupt‑Analyse bleibt in `entwurf-und-analyse.adoc`. Diese Datei fokussiert auf UI/Color‑Themen, die in Markdown mit Bildern zuverlässiger sichtbar sind.

<details>
<summary><strong>Inhaltsverzeichnis</strong></summary>

- [Designsystem & Bibliotheken](#designsystem--bibliotheken)
- [Color Map (Status, Attendance, Abteilungen)](#color-map-status-attendance-abteilungen)
  - [Visuelle Vorschau](#visuelle-vorschau)
- [Brandfarben & Theme](#brandfarben--theme)
- [CSS‑Variablen (Beispiel)](#css-variablen-beispiel)
- [Tailwind‑Anbindung (Optional)](#tailwind-anbindung-optional)

</details>

## Designsystem & Bibliotheken

- UI‑Stack: Tailwind CSS + shadcn/ui (Buttons, Dialog, Drawer, Tabs, Table, Toast, Dropdown, Badge, Tooltip)
- Formulare: react-hook-form + zod
- Datum/Zeit: date-fns (de‑Locale)
- Drag & Drop: @dnd-kit/core
- Icons: lucide-react
- Daten-Fetching: Server Actions; klientenseitig SWR für einfache GETs
- Diagramme: Recharts; bei Spezialfällen visx
- Kalender: FullCalendar React (Alternative: react-big-calendar)
- PDF/Print: react-to-print; optional serverseitig puppeteer

## Color Map (Status, Attendance, Abteilungen)

Hinweise
- Farbcodierung immer mit zweitem Merkmal kombinieren (Icon, Badge‑Label), Kontrast AA beachten.
- Dark‑Mode: gleiche Hues, aber angepasste Tints/Foregrounds.

### Visuelle Vorschau

Rehearsal Lifecycle

| Status | Farbe | Swatch |
|---|---|---|
| draft | slate-300/slate-400 | <img src="swatches/slate-300.svg" width="12" height="12" /> |
| proposed | sky-200/sky-400 | <img src="swatches/sky-200.svg" width="12" height="12" /> |
| confirmed/final | emerald-200/emerald-500 | <img src="swatches/emerald-200.svg" width="12" height="12" /> |
| completed | teal-200/teal-500 | <img src="swatches/teal-200.svg" width="12" height="12" /> |
| cancelled | rose-200/rose-500 | <img src="swatches/rose-200.svg" width="12" height="12" /> |

Attendance

| Status | Farbe | Swatch |
|---|---|---|
| planned | zinc-200 | <img src="swatches/zinc-200.svg" width="12" height="12" /> |
| yes | emerald-500 | <img src="swatches/emerald-500.svg" width="12" height="12" /> |
| maybe | amber-500 | <img src="swatches/amber-500.svg" width="12" height="12" /> |
| no | rose-500 | <img src="swatches/rose-500.svg" width="12" height="12" /> |

Abteilungen

| Bereich | Farbe | Swatch |
|---|---|---|
| costume | fuchsia-500 | <img src="swatches/fuchsia-500.svg" width="12" height="12" /> |
| prop | amber-600 | <img src="swatches/amber-600.svg" width="12" height="12" /> |
| tech | cyan-600 | <img src="swatches/cyan-600.svg" width="12" height="12" /> |
| light | yellow-500 | <img src="swatches/yellow-500.svg" width="12" height="12" /> |
| sound | indigo-500 | <img src="swatches/indigo-500.svg" width="12" height="12" /> |
| fx | purple-600 | <img src="swatches/purple-600.svg" width="12" height="12" /> |

Exhaustion Heatmap (Beispiel‑Skala)

| Einsätze Fr–So | Swatch |
|---|---|
| 0–1 | <img src="swatches/green-200.svg" width="12" height="12" /> <img src="swatches/green-400.svg" width="12" height="12" /> |
| 2 | <img src="swatches/amber-300.svg" width="12" height="12" /> <img src="swatches/amber-500.svg" width="12" height="12" /> |
| ≥3 | <img src="swatches/rose-400.svg" width="12" height="12" /> <img src="swatches/rose-600.svg" width="12" height="12" /> |

## Brandfarben & Theme

Vorschlag (anpassbar)
- primary: Violet (Bühne/Spotlight)
- secondary: Amber (Warm/Glanzeffekt)
- accent: Teal (Interaktionen/Highlights)
- neutral: Slate (Text/Flächen)
- success/warn/danger/info: Emerald/Amber/Rose/Sky

Light Theme

| Token | Hex | Swatch |
|---|---|---|
| primary | #7C3AED | <img src="swatches/purple-600.svg" width="12" height="12" /> |
| secondary | #F59E0B | <img src="swatches/amber-500.svg" width="12" height="12" /> |
| accent | #14B8A6 | <img src="swatches/teal-200.svg" width="12" height="12" /> |
| background | #FFFFFF | <img src="swatches/slate-300.svg" width="12" height="12" /> |
| foreground | #0F172A | <img src="swatches/indigo-500.svg" width="12" height="12" /> |
| muted | #E5E7EB | <img src="swatches/zinc-200.svg" width="12" height="12" /> |
| border | #E5E7EB | <img src="swatches/zinc-200.svg" width="12" height="12" /> |
| ring | #7C3AED | <img src="swatches/purple-600.svg" width="12" height="12" /> |
| success | #10B981 | <img src="swatches/emerald-500.svg" width="12" height="12" /> |
| warning | #F59E0B | <img src="swatches/amber-500.svg" width="12" height="12" /> |
| danger | #EF4444 | <img src="swatches/rose-500.svg" width="12" height="12" /> |
| info | #38BDF8 | <img src="swatches/sky-200.svg" width="12" height="12" /> |

Dark Theme

| Token | Hex | Swatch |
|---|---|---|
| primary | #8B5CF6 | <img src="swatches/purple-600.svg" width="12" height="12" /> |
| secondary | #FBBF24 | <img src="swatches/amber-500.svg" width="12" height="12" /> |
| accent | #2DD4BF | <img src="swatches/teal-200.svg" width="12" height="12" /> |
| background | #0B0F16 | <img src="swatches/indigo-500.svg" width="12" height="12" /> |
| foreground | #E2E8F0 | <img src="swatches/slate-300.svg" width="12" height="12" /> |
| muted | #1F2937 | <img src="swatches/indigo-500.svg" width="12" height="12" /> |
| border | #334155 | <img src="swatches/indigo-500.svg" width="12" height="12" /> |
| ring | #8B5CF6 | <img src="swatches/purple-600.svg" width="12" height="12" /> |
| success | #10B981 | <img src="swatches/emerald-500.svg" width="12" height="12" /> |
| warning | #F59E0B | <img src="swatches/amber-500.svg" width="12" height="12" /> |
| danger | #F87171 | <img src="swatches/rose-400.svg" width="12" height="12" /> |
| info | #38BDF8 | <img src="swatches/sky-200.svg" width="12" height="12" /> |

## CSS‑Variablen (Beispiel)

```css
:root {
  --color-primary: #7C3AED;
  --color-secondary: #F59E0B;
  --color-accent: #14B8A6;
  --color-background: #FFFFFF;
  --color-foreground: #0F172A;
  --color-muted: #E5E7EB;
  --color-border: #E5E7EB;
  --color-ring: #7C3AED;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-info: #38BDF8;
}
.dark {
  --color-primary: #8B5CF6;
  --color-secondary: #FBBF24;
  --color-accent: #2DD4BF;
  --color-background: #0B0F16;
  --color-foreground: #E2E8F0;
  --color-muted: #1F2937;
  --color-border: #334155;
  --color-ring: #8B5CF6;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #F87171;
  --color-info: #38BDF8;
}
```

## Tailwind‑Anbindung (Optional)

```js
// tailwind.config.ts (Ausschnitt)
export default {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        ring: 'var(--color-ring)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)'
      }
    }
  }
}
```

