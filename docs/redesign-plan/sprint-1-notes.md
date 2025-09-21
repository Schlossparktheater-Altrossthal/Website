# Sprint 1 – Informationsarchitektur & Layout-Fundament

Dieser Sprint schärft die Grundstruktur der öffentlichen Website und definiert das Navigationsgerüst.

## Layout-Raster & Abstände
- **Grid-Shell**: `.app-shell` organisiert `header`, `main`, `footer` in einem `grid-template-rows: auto 1fr auto` und sorgt für eine Mindesthöhe von `100dvh`.
- **Content-Breite**: `.layout-container` zentriert Inhalte und begrenzt die Breite auf `90rem` (1440px) bei gleichbleibenden Außenabständen über `--layout-gutter`.
- **Header-Versatz**: `--header-height` steuert den vertikalen Versatz für Skip-Link, `main` und Hero (`.hero-section`). Mobile Headerhöhe: 4rem, ab `768px`: 5rem.
- **Hauptbereich**: `.site-main` kapselt Seiteninhalte, bringt Luft nach unten und lässt Module selbstständig mit `layout-container` arbeiten.

## Responsive Breakpoints
Tailwind-Breakpoints sind auf die neu definierten Viewports abgestimmt:

| Token | Viewport | Anwendungsfall |
|-------|----------|----------------|
| `xs`  | 320px    | kleine Smartphones, Stack-Layouts & Skip-Link-Sichtbarkeit |
| `sm`  | 640px    | schmale Tablets, initiale Auflockerung von Spalten |
| `md`  | 768px    | Tablets, Umschalten auf zweispaltige Footer-Layouts |
| `lg`  | 1024px   | Laptops, horizontale Navigation im Header |
| `xl`  | 1440px   | Desktop-Maxbreite, großzügige Gutter |
| `2xl` | 1920px   | Ultra-Wide, bleibt auf `layout-container` begrenzt |

Container-Padding folgt diesen Breakpoints (`1.5rem`, `2rem`, `3rem`).

## Navigationsrichtlinien
- **Primäre Einträge** (`Über uns`, `Das Geheimnis`, `Chronik`) werden in `@/config/navigation.ts` verwaltet und zentral in Header & Footer verwendet.
- **Sekundärbereich** fasst `Login`, `Newsletter`, `Impressum` zusammen und sitzt im Footer als Service-Spalte. CTA `Newsletter abonnieren` nutzt dasselbe Config-Objekt.
- **Header-Verhalten**: Transparenter Header auf der Startseite, der beim Scrollen in eine dunkle, blur-basierte Variante mit Border übergeht. Desktop-Menü (`md`+) inline, Mobil (`< md`) als overlay Panel mit Escape/ClickOutside-Handling.
- **Footer-Verlinkung**: Enthält Impressum & Kontakt sowie Build-Informationen. Kontaktinfos (`mailto`, Telefonnummer, Adresse) sind prominent in der Einleitung verankert.

## Hero-Grundstruktur
- Prototypische Value Proposition mit Eyebrow (`Sommer 2025`), Headline, Subline sowie drei Key Benefits.
- Primärer CTA `Das Geheimnis entdecken` (Primary Button) und sekundärer CTA `Rückblick 2024` (Outline Button).
- Hintergrund nutzt bestehende Parallax-Logik, Content ruht auf `.layout-container`, transformiert leicht beim Scrollen.

## Barrierefreiheit
- Skip-Link verweist auf `#main`, Landmark-Rollen bleiben (header/nav/main/footer).
- Mobile Overlay fokussiert auf Escape/Outside Click, aktive Links haben `aria-current="page"`.
- Newsletter-CTA im Footer besitzt ausreichenden Kontrast (> 4.5:1) und border-dashed-Indikator.

Diese Richtlinien bilden die Basis für Sprint 2 (Token & Komponenten), ohne bestehende Seitenlogik zu beeinträchtigen.
