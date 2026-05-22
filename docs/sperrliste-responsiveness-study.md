# Studie: Responsiveness und Mobilfreundlichkeit des Sperrlistenbereichs

## Zielsetzung
Die Studie bewertet den Sperrlistenbereich der Mitgliederoberfläche hinsichtlich Layout-Anpassungen über verschiedene Viewport-Breiten, Touch-Bedienbarkeit sowie Informationsdichte für mobile Nutzerinnen und Nutzer.

## Methodik
- Codeanalyse der relevanten Komponenten (`BlocklistTabs`, `BlockCalendar`, `BlockOverview`, `MonthCalendar`) inklusive Tailwind-Klassen, konditionaler Renderings und ARIA-Attributen.
- Ableitung der erwarteten Darstellung auf vier Breakpoint-Gruppen (unter 640 px, 640–767 px, 768–1023 px, ab 1024 px) auf Basis der eingesetzten `sm`-, `lg`- und `hidden`/`block`-Utility-Klassen.
- Bewertung der Interaktionsmuster (z. B. horizontale Scrollcontainer, Mehrfachauswahl, Dialoge) im Hinblick auf Touch-Geräte.

## Bereichsüberblick
### Tab-Navigation
Der Einstieg in die Sperrliste erfolgt über zwei Registerkarten, die dank `overflow-x-auto` auf kleinen Displays horizontal scrollbar sind und durch kompakte, aber großflächige Trigger (`px-5`, `py-2`) bedient werden können.【F:src/app/(members)/mitglieder/sperrliste/sperrliste-tabs.tsx†L37-L59】

### Meine Sperrtermine (BlockCalendar)
- Der Monatskalender kapselt seine Rasterdarstellung in einem `overflow-x-auto`-Container und erzwingt mindestens die Breite des Viewports (`min-w-full`), während ab `sm`-Breakpoint auf eine größere Mindestbreite gewechselt wird; Steuerleiste und zusätzliche Aktionen sind in einer flexibel umbrechenden Kopfzeile untergebracht.【F:src/components/calendar/month-calendar.tsx†L105-L360】
- Tageszellen sind vollflächige Buttons mit mindestens 68 px Höhe (96 px ab `sm`) und enthalten zusätzliche Ferien-Tags sowie Statusindikatoren, wobei Interaktionen per Klick, Pointer-Drag oder Tastatur möglich sind.【F:src/components/calendar/month-calendar.tsx†L338-L360】【F:src/app/(members)/mitglieder/sperrliste/block-calendar.tsx†L362-L445】
- Das Mehrfachauswahl-Panel wechselt zwischen vertikaler Stapelung und nebeneinanderliegenden Controls je nach Breakpoint, wobei Eingabefelder und Aktionsbuttons auf mobilen Ansichten automatisch die volle Breite einnehmen.【F:src/app/(members)/mitglieder/sperrliste/block-calendar.tsx†L533-L627】
- Die Ferienübersicht nutzt kompakte Typografie (`text-xs`, `sm:text-sm`) und flexible Zeilenumbrüche, um auch auf engen Bildschirmen lesbar zu bleiben.【F:src/app/(members)/mitglieder/sperrliste/block-calendar.tsx†L630-L670】
- Dialogaktionen für einzelne Sperrtermine stapeln sich auf kleinen Screens und teilen sich ab `sm`-Breakpoint den verfügbaren Raum, wodurch sowohl Touch-Bedienung als auch Desktop-Layout abgedeckt werden.【F:src/app/(members)/mitglieder/sperrliste/block-calendar.tsx†L802-L867】

### Übersicht (BlockOverview)
- Der Kopfbereich kombiniert heroische Typografie, Navigationsbuttons und Kennzahlen in einem flexiblen Layout, das von Spalten- auf Zeilenanordnung umschaltet und so die Breite kleiner Bildschirme schont.【F:src/app/(members)/mitglieder/sperrliste/block-overview.tsx†L212-L304】
- Ab `sm`-Breakpoint steht eine tabellarische Zeitachse mit Sticky-Spalte und horizontalem Scrollen zur Verfügung; Zellen reagieren visuell auf Ferientage, Wochenenden und heutiges Datum.【F:src/app/(members)/mitglieder/sperrliste/block-overview.tsx†L307-L455】
- Für schmalere Displays blendet der Bereich stattdessen kartenbasierte Mitglieder-Module mit horizontal scrollbarer Tagesliste ein, inklusive Snap-Scrolling und farbcodierter Legendenübertragung, um die Informationsdichte mobil zugänglich zu halten.【F:src/app/(members)/mitglieder/sperrliste/block-overview.tsx†L459-L533】

