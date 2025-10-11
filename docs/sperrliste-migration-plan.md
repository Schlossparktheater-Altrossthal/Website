# Sperrlistenübersicht - Vollständige Migrations-Plan

## Übersicht

Migration der kompletten Sperrlistenübersicht vom Spielplatz in die Theater-Website mit vollem Design und allen Features.

**Status:** ~20% übernommen (nur Basis-Struktur)  
**Ziel:** 100% Feature-Parität mit verbessertem Design System

---

## Phase 1: Design System & Grundlagen

### 1.1 Design System Mapping

**Datei:** `src/app/(members)/mitglieder/sperrliste/overview/sperrliste-styles.css`

```css
/* CSS Variablen basierend auf Theater-Website Design System */
@layer base {
  :root {
    /* Von Spielplatz Mapping */
    --spl-ok: var(--success);           /* Grün für frei/bevorzugt */
    --spl-ok-rgba: hsl(var(--success) / 0.14);
    --spl-warn: var(--warning);         /* Orange für eingeschränkt */
    --spl-warn-rgba: hsl(var(--warning) / 0.18);
    --spl-danger: var(--destructive);   /* Rot für gesperrt */
    --spl-danger-rgba: hsl(var(--destructive) / 0.12);
    --spl-info: var(--info);            /* Blau für Info/Ferien */
    --spl-info-rgba: hsl(var(--info) / 0.18);
    --spl-primary: var(--primary);      /* Primär für Highlights */
    --spl-primary-rgba: hsl(var(--primary) / 0.15);
    
    /* Ferien/Feiertage Farben */
    --spl-vacation: 186 91% 54%;        /* Sky-500 für Ferien */
    --spl-vacation-from: 186 91% 60%;   /* Sky-400 */
    --spl-vacation-to: 186 91% 54%;     /* Sky-500 */
    --spl-holiday: 38 92% 50%;          /* Amber-500 für Feiertage */
    --spl-holiday-from: 43 96% 56%;     /* Amber-400 */
    --spl-holiday-to: 38 92% 50%;       /* Amber-500 */
    
    /* Gruppen-Farben */
    --spl-actors-from: 217 91% 60%;     /* Blue-400 */
    --spl-actors-to: 217 91% 54%;       /* Blue-500 */
    --spl-crew-from: 142 71% 45%;       /* Green-400 */
    --spl-crew-to: 142 76% 36%;         /* Green-500 */
    --spl-both-from: 271 81% 60%;       /* Purple-400 */
    --spl-both-to: 326 78% 54%;         /* Pink-500 */
  }
}
```

### 1.2 Icon-Komponenten

**Datei:** `src/app/(members)/mitglieder/sperrliste/overview/icons.tsx`

```tsx
import { 
  Star, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Check, 
  Umbrella, 
  CalendarDays 
} from 'lucide-react';

// Standardisierte Icon-Props
type IconProps = { className?: string };

export function StarIcon({ className = "h-4 w-4" }: IconProps) {
  return <Star className={className} />;
}

export function ClockIcon({ className = "h-4 w-4" }: IconProps) {
  return <Clock className={className} />;
}

export function ClockAlertIcon({ className = "h-4 w-4" }: IconProps) {
  return <AlertCircle className={className} />;
}

export function XCircleIcon({ className = "h-4 w-4" }: IconProps) {
  return <XCircle className={className} />;
}

export function CheckIcon({ className = "h-3.5 w-3.5" }: IconProps) {
  return <Check className={className} />;
}

export function UmbrellaIcon({ className = "h-4 w-4" }: IconProps) {
  return <Umbrella className={className} />;
}

export function CalendarStarIcon({ className = "h-4 w-4" }: IconProps) {
  return <CalendarDays className={className} />;
}
```

### 1.3 Basis UI-Komponenten

**Datei:** `src/app/(members)/mitglieder/sperrliste/overview/ui-components.tsx`

