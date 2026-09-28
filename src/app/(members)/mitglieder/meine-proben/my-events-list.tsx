import { CalendarIcon } from "@/components/ui/action-icons";
import type { MyEventItem, MyEventTone } from "@/lib/calendar/my-events";
import { DEFAULT_TIME_ZONE, formatIsoDateInTimeZone } from "@/lib/date-time";
import { cn } from "@/lib/utils";

import { MyEventRow, TONE_DOT, TONE_LABELS } from "./my-event-row";
import { RowKeyboardNav } from "./row-keyboard-nav";

const DAY_HEADING = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Leerzustand nach dem Muster aus `docs/design-system.md`: zentriert, gedämpft, Icon optional. */
function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        In dieser Auswahl stehen gerade keine Termine an.
      </div>
    );
  }

  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <CalendarIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
      <p>Sobald du zu Terminen eingeladen wirst, erscheinen sie hier.</p>
      <p className="mt-1">
        Tipp: Abwesenheiten früh in die Sperrliste eintragen – dann weiß die Planung Bescheid.
      </p>
    </div>
  );
}

function dayLabel(key: string, todayKey: string, tomorrowKey: string, sample: string) {
  const date = DAY_HEADING.format(new Date(sample));
  if (key === todayKey) return `Heute · ${date}`;
  if (key === tomorrowKey) return `Morgen · ${date}`;
  return date;
}

/**
 * Liste der eigenen Termine, nach Tagen gruppiert, eine Zeile pro Termin. Die Filter stehen in
 * der Werkzeugzeile der Seite; hier wird nur nach dem dort gewählten Bereich gefiltert.
 */
export function MyEventsList({
  items,
  activeGroup,
  todayKey,
  tomorrowKey,
  previewHref,
  selectedId,
}: {
  items: MyEventItem[];
  activeGroup: string;
  todayKey: string;
  tomorrowKey: string;
  /** Link für die Desktop-Vorschau eines Termins. */
  previewHref?: (id: string) => string;
  selectedId?: string | null;
}) {
  const visible =
    activeGroup === "all" ? items : items.filter((item) => item.group === activeGroup);
  if (!visible.length) return <EmptyState filtered={items.length > 0} />;

  const days: { key: string; items: MyEventItem[] }[] = [];
  for (const item of visible) {
    const key = formatIsoDateInTimeZone(item.start);
    const last = days.at(-1);
    if (last?.key === key) last.items.push(item);
    else days.push({ key, items: [item] });
  }
  const tones = (["rehearsal", "department", "event"] as const).filter((tone) =>
    visible.some((item) => item.tone === tone),
  );

  return (
    <RowKeyboardNav>
      <div className="space-y-3">
        {days.map((day) => (
          <section key={day.key}>
            <h3
              className={cn(
                "px-2 pb-0.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                day.key === todayKey && "text-primary",
              )}
            >
              {dayLabel(day.key, todayKey, tomorrowKey, day.items[0].start)}
            </h3>
            <ul>
              {day.items.map((item) => (
                <MyEventRow
                  key={`${item.group}-${item.id}`}
                  item={item}
                  previewHref={previewHref?.(item.id)}
                  selected={item.id === selectedId}
                />
              ))}
            </ul>
          </section>
        ))}
        {tones.length > 1 ? <ToneLegend tones={tones} /> : null}
      </div>
    </RowKeyboardNav>
  );
}

export function ToneLegend({ tones }: { tones: readonly MyEventTone[] }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-2 pt-3 text-xs text-muted-foreground">
      {tones.map((tone) => (
        <span key={tone} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", TONE_DOT[tone])} aria-hidden />
          {TONE_LABELS[tone]}
        </span>
      ))}
    </p>
  );
}
