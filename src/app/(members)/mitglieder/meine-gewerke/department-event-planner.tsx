"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";
import { Clock, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { getUserDisplayName } from "@/lib/names";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { deleteDepartmentEventAction } from "./department-events-actions";
import { CreateDepartmentEventButton } from "./department-event-create-button";

type EventUser = {
  id: string;
  name: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
} | null;

export type DepartmentEventLite = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  location: string | null;
  description: string | null;
  createdBy: EventUser;
};

type DepartmentEventPlannerProps = {
  events: DepartmentEventLite[];
  departmentId: string;
  departmentSlug: string;
  canManage: boolean;
};

type EventWithMeta = DepartmentEventLite & {
  startDate: Date;
  endDate: Date | null;
  isPast: boolean;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", { dateStyle: "full" });
const TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

export function DepartmentEventPlanner({
  events,
  departmentId,
  departmentSlug,
  canManage,
}: DepartmentEventPlannerProps) {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);

  const eventsWithMeta = useMemo<EventWithMeta[]>(
    () =>
      events.map((event) => {
        const startDate = parseISO(event.start);
        const endDate = event.end ? parseISO(event.end) : null;
        return {
          ...event,
          startDate,
          endDate,
          isPast: startDate.getTime() < now.getTime(),
        };
      }),
    [events, now],
  );

  const groupedByMonth = useMemo(() => {
    if (!eventsWithMeta.length) return [] as { label: string; events: EventWithMeta[] }[];
    const buckets = new Map<string, { label: string; events: EventWithMeta[] }>();
    for (const event of eventsWithMeta) {
      const key = format(event.startDate, "yyyy-MM");
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.events.push(event);
      } else {
        buckets.set(key, {
          label: format(event.startDate, "MMMM yyyy", { locale: de }),
          events: [event],
        });
      }
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => {
        value.events.sort((left, right) => left.startDate.getTime() - right.startDate.getTime());
        return value;
      });
  }, [eventsWithMeta]);

  const upcomingCount = useMemo(
    () => eventsWithMeta.filter((event) => !event.isPast).length,
    [eventsWithMeta],
  );
  const pastCount = eventsWithMeta.length - upcomingCount;

  return (
    <section className="space-y-6 rounded-3xl border border-border/60 bg-background/75 p-6 shadow-[0_24px_70px_-45px_rgba(99,102,241,0.55)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">Terminplanung</h2>
          <p className="text-sm text-muted-foreground">
            Koordiniere interne Treffen, Werkstattzeiten und Abstimmungen deines Gewerks.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="bg-background/80">
              <Clock aria-hidden className="mr-1 h-3.5 w-3.5" />
              {upcomingCount} {upcomingCount === 1 ? "Termin geplant" : "Termine geplant"}
            </Badge>
            <Badge variant="outline" className="bg-background/80">
              {pastCount} {pastCount === 1 ? "Termin abgeschlossen" : "Termine abgeschlossen"}
            </Badge>
          </div>
        </div>
        {canManage ? (
          <CreateDepartmentEventButton
            departmentId={departmentId}
            departmentSlug={departmentSlug}
          />
        ) : null}
      </div>

      {eventsWithMeta.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background/70 p-6 text-sm text-muted-foreground">
          Es sind aktuell keine Termine geplant. Sobald du einen Termin anlegst, erscheint er hier mit allen Details.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByMonth.map((group) => (
            <div key={group.label} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h3>
              <ul className="space-y-3">
                {group.events.map((event) => (
                  <li
                    key={event.id}
                    className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-inner"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-foreground">{event.title}</p>
                          <Badge variant={event.isPast ? "secondary" : "success"}>
                            {event.isPast ? "Vergangen" : "Bevorstehend"}
                          </Badge>
                        </div>
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock aria-hidden className="h-4 w-4" />
                          <span>
                            {DATE_FORMATTER.format(event.startDate)} · {TIME_FORMATTER.format(event.startDate)}
                            {event.endDate ? ` – ${TIME_FORMATTER.format(event.endDate)}` : ""}
                          </span>
                        </p>
                        {event.location ? (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground/90">
                            <MapPin aria-hidden className="h-4 w-4" />
                            <span>{event.location}</span>
                          </p>
                        ) : null}
                        {event.description ? (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground/90">{event.description}</p>
                        ) : null}
                        {event.createdBy ? (
                          <p className="text-xs text-muted-foreground/80">
                            Geplant von {getUserDisplayName(event.createdBy, "Unbekannt")}
                          </p>
                        ) : null}
                      </div>
                      {canManage ? (
                        <DeleteDepartmentEventButton
                          eventId={event.id}
                          title={event.title}
                          onDeleted={() => {
                            router.refresh();
                          }}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type DeleteButtonProps = {
  eventId: string;
  title: string;
  onDeleted: () => void;
};

function DeleteDepartmentEventButton({ eventId, title, onDeleted }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const confirmed = window.confirm(`Möchtest du den Termin "${title}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }

    startTransition(() => {
      deleteDepartmentEventAction({ eventId })
        .then((result) => {
          if (result?.success) {
            toast.success("Termin gelöscht.");
            onDeleted();
          } else {
            toast.error(result?.error ?? "Termin konnte nicht gelöscht werden.");
          }
        })
        .catch(() => {
          toast.error("Termin konnte nicht gelöscht werden.");
        });
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={isPending}
      className="text-destructive hover:text-destructive"
    >
      <Trash2 aria-hidden className="h-4 w-4" />
      <span className="sr-only">Termin löschen</span>
    </Button>
  );
}