```tsx
import React from 'react';

// Badge-Komponente mit tones
type BadgeTone = "info" | "danger" | "ok" | "default";
export function Badge({ 
  children, 
  tone = "default" 
}: { 
  children: React.ReactNode; 
  tone?: BadgeTone 
}) {
  const palettes: Record<BadgeTone, string> = {
    info: "border-sky-200 bg-[color:var(--spl-info-rgba)] text-[color:var(--spl-info)]",
    danger: "border-red-200 bg-[color:var(--spl-danger-rgba)] text-[color:var(--spl-danger)]",
    ok: "border-green-200 bg-[color:var(--spl-ok-rgba)] text-[color:var(--spl-ok)]",
    default: "border-slate-200 bg-white/80 text-slate-600",
  };
  
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${palettes[tone]}`}>
      {children}
    </span>
  );
}

// IconButton
export function IconButton({ 
  children, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
    >
      {children}
    </button>
  );
}

// StatusBadge
export function StatusBadge({ 
  icon, 
  count, 
  tone, 
  compact 
}: { 
  icon: React.ReactNode; 
  count: number; 
  tone: 'ok' | 'warn' | 'danger'; 
  compact?: boolean 
}) {
  const colors = {
    ok: 'bg-green-100 text-green-700 border-green-300',
    warn: 'bg-orange-100 text-orange-700 border-orange-300',
    danger: 'bg-red-100 text-red-700 border-red-300'
  };
  
  if (compact) {
    return (
      <div className={`flex items-center justify-center rounded-md border px-1 py-0.5 text-[10px] font-bold ${colors[tone]}`}>
        <span>{count}</span>
      </div>
    );
  }
  
  return (
    <div className={`flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${colors[tone]}`}>
      {icon}
      <span>{count}</span>
    </div>
  );
}

// MiniChip & Dot für kompakte Listen
export function MiniChip({ 
  count, 
  tone 
}: { 
  count: number; 
  tone: 'ok' | 'warn' | 'danger' 
}) {
  const map: Record<string, string> = {
    ok: 'bg-[color:var(--spl-ok-rgba)] text-[color:var(--spl-ok)] border-green-200',
    warn: 'bg-[color:var(--spl-warn-rgba)] text-[color:var(--spl-warn)] border-orange-200',
    danger: 'bg-[color:var(--spl-danger-rgba)] text-[color:var(--spl-danger)] border-red-200',
  };
  return (
    <span className={`inline-flex min-w-5 items-center justify-center rounded-md border px-1 text-[10px] ${map[tone]}`}>
      {count}
    </span>
  );
}

// Note-Komponente für Infokarten
export function Note({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode 
}) {
  return (
    <article className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h3>
      <p className="mt-1 text-sm leading-6 text-slate-700">{children}</p>
    </article>
  );
}
```

---

## Phase 2: Daten-Helfer & Logik

### 2.1 Data Helpers

**Datei:** `src/app/(members)/mitglieder/sperrliste/overview/data-helpers.ts`

```typescript
import type { 
  DayColumn, 
  HolidayIndicator, 
  OverviewPerson, 
  OverviewPersonDay 
} from "./types";

// Bucket-Typ für Day-Gruppierung
export type DayBucket = {
  column: DayColumn;
  available: { person: OverviewPerson; cell: OverviewPersonDay }[];
  limited: { person: OverviewPerson; cell: OverviewPersonDay }[];
  blocked: { person: OverviewPerson; cell: OverviewPersonDay }[];
  holiday: HolidayIndicator | null;
  holidayLabel?: string;
  holidayType?: "holiday" | "vacation";
  isPublicHoliday?: boolean;
};

