"use client";

import { useMemo, useState } from "react";
import { Calendar as RBC, Views, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { saveAttendance } from "./actions";

const locales = { de } as const;
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

type AttendanceStatus = "yes" | "no";
type NullableStatus = AttendanceStatus | null;

type AttendanceLog = {
  id: string;
  previous: NullableStatus;
  next: NullableStatus;
  comment: string | null;
  changedAt: string;
  changedBy: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

type DashboardRehearsal = {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  show: { id: string; title?: string | null; year: number } | null;
  myStatus: NullableStatus;
  totalAttendees: number;
  logs: AttendanceLog[];
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  myStatus: NullableStatus;
};

const STATUS_LABEL: Record<string, string> = {
  "null": "Geplant",
  "yes": "Zusage",
  "no": "Absage",
};

function getStatusKey(status: NullableStatus): string {
  return status ?? "null";
}

const STATUS_BADGE: Record<string, string> = {
  "null": "bg-gray-100 text-gray-800",
  "yes": "bg-green-100 text-green-800",
  "no": "bg-red-100 text-red-800",
};

const STATUS_OPTION_ORDER: NullableStatus[] = [null, "yes", "no"];

const CALENDAR_COLORS: Record<string, { background: string; border: string; color: string }> = {
  "null": { background: "#f3f4f6", border: "#9ca3af", color: "#374151" },
  "yes": { background: "#dcfce7", border: "#22c55e", color: "#166534" },
  "no": { background: "#fecaca", border: "#ef4444", color: "#7f1d1d" },
};

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusIcon(status: NullableStatus) {
  switch (status) {
    case "yes":
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "no":
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return <HelpCircle className="w-4 h-4 text-slate-600" />;
  }
}

type AttendanceControlsProps = {
  rehearsalId: string;
  initialStatus: NullableStatus;
  logs: AttendanceLog[];
  onUpdated: (status: NullableStatus, logs: AttendanceLog[]) => void;
};

function AttendanceControls({ rehearsalId, initialStatus, logs, onUpdated }: AttendanceControlsProps) {
  const [selectedStatus, setSelectedStatus] = useState<NullableStatus>(initialStatus);
  const [savedStatus, setSavedStatus] = useState<NullableStatus>(initialStatus);
  const [comment, setComment] = useState("");
  const [history, setHistory] = useState<AttendanceLog[]>(logs);
  const [isSaving, setIsSaving] = useState(false);

  const canSave = selectedStatus !== savedStatus || comment.trim().length > 0;
  const latestLog = history[0];

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const result = await saveAttendance({
        rehearsalId,
        status: selectedStatus,
        comment,
      });

      setSelectedStatus(result.status as NullableStatus ?? null);
      setSavedStatus(result.status as NullableStatus ?? null);
      setComment("");
      setHistory(result.logs ?? []);
      onUpdated(result.status as NullableStatus ?? null, result.logs ?? []);
      toast.success("Status aktualisiert");
    } catch (error) {
      console.error("attendance save failed", error);
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTION_ORDER.map((option) => (
          <Button
            key={option ?? "planned"}
            type="button"
            variant={selectedStatus === option ? "default" : "outline"}
            className="gap-2"
            onClick={() => setSelectedStatus(option)}
          >
            {statusIcon(option)}
            {STATUS_LABEL[getStatusKey(option)]}
          </Button>
        ))}
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground" htmlFor={`comment-${rehearsalId}`}>
          Kommentar (optional)
        </label>
        <textarea
          id={`comment-${rehearsalId}`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          rows={2}
          placeholder="Kurzinfo für das Team (max. 500 Zeichen)"
          maxLength={500}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5" />
          {latestLog ? (
            <span>
              Zuletzt {STATUS_LABEL[getStatusKey(latestLog.next)]} am {formatDateTime(latestLog.changedAt)}
              {latestLog.changedBy?.name ? ` von ${latestLog.changedBy.name}` : ""}
            </span>
          ) : (
            <span>Noch keine Rückmeldung protokolliert.</span>
          )}
        </div>
        <Button type="button" onClick={handleSave} disabled={!canSave || isSaving}>
          {isSaving ? "Speichere…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}

function buildCalendarEvents(rehearsals: DashboardRehearsal[]): CalendarEvent[] {
  return rehearsals.map((item) => ({
    id: item.id,
    title: item.title,
    start: new Date(item.start),
    end: new Date(item.end),
    location: item.location,
    myStatus: item.myStatus,
  }));
}

export function RehearsalCalendar({
  events,
  onSelect,
}: {
  events: CalendarEvent[];
  onSelect?: (id: string) => void;
}) {
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
        eventPropGetter={(event) => {
          const palette = CALENDAR_COLORS[getStatusKey(event.myStatus)];
          return {
            style: {
              backgroundColor: palette.background,
              borderColor: palette.border,
              color: palette.color,
            },
          };
        }}
        onSelectEvent={(event) => onSelect?.((event as CalendarEvent).id)}
        tooltipAccessor={(event: CalendarEvent) =>
          `${event.title}${event.location ? " – " + event.location : ""} (${STATUS_LABEL[getStatusKey(event.myStatus)]})`
        }
      />
      <div className="mt-2 text-xs text-foreground/70">
        Hinweis: Ohne Reaktion gelten Proben als <span className="font-medium">geplant</span>.
      </div>
    </div>
  );
}

export function RehearsalDashboard({ rehearsals }: { rehearsals: DashboardRehearsal[] }) {
  const [items, setItems] = useState(rehearsals);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const events = useMemo(() => buildCalendarEvents(items), [items]);
  const displayRehearsals = useMemo(() => {
    if (!focusedId) return items.slice(0, 3);
    const selected = items.find((item) => item.id === focusedId);
    if (!selected) return items.slice(0, 3);
    const rest = items.filter((item) => item.id !== focusedId);
    return [selected, ...rest].slice(0, 3);
  }, [items, focusedId]);

  const handleUpdate = (id: string, status: NullableStatus, logs: AttendanceLog[]) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, myStatus: status, logs } : item)),
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Nächste Proben</h2>
        {displayRehearsals.length === 0 ? (
          <Card className="p-6 text-center">
            <CalendarIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="text-muted-foreground">Keine kommenden Proben geplant.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {displayRehearsals.map((rehearsal) => (
              <Card
                key={rehearsal.id}
                className={`p-4 transition-shadow ${
                  focusedId === rehearsal.id ? "ring-2 ring-primary" : ""
                }`}
                onMouseEnter={() => setFocusedId(rehearsal.id)}
                onMouseLeave={() => setFocusedId(null)}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{rehearsal.title}</h3>
                      {rehearsal.show && (
                        <span className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                          {rehearsal.show.title || rehearsal.show.year}
                        </span>
                      )}
                      <span className={`rounded px-2 py-1 text-xs ${STATUS_BADGE[getStatusKey(rehearsal.myStatus)]}`}>
                        {STATUS_LABEL[getStatusKey(rehearsal.myStatus)]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {formatDate(rehearsal.start)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatTime(rehearsal.start)} – {formatTime(rehearsal.end)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {rehearsal.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {rehearsal.totalAttendees} Rückmeldungen
                      </span>
                    </div>
                    <AttendanceControls
                      rehearsalId={rehearsal.id}
                      initialStatus={rehearsal.myStatus ?? null}
                      logs={rehearsal.logs}
                      onUpdated={(status, updatedLogs) => handleUpdate(rehearsal.id, status, updatedLogs)}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Kalender-Ansicht</h2>
        <RehearsalCalendar events={events} onSelect={(id) => setFocusedId(id)} />
      </div>
    </div>
  );
}