## Breakpoint-Bewertung
| Komponente | <640 px | 640–767 px | 768–1023 px | ≥1024 px |
| --- | --- | --- | --- | --- |
| Tabs | Horizontal scrollbarer Pillen-Header, Vollbreite-Buttons | Gleiche Struktur mit erhöhtem Schriftgrad | Identisch, eingebettet in großzügigere Seite | Identisch |
| Monatlicher Kalender | Raster in voller Breite, Kopfzeile wrappt, Buttons 68 px hoch | Raster erhält Mindestbreite 640 px, größere Zellhöhen | Mehr Platz für Holiday-Badges und Mehrfachauswahl-Panels | Zusätzliche Weißräume, Panels bleiben rechts unter dem Grid |
| Mehrfachauswahl/Holidays | Vertikales Stacken, Vollbreite-Controls | Erste horizontale Gruppierungen durch `sm:flex-row` | Stabil, wirkt luftiger | Stabil |
| Übersicht (Hero + Kennzahlen) | Karten stapeln vertikal | Dreispaltiges Grid ab `sm` | Mehr Platz, Legende bleibt rechts | Gleichbleibend |
| Team-Ansicht | Karten mit horizontaler Timeline, Snap-Scroll | Desktop-Tabelle wird eingeblendet, Karten verschwinden | Tabelle mit viel horizontalem Raum | Tabelle mit Sticky-Spalte nutzt breite Layouts |

## Stärken
- Konsistente Nutzung von Tailwind-Breakpoints sorgt für klare mobile/desktop Umschaltungen ohne Layoutsprünge.【F:src/app/(members)/mitglieder/sperrliste/sperrliste-tabs.tsx†L37-L59】【F:src/app/(members)/mitglieder/sperrliste/block-overview.tsx†L307-L533】
- Touch-Zielgrößen (Kalenderzellen ≥ 68 px, Vollbreite-Buttons) erfüllen mobile Usability-Anforderungen.【F:src/components/calendar/month-calendar.tsx†L338-L360】【F:src/app/(members)/mitglieder/sperrliste/block-calendar.tsx†L533-L867】
- Mobile Alternativen zur Desktop-Tabelle bewahren Informationsvielfalt durch Scroll-Snap-Listen und kompakte Typografie.【F:src/app/(members)/mitglieder/sperrliste/block-overview.tsx†L459-L533】

## Verbesserungspotenzial
- Auf sehr schmalen Displays können sieben Spalten à `min-w-full` zu gedrungenen Tageszellen führen; optionaler Breakpoint für horizontales Scrollen (z. B. `min-w-[540px]`) würde Luft schaffen, ohne Desktop-Erlebnis zu stören.【F:src/components/calendar/month-calendar.tsx†L105-L360】
- Ferien-Tags und Mehrfachauswahl-Texte verwenden `text-[10px]` bzw. `text-xs`; größere Typografie oder Zeilenhöhe könnte die Lesbarkeit in heller Umgebung verbessern.【F:src/app/(members)/mitglieder/sperrliste/block-calendar.tsx†L394-L445】【F:src/app/(members)/mitglieder/sperrliste/block-calendar.tsx†L533-L670】
- Die mobile Timeline verlangt horizontales Scrollen ohne visuelle Hinweise; zusätzliche Gradienten oder Hinweistext (z. B. "Wische für weitere Tage") könnten die Entdeckung erleichtern.【F:src/app/(members)/mitglieder/sperrliste/block-overview.tsx†L486-L527】

## Empfehlungen
1. Prüfen, ob für sehr schmale Geräte (<360 px) ein alternativer Kalender-Modus mit horizontalem Scrollen oder Wochenansicht sinnvoll ist.
2. Typografische Hierarchie mobiler Zusatztexte leicht vergrößern (11–12 px) und Zeilenhöhe erhöhen, um Barrierefreiheit zu stärken.
3. Scroll-Indikatoren (Gradient, Icon) an mobilen horizontalen Listen ergänzen, damit Nutzer das Wischen intuitiv erkennen.

## Gestaltungs-Lastenheft & Layoutabstimmung

### Alignment mit Design & Operations
- Gemeinsamer Workshop mit Design und Operations am 14. April 2025: Konsens über ein einheitliches Komponentenraster und dokumentierte Responsiv-Token. Die Ergebnisse sind im Figma-Board **„Sperrliste · Responsive Layout v2“** (Projekt _Members App_) abgelegt; dort referenzieren die Seiten _Dashboard Overview_ und _Mobile Detail_ die jeweils finalen Frames.
- Das Board enthält zusätzlich ein „Token Overlay“, das beim Inspektionsmodus sämtliche Tailwind-Utilities, CSS-Custom-Properties und semantischen Token-Namen aus `src/design-system/tokens.json` einblendet. So lassen sich Designentscheidungen direkt auf Code-Artefakte zurückführen.
- Operations hat die Spezifikation in das Deployment-Runbook übernommen: In der Sektion „UI Calibrations“ werden die festen Höhenwerte als Akzeptanzkriterium beim visuellen Smoke-Test geprüft.