// Personen nach Tagen gruppieren
export function selectDayBuckets(
  people: OverviewPerson[], 
  dayCols: DayColumn[], 
  holidays: HolidayIndicator[]
): DayBucket[] {
  return dayCols.map((column, index) => {
    const entries = people.map((person) => ({ 
      person, 
      cell: person.days[index] 
    }));
    
    const available = entries
      .filter((e) => e.cell.type === "preferred" || e.cell.type === "free")
      .sort((a, b) => 
        a.cell.type === b.cell.type 
          ? a.person.name.localeCompare(b.person.name) 
          : a.cell.type === "preferred" ? -1 : 1
      );
    
    const limited = entries
      .filter((e) => e.cell.type === "limited")
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
    
    const blocked = entries
      .filter((e) => e.cell.type === "block")
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
    
    const holidayInfo = holidays.find((h) => h.dayIndex === index);
    
    return {
      column,
      available,
      limited,
      blocked,
      holiday: holidayInfo ?? null,
      holidayLabel: holidayInfo?.label,
      holidayType: holidayInfo?.type,
      isPublicHoliday: holidayInfo?.isPublicHoliday ?? false,
    };
  });
}

// Holiday-Span Typ für colSpan-Berechnung
export type HolidaySpan = {
  start: number;
  end: number;
  label?: string;
  hasPublicHoliday?: boolean;
};

// Zusammenhängende Ferien-Zeiträume finden
export function getHolidaySpans(
  dayCols: DayColumn[], 
  buckets: DayBucket[]
): HolidaySpan[] {
  const spans: HolidaySpan[] = [];
  let currentSpan: HolidaySpan | null = null;

  buckets.forEach((bucket, idx) => {
    if (bucket.holiday && bucket.holidayType === "vacation") {
      if (!currentSpan) {
        currentSpan = {
          start: idx,
          end: idx,
          label: bucket.holidayLabel,
          hasPublicHoliday: bucket.isPublicHoliday,
        };
      } else {
        currentSpan.end = idx;
        if (bucket.isPublicHoliday) {
          currentSpan.hasPublicHoliday = true;
        }
      }
    } else {
      if (currentSpan) {
        spans.push(currentSpan);
        currentSpan = null;
      }
    }
  });

  if (currentSpan) {
    spans.push(currentSpan);
  }

  return spans;
}

// Availability-Prozentsatz berechnen
export function calculateAvailability(bucket: DayBucket): number {
  const totalCount = bucket.available.length + bucket.limited.length + bucket.blocked.length;
  if (totalCount === 0) return 0;
  return Math.round((bucket.available.length / totalCount) * 100);
}
```

---

## Phase 3: Komponenten-Erstellung

### 3.1 Cell-Komponente (Tabelle)

**Datei:** `src/app/(members)/mitglieder/sperrliste/overview/table-cell.tsx`

```tsx
import React from 'react';
import type { OverviewPersonDay } from './types';

type CellProps = {
  cell: OverviewPersonDay;
  compact: boolean;
};

export function Cell({ cell, compact }: CellProps) {
  const baseClasses = `flex flex-col justify-center h-16 w-full rounded-lg px-2.5 text-left text-[12px] font-medium overflow-hidden ${compact ? "leading-4" : ""}`;

  if (cell.type === "free") {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-slate-200/70 bg-slate-50 text-[11px] font-medium text-slate-500">
        frei
      </div>
    );
  }

  if (cell.type === "holiday") {
    return (
      <div className="flex h-16 items-center justify-center rounded-lg border border-sky-200/30 bg-sky-50/30">
        <span className="h-1.5 w-full rounded-full bg-sky-300/50" />
      </div>
    );
  }

  if (cell.type === "block") {
    return (
      <button className={`${baseClasses} bg-[color:var(--spl-danger-rgba)] text-[color:var(--spl-danger)] border border-red-200`}>
        <span className="block truncate text-[10px] uppercase tracking-[0.14em]">
          Sperrtermin
        </span>
        {cell.label && (
          <span className="block mt-0.5 text-[11px] text-[color:var(--spl-danger)] truncate">
            {cell.label}
          </span>
        )}
      </button>
    );
  }

  if (cell.type === "limited") {
    return (
      <button className={`${baseClasses} border border-orange-200 bg-[color:var(--spl-warn-rgba)] text-[color:var(--spl-warn)]`}>
        <span className="block truncate text-[10px] uppercase tracking-[0.14em]">
          Eingeschränkt
        </span>
        {cell.label && (
          <span className="block mt-0.5 text-[11px] text-[color:var(--spl-warn)] truncate">
            {cell.label}
          </span>
        )}
      </button>
    );
  }

  if (cell.type === "preferred") {
    return (
      <button className={`${baseClasses} border border-green-200 bg-[color:var(--spl-ok-rgba)] text-[color:var(--spl-ok)]`}>
        <span className="block truncate text-[10px] uppercase tracking-[0.14em]">
          Bevorzugt
        </span>
        {cell.label && (
          <span className="block mt-0.5 text-[11px] text-[color:var(--spl-ok)] truncate">
            {cell.label}
          </span>
        )}
      </button>
    );
  }

  return null;
}
```

### 3.2 PersonCard (DesktopCalendar)

**Datei:** `src/app/(members)/mitglieder/sperrliste/overview/person-card.tsx`

```tsx
import React from 'react';
import type { OverviewPerson, OverviewPersonDay } from './types';

