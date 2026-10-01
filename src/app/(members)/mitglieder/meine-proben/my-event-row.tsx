import Link from "next/link";
import { FileText } from "lucide-react";

import { AlertIcon } from "@/components/ui/action-icons";
import type { MyEventItem, MyEventTone } from "@/lib/calendar/my-events";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { cn } from "@/lib/utils";

const DAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});
const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

export function formatTimeRange(start: Date, end: Date | null) {
  return `${TIME.format(start)}${end ? `–${TIME.format(end)}` : ""} Uhr`;
}

export function formatWhen(item: Pick<MyEventItem, "start" | "end" | "allDay">) {
  const start = new Date(item.start);
  if (item.allDay) return `${DAY.format(start)} · ganztägig`;
  return `${DAY.format(start)} · ${formatTimeRange(start, item.end ? new Date(item.end) : null)}`;
}

/** Farbpunkt je Art – dieselben Farben wie im Kalender der Terminplanung. */
export const TONE_DOT: Record<MyEventTone, string> = {
  rehearsal: "bg-info",
  department: "bg-success",
  event: "bg-primary",
};

export const TONE_LABELS: Record<MyEventTone, string> = {
  rehearsal: "Probe",
  department: "Gewerk",
  event: "Termin",
};

const ATTENDANCE_SHORT: Record<
  NonNullable<MyEventItem["attendance"]>,
  { sign: string; tone: string; label: string }
> = {
  PRESENT: { sign: "✓", tone: "text-success", label: "du warst da" },
  LATE: { sign: "◷", tone: "text-warning", label: "verspätet" },
  LEFT_EARLY: { sign: "◷", tone: "text-warning", label: "früher gegangen" },
  ABSENT: { sign: "✗", tone: "text-destructive", label: "gefehlt" },
  EXCUSED: { sign: "–", tone: "text-muted-foreground", label: "entschuldigt" },
};

function AttendanceMark({ mark }: { mark: NonNullable<MyEventItem["attendance"]> }) {
  const entry = ATTENDANCE_SHORT[mark];
  return (
    <span
      className={cn("text-sm font-semibold", entry.tone)}
      title={entry.label}
      aria-label={entry.label}
    >
      {entry.sign}
    </span>
  );
}

function RowContent({ item }: { item: MyEventItem }) {
  const start = new Date(item.start);
  const declined = item.decline?.declined ?? false;
  const details = [
    item.location ?? (item.locationOpen ? "Ort noch offen" : null),
    item.tone === "department" ? item.label : null,
    item.decline?.tentative ? "vorgemerkt" : null,
    item.fullTime ? "deine Zeit" : null,
  ].filter(Boolean);

  return (
    <>
      <span className="w-11 shrink-0 pt-0.5 text-right text-sm tabular-nums text-muted-foreground">
        {item.allDay ? "ganzt." : TIME.format(start)}
      </span>
      <span
        className={cn("mt-2 size-2 shrink-0 rounded-full", TONE_DOT[item.tone])}
        aria-label={TONE_LABELS[item.tone]}
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", declined && "line-through")}>
          {item.title}
        </span>
        {details.length ? (
          <span className="block truncate text-xs text-muted-foreground">
            {details.join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 pt-0.5 text-xs">
        {item.bucket === "past" && (item.attendance || item.hasProtocol) ? (
          <span className="flex items-center gap-1.5">
            {item.attendance ? <AttendanceMark mark={item.attendance} /> : null}
            {item.hasProtocol ? (
              <FileText className="size-3.5 text-muted-foreground" aria-label="Protokoll" />
            ) : null}
          </span>
        ) : declined ? (
          <span className="text-destructive">
            {item.decline?.emergency ? "Notfall" : "abgesagt"}
          </span>
        ) : item.conflict ? (
          <span
            className="flex items-center gap-1 text-warning"
            title={
              item.conflict === "blocked"
                ? "Du stehst an diesem Tag in der Sperrliste."
                : "Du bist an diesem Tag nur eingeschränkt verfügbar."
            }
          >
            <AlertIcon className="size-3.5" aria-hidden />
            {item.conflict === "blocked" ? "gesperrt" : "eingeschränkt"}
          </span>
        ) : item.group === "optional" ? (
          <span className="text-muted-foreground">optional</span>
        ) : null}
      </span>
    </>
  );
}

const ROW =
  "flex min-h-11 items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Eine Zeile pro Termin: Zeit, Farbpunkt, Titel mit einer Zusatzzeile, Status rechts.
 * Mit `previewHref` öffnet die Zeile auf breiten Bildschirmen die Vorschau daneben,
 * sonst die Terminseite.
 */
export function MyEventRow({
  item,
  previewHref,
  selected = false,
}: {
  item: MyEventItem;
  previewHref?: string;
  selected?: boolean;
}) {
  const href = item.href ?? "#";
  return (
    <li className={cn(item.bucket === "past" && "opacity-80")}>
      <Link href={href} className={cn(ROW, previewHref && "xl:hidden")}>
        <RowContent item={item} />
      </Link>
      {previewHref ? (
        <Link
          href={previewHref}
          scroll={false}
          data-preview-row
          aria-current={selected ? "true" : undefined}
          className={cn(ROW, "hidden xl:flex", selected && "bg-muted ring-1 ring-primary/50")}
        >
          <RowContent item={item} />
        </Link>
      ) : null}
    </li>
  );
}
