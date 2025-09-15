"use client";
import { Calendar as RBC, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { saveAttendance } from "./actions";

const locales = { de } as any;
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

type Event = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string | null;
};

export function RehearsalCalendar({ events }: { events: Event[] }) {
  return (
    <div className="rounded border bg-card/60 backdrop-blur p-2">
      <RBC
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        defaultView={Views.MONTH}
        style={{ height: 640 }}
        messages={{
          month: "Monat",
          week: "Woche",
          day: "Tag",
          today: "Heute",
          previous: "Zurück",
          next: "Weiter",
        }}
        onSelectEvent={async (e: any) => {
          const id = e?.id as string;
          try {
            await saveAttendance(id, "yes");
            toast.success("Zusage gespeichert");
          } catch {
            toast.error("Speichern fehlgeschlagen");
          }
        }}
        tooltipAccessor={(e: any) => `${e.title}${e.location ? " – " + e.location : ""}`}
      />
      <div className="mt-2 text-xs text-foreground/70">Tipp: Klick auf einen Termin setzt deine Zusage (MVP).</div>
    </div>
  );
}
