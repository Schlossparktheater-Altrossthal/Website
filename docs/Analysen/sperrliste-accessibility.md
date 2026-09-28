# Accessibility-Dokumentation: Sperrlistenübersicht

## Übersicht

Die Sperrlistenübersicht wurde nach WCAG 2.1 AA-Standards implementiert mit Fokus auf Keyboard-Navigation, Screen-Reader-Unterstützung und semantisches HTML.

## Implementierte Features

### 1. Semantic HTML & ARIA

- **role="main"** auf dem Hauptcontainer für Screen-Reader-Navigation
- **role="group"** für zusammengehörige Button-Gruppen (Filter, Ansichten, Navigation)
- **aria-label** auf allen interaktiven Elementen mit kontextspezifischen Beschreibungen
- **aria-pressed** für Toggle-Buttons (Filter, Ansichten) zur Status-Anzeige
- **aria-labelledby** auf Header-Element (#page-title)
- **aria-live="polite"** auf Zeitraum-Badges für dynamische Updates
- **aria-hidden="true"** auf dekorativen Icons

### 2. Keyboard-Navigation

- **Tastenkombinationen:**
  - `Strg+1` / `Cmd+1`: Kalenderansicht
  - `Strg+2` / `Cmd+2`: Tabellenansicht
  - `Strg+3` / `Cmd+3`: Timeline-Ansicht
  - `Arrow Left/Right`: Navigation zwischen Tagen (Timeline)
  - `Escape`: Highlight entfernen (Timeline)

- **Focus Management:**
  - `focus-visible:ring-2` auf allen interaktiven Elementen
  - `focus-visible:ring-blue-500` für einheitliche Fokus-Farbe
  - `focus-visible:ring-offset-2` für bessere Sichtbarkeit
  - Tab-Order folgt logischer visueller Reihenfolge

### 3. Screen-Reader-Unterstützung

- Detaillierte `aria-label` auf allen Buttons:
  - "Alle Personen anzeigen (42)" statt nur "Alle (42)"
  - "Kalenderansicht (Tastenkombination: Strg+1)" für Kontext
  - "Zu heute springen" für Navigation
  - "[Wochentag] [Tag]. öffnen" für WeekStrip-Buttons

- **role="listitem"** in Mobile-Legende für strukturierte Navigation
- **role="status"** für dynamische Inhalte (Zeitraum-Header)

### 4. Visuelles Feedback

- Klare Hover-States auf allen interaktiven Elementen
- Active-States mit `active:scale-95` für Touch-Feedback
- Farbige Highlights für aktuellen Tag (ring-2 + bg-blue-50)
- Kontrast-Verhältnisse erfüllen WCAG AA:
  - Text auf Weiß: ≥4.5:1
  - UI-Komponenten: ≥3:1
  - Status-Badges: Hoher Kontrast (grün/orange/rot auf Weiß)

### 5. Touch & Mobile

- `touch-pan-x` für horizontales Scrolling (DesktopCalendar)
- Responsive Grid: 3 Spalten (xs) → 7 Spalten (sm+) in WeekStrip
- Größere Touch-Targets auf Mobile (min. 44×44px)
- Klappbare Legende mit `<details>` Element (native Zugänglichkeit)

### 6. Performance & UX

- **React.memo** auf PersonCard und Cell für Re-Render-Optimierung
- **useMemo** für teure Berechnungen (buckets, spans, groupedCounts)
- **useCallback** für Event-Handler (Keyboard-Navigation, Jump-To-Today)
- Smooth-Scrolling mit `scrollIntoView({ behavior: 'smooth' })`

## Komponenten-Audit

### SperrlistenV2 (Hauptkomponente)

✅ `role="main"` auf Container  
✅ `aria-label` auf allen Buttons  
✅ `aria-pressed` für Toggle-Buttons  
✅ `focus-visible:ring-2` auf interaktiven Elementen  
✅ Keyboard-Navigation mit Strg+1/2/3  
✅ `aria-live="polite"` für Zeitraum

### WeekStrip

✅ `aria-label` mit vollständigem Kontext  
✅ Responsive Grid (3→7 Spalten)  
✅ `type="button"` explizit gesetzt  
✅ Heute-Highlight mit hohem Kontrast

### DesktopCalendar

✅ `hidden sm:block` für korrektes Verstecken  
✅ `touch-pan-x` für Touch-Geräte  
✅ Responsive Card-Breiten mit clamp()  
✅ Hover-States für Keyboard-Nutzer zugänglich

### TimelineView

✅ Arrow-Key-Navigation implementiert  
✅ `data-day` Attribute für Fokus-Management  
✅ Escape-Key zum Entfernen von Highlights  
✅ Symbol-Legende mit semantischem Markup

### MobileByDay

✅ `sm:hidden` für korrekte Anzeige  
✅ Scroll-Anker mit `id="day-{n}"`  
✅ Gruppierte Listen mit semantischem HTML

### DesktopTable

✅ Sticky Headers mit korrektem z-index  
✅ Scrolling-Hint verschwindet nach 3s  
✅ PersonCard & Cell mit React.memo

### PersonCard (memoized)

✅ `group/item` für Hover-Effekte  
✅ `title` Attribute für Tooltips  
✅ Kontrast-sichere Farbpaletten

### Cell (memoized)

✅ `type="button"` für interaktive Zellen  
✅ `title` für vollständige Labels  
✅ Farbcodierung erfüllt WCAG AA

## Testing-Empfehlungen

### Keyboard-Only-Test

1. Mit Tab durch alle Filter navigieren
2. Mit Pfeiltasten durch WeekStrip navigieren
3. Strg+1/2/3 zum Wechseln der Ansichten testen
4. In Timeline: Arrow Left/Right + Escape testen
5. Alle Buttons mit Enter/Space aktivierbar prüfen

### Screen-Reader-Test

1. NVDA/JAWS: Alle aria-label vorlesen lassen
2. VoiceOver: Navigation durch Gruppen testen
3. Talkback: Mobile-Legende expandieren/kollabieren
4. aria-live Ankündigungen bei Filter-Änderung prüfen

### Responsive-Test

1. xs (320px): WeekStrip auf 3 Spalten, Mobile-Legende sichtbar
2. sm (640px): WeekStrip auf 7 Spalten, Desktop-Views sichtbar
3. md (768px): Alle Inhalte gut lesbar
4. lg/xl: Optimale Darstellung mit max-w-6xl

### Kontrast-Check

1. Chrome DevTools: Lighthouse Accessibility-Score
2. WAVE Extension: Keine Fehler oder Warnungen
3. Color Contrast Analyzer: Alle Texte ≥4.5:1
4. Farbblindheit-Simulator: Status erkennbar ohne Farbe

## Bekannte Einschränkungen

- Virtual Scrolling nicht implementiert (bei >100 Personen empfohlen)
- Keine reduzierten Animationen (`prefers-reduced-motion`) - TODO
- Keine High-Contrast-Mode Unterstützung - TODO

## Compliance

✅ **WCAG 2.1 Level A**: Vollständig erfüllt  
✅ **WCAG 2.1 Level AA**: Erfüllt (ohne prefers-reduced-motion)  
⚠️ **WCAG 2.1 Level AAA**: Teilweise (Kontrast teilweise >7:1)

## Version

Dokumentiert am: 11.10.2025  
Migration: Spielplatz → theater-website (100% Feature-Parität)