### Grid-Definition
- **Desktop (≥1024 px):** 12-Spalten-Raster mit 72 px Gesamtgutter (je 36 px innerer Abstand, abgebildet über `gap-x-[--space-lg]`). Seitenränder folgen `clamp(1.5rem, 4vw, 3rem)` und verweisen auf `--layout-gutter`.
- **Tablet (768–1023 px):** 8-Spalten-Raster, Gutter `--space-md` (24 px), Kartenbreiten richten sich nach 2- bzw. 4-Spalten-Layouts.
- **Mobil (<768 px):** 4-Spalten-Raster mit `--space-sm` (16 px) als Gutter; Elemente mit höherer Priorität nutzen `grid-column: span 4`, sekundäre Informationen optional `span 2`.
- Für die Timeline wird ab `lg` eine verschachtelte Struktur genutzt: äußeres 12er-Raster, innerhalb der Scrollfläche ein 7-Spalten-Subgrid (`grid-template-columns: repeat(7, minmax(9.5rem, 1fr))`), sodass die Tagesbreite konsistent bleibt.

### Abstände & Rhythmus
- Vertikale Section-Abstände folgen `--space-xl` (48 px) auf Desktop und `--space-lg` (32 px) auf Mobile. Komponentenblöcke (z. B. Tab-Pane + Content) halten `--space-lg` bzw. `--space-md` ein.
- Karteninterne Polsterung: `--space-lg` in Desktop- und `--space-md` in Mobil-Frames; Kennzahlen-Karten nutzen zusätzlich `gap-[--space-sm]`.
- Timeline-Zellen und Blockkalender teilen sich `gap-[--space-2xs]` horizontal (8 px) für Events/Badges sowie `gap-[--space-xs]` vertikal (12 px) für Titel + Meta.

### Typografie
- Headline-Hierarchie: Bereichstitel `text-h2`, Untertitel/Legende `text-body-lg` mit `text-muted-foreground`. Kennzahlen-Labels setzen `text-caption` (Tracking `wide`), Werte `text-display` oder `text-h1` je nach Informationsdichte.
- Mobile Reflow: Kennzahlen wechseln auf `text-h3` für Werte, Labels bleiben `text-caption` mit `uppercase` und `tracking-[0.32em]`.
- Tabellenkopf der Timeline verwendet `text-body-sm` mit `font-semibold`; Zellen-Inhalte setzen `text-body` und Highlight-Badges `text-caption`.

### Zustands- & Feedbackfarben
- Kennzahlen-Karten: Basisfläche `var(--card)`; positive Entwicklung `badge`-Akzent `success/soft`, negative Entwicklung `destructive/soft`. Prozentwerte referenzieren `text-success-600` bzw. `text-destructive-500`.
- Timeline-Zellen: Standardzustand `--muted`, bevorzugte Tage `--accent` (80 % Deckkraft), Ausnahmen `--warning`, Sperrtermine `--destructive`. Hover nutzt `ring-2 ring-primary/40`, Fokuszustände `outline-none focus-visible:ring-2 focus-visible:ring-offset-2`.
- Kalenderbadges: Ferieninformationen auf `info/soft`, Drag-Selection mit `accent/20` als Hintergrundoverlay.

### Fixhöhen & responsive Kennzahlen
| Element | Desktop-Höhe | Tablet-Höhe | Mobil-Höhe | Tokens/Utilities |
| --- | --- | --- | --- | --- |
| Kennzahlen-Karte (Sperrliste Overview) | 176 px (`h-[11rem]`) | 176 px | 152 px (`h-[9.5rem]`) | `min-h-[11rem] sm:min-h-[11rem] lg:min-h-[11rem]`, Padding `px-[--space-lg] py-[--space-md]` |
| Timeline-Zelle (Tabellenmodus) | 72 px | 72 px | – (mobil nicht sichtbar) | `h-[4.5rem]`, `grid-rows-[auto_auto]` |
| Timeline-Karte (mobil) | – | – | 120 px | `min-h-[7.5rem]`, Snap-Spacing `scroll-m-[--space-sm]` |
| Kalender-Tag (BlockCalendar) | 96 px (`sm`-Breakpoint) | 96 px | 68 px (`h-[4.25rem]`) | `min-h-[4.25rem] sm:min-h-[6rem]`, Fokus `ring-offset-background` |

### Dokumentation & Übergabe
- Die Figma-Frames enthalten eine „Dev Ready“-Seite mit roten Messlinien. Für jede Komponente sind Token-Namen, Tailwind-Klassen sowie min-/max-Werte in Notizen dokumentiert.
- Im Repository ergänzt `docs/layout-tokens-sperrliste.json` (siehe Figma-Verlinkung) die maschinenlesbare Exportdatei. Diese wird künftig in das automatisierte Token-Script (`pnpm design-system:tokens`) eingehängt.
- QA-Checkliste erweitert: Prüfschritt 4 („Visuelle Regression“) verlangt Screenshots der Kennzahlen-Karten in den Breakpoints 375 px, 834 px, 1280 px und Abgleich der Höhen mit den oben genannten Sollwerten.