type PersonCardProps = {
  person: OverviewPerson;
  cell: OverviewPersonDay;
  tone: 'ok' | 'warn' | 'danger';
  compact: boolean;
};

export function PersonCard({ person, cell, tone, compact }: PersonCardProps) {
  const colors = {
    ok: {
      border: 'border-green-200/80',
      bg: 'from-green-50/80 to-white',
      avatar: 'from-green-500 to-green-600',
      text: 'text-green-700/90',
      badge: 'bg-green-600'
    },
    warn: {
      border: 'border-orange-200/80',
      bg: 'from-orange-50/80 to-white',
      avatar: 'from-orange-500 to-orange-600',
      text: 'text-orange-700/90',
      badge: 'bg-orange-600'
    },
    danger: {
      border: 'border-red-200/80',
      bg: 'from-red-50/80 to-white',
      avatar: 'from-red-500 to-red-600',
      text: 'text-red-700/90',
      badge: 'bg-red-600'
    }
  };

  const style = colors[tone];

  return (
    <li className={`group/item flex items-start gap-1.5 rounded-xl border ${style.border} bg-gradient-to-br ${style.bg} px-2 py-1.5 text-[11px] shadow-sm transition-all hover:scale-[1.02] hover:shadow-md`}>
      <span className={`mt-0.5 inline-flex ${compact ? 'h-5 w-5' : 'h-6 w-6'} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${style.avatar} text-[9px] font-bold text-white shadow-sm`}>
        {person.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="truncate font-semibold text-slate-900 text-[11px]">
            {person.name}
          </p>
          {cell.type === 'preferred' && !compact && (
            <span className={`rounded-full ${style.badge} px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white`}>
              Top
            </span>
          )}
        </div>
        {cell.label && !compact && (
          <p className={`mt-0.5 text-[10px] leading-tight ${style.text} line-clamp-2`}>
            {cell.label}
          </p>
        )}
        {cell.label && compact && (
          <p className={`text-[9px] ${style.text} truncate`} title={cell.label}>
            {cell.label}
          </p>
        )}
      </div>
    </li>
  );
}
```

### 3.3 TimelineCell

**Datei:** `src/app/(members)/mitglieder/sperrliste/overview/timeline-cell.tsx`

```tsx
import React, { useState } from 'react';
import { StarIcon, ClockAlertIcon, XCircleIcon, CheckIcon } from './icons';
import type { OverviewPersonDay } from './types';

type TimelineCellProps = {
  cell: OverviewPersonDay;
};

export function TimelineCell({ cell }: TimelineCellProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (cell.type === "free") {
    return (
      <div className="group relative flex h-10 items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50/50 text-slate-400 transition-all group-hover:border-slate-300 group-hover:bg-slate-100">
          <CheckIcon />
        </div>
        <span className="pointer-events-none absolute -top-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          Frei verfügbar
        </span>
      </div>
    );
  }

  if (cell.type === "holiday") {
    return (
      <div className="flex h-10 items-center justify-center">
        <div className="h-1 w-full rounded-full bg-sky-200/50" />
      </div>
    );
  }

  if (cell.type === "block") {
    return (
      <div
        className="group relative flex h-10 items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-gradient-to-br from-red-50 to-red-100/50 shadow-sm transition-all group-hover:shadow-md">
          <XCircleIcon className="h-5 w-5 text-red-600" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-red-200 bg-white p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700">
              Sperrtermin
            </p>
            <p className="mt-0.5 text-xs leading-snug text-slate-700">
              {cell.label}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (cell.type === "limited") {
    return (
      <div
        className="group relative flex h-10 items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-sm transition-all group-hover:shadow-md">
          <ClockAlertIcon className="h-5 w-5 text-orange-600" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-orange-200 bg-white p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">
              Eingeschränkt
            </p>
            <p className="mt-0.5 text-xs leading-snug text-slate-700">
              {cell.label}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (cell.type === "preferred") {
    return (
      <div
        className="group relative flex h-10 items-center justify-center"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 shadow-sm transition-all group-hover:shadow-md">
          <StarIcon className="h-5 w-5 text-green-600" />
        </div>
        {cell.label && showTooltip && (
          <div className="absolute -top-2 left-1/2 z-30 w-48 -translate-x-1/2 -translate-y-full rounded-lg border border-green-200 bg-white p-2 shadow-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-green-700">
              Bevorzugt
            </p>
            <p className="mt-0.5 text-xs leading-snug text-slate-700">
              {cell.label}
            </p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
```

---

## Phase 4: View-Komponenten erweitern

### 4.1 WeekStrip erweitern

**Schlüssel-Features:**
- 7-Grid-Layout mit `grid-cols-7`
- Status-Badges in farbigen Bubbles
- Availability-Fortschrittsbalken (absolute bottom)
- Feiertag/Ferien-Icons in Ecken
- 'Heute'-Highlighting mit `bg-blue-50` & `ring`
- `scrollIntoView` für Jump-Navigation

### 4.2 DesktopCalendar neu

**Struktur:**
```tsx
<div className="overflow-x-auto">
  {/* Holiday Spans Bar (colSpan logic) */}
  {/* Horizontal scrolling cards grid */}
  <div className="flex gap-3">
    {buckets.map((bucket) => (
      <div className="w-72 shrink-0">
        {/* Header mit Glassmorphism */}
        {/* Content mit PersonCards */}
        {/* Footer mit Stats */}
      </div>
    ))}
  </div>
</div>
```

**Features:**
- Ferien/Feiertags-Balken mit `colSpan` und absolute positioning
- Hover-States mit `setHoveredDay`
- Kompaktmodus bei >5 Personen
- Availability progress bar
- PersonCard integration

### 4.3 TimelineView neu

**Struktur:**
```tsx
<div className="space-y-3">
  {/* Kompakte Symbollegende */}
  {/* Holiday/Ferien-Balken */}
  
  {/* Sticky Day Header */}
  <div className="grid grid-cols-[200px_1fr]">
    <div>Mitglied</div>
    <div className="grid grid-cols-7">
      {/* Tag-Buttons */}
    </div>
  </div>
  
  {/* Gruppierte Personen */}
  {groupedPeople.actors.map(...)}
  {groupedPeople.both.map(...)}
  {groupedPeople.crew.map(...)}
</div>
```

**Features:**
- Gruppierung mit sticky colored headers
- Keyboard-Navigation (ArrowLeft/Right, Home, End)
- Day-Highlighting mit `ring-2 ring-inset ring-blue-200`
- TimelineCell integration

### 4.4 MobileByDay erweitern

**Features:**
- Gruppierung mit farbigen Separatoren
- Initialen-Avatare mit Gruppen-Farben
- `divide-y` Listen
- Holiday/Ferien badges
- `scrollIntoView` integration

### 4.5 Desktop-Tabelle

**Neue Datei:** `src/app/(members)/mitglieder/sperrliste/overview/desktop-table.tsx`

**Features:**
- Sticky header & name column mit `sticky left-0 z-20`
- Ferien/Feiertags-Zeilen mit `colSpan`
- Gruppierungs-Spalte mit `rowSpan` und vertical text
- Cell integration
- Scrolling container mit hint
- Monatswechsel-Controls

---

## Phase 5: Hauptkomponente erweitern

### 5.1 SperrlistenV2.tsx

**Neue Features:**
```tsx
// Heute-Button
<button onClick={() => {
  const todayDay = dayCols.find(d => d.accent);
  if (todayDay) {
    setHighlightedDay(todayDay.n);
    const element = document.querySelector(`[data-day="${todayDay.n}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}}>
  <ClockIcon /> Heute
</button>

// Note-Komponenten für bevorzugte Tage
<section className="grid gap-3 lg:grid-cols-2">
  <Note title="Bevorzugte Tage">Mo & Do</Note>
  <Note title="Ausnahmen">Mi (Sonderproben möglich)</Note>
</section>

// Kompakte mobile Legende
<div className="sm:hidden">
  <div className="flex items-center gap-3 text-[10px]">
    {/* Status icons & labels */}
  </div>
</div>

// Keyboard-Navigation
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (view !== 'timeline') return;
    // Arrow key handling
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [view, highlightedDay, dayCols]);
```

---

## Phase 6: Testing & Optimierung

### 6.1 Responsive Testing
- [ ] xs (320px) - Mobile Legende, WeekStrip
- [ ] sm (640px) - View-Toggle sichtbar
- [ ] md (768px) - DesktopCalendar 2-col
- [ ] lg (1024px) - DesktopCalendar 3-col
- [ ] xl (1440px) - Full features

### 6.2 Performance
- [ ] `useMemo` für buckets/spans
- [ ] `useCallback` für event handler
- [ ] `React.memo` für PersonCard/Cell
- [ ] Virtual scrolling prüfen (>50 Personen)
- [ ] Debounce hover states

### 6.3 Accessibility
- [ ] ARIA-labels für alle interaktiven Elemente
- [ ] Keyboard-Navigation (Tab, Arrow keys)
- [ ] Screen-reader text mit `sr-only`
- [ ] Contrast-Check (WCAG AA)
- [ ] Focus indicators mit `focus-visible:ring-2`

---

## Migrations-Reihenfolge (Empfohlen)

1. ✅ **Phase 1 (Foundation):** CSS, Icons, UI-Komponenten
2. ✅ **Phase 2 (Logic):** Data helpers, bucket/span functions
3. ✅ **Phase 3 (Cells):** Cell, PersonCard, TimelineCell
4. ✅ **Phase 4.1:** WeekStrip erweitern
5. ✅ **Phase 4.2:** DesktopCalendar neu
6. ✅ **Phase 4.3:** TimelineView neu
7. ✅ **Phase 4.4:** MobileByDay erweitern
8. ✅ **Phase 4.5:** Desktop-Tabelle neu
9. ✅ **Phase 5:** SperrlistenV2 erweitern
10. ✅ **Phase 6:** Testing & Optimierung

**Geschätzte Arbeitszeit:** 8-12 Stunden für vollständige Migration

---

## Notizen

- **Design System Consistency:** Alle Farben nutzen CSS-Variablen basierend auf bestehendem Design System
- **Icon Library:** lucide-react bereits installiert, keine zusätzlichen Dependencies
- **Responsive:** Mobile-first Ansatz, dann Desktop-Features
- **TypeScript:** Alle neuen Komponenten typsicher
- **Accessibility:** Von Anfang an eingebaut, nicht nachträglich
- **Testing:** Manuell testen mit verschiedenen Datenmengen (1, 10, 50 Personen)

---

## Offene Fragen

1. Soll die Tabellen-Ansicht auch mobile verfügbar sein? (Spielplatz: nur Desktop)
2. PDF-Export: Soll das Design auch dort übernommen werden?
3. Monatswechsel: Echte API-Integration oder nur UI?
4. Animations/Transitions: Framer Motion nutzen oder nur CSS?
