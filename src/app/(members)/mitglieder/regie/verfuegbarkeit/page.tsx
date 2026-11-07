import Link from "next/link";

import { AvailabilityPdfButton } from "@/components/regie/availability-pdf-picker";
import { DirectionEmpty, DirectionViewHeader } from "@/components/regie/direction-ui";
import { DateBadge } from "@/components/ui/date-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { loadDirectionAvailabilityView } from "@/lib/regie/availability";
import {
  AVAILABILITY_MODE_LABELS,
  AVAILABILITY_MODES,
  AVAILABILITY_WEEK_OPTIONS,
  availabilityQuery,
  describeAvailabilityRange,
  parseAvailabilityRange,
  type AvailabilityRange,
} from "@/lib/regie/availability-range";
import { eventTimeLabel, formatDay } from "@/lib/regie/data";
import {
  directionHref,
  directionPdfHref,
  firstParam,
  resolveDirectionPage,
  type DirectionSearchParams,
} from "@/lib/regie/page";
import { cn } from "@/lib/utils";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Verfügbarkeit · Regie" };

const noon = (key: string) => new Date(`${key}T12:00:00Z`);

function Chip({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3 text-sm whitespace-nowrap transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

type Person = { id: string; name: string; roles: string[]; reason: string | null };

function PersonList({ people, tone }: { people: Person[]; tone: "absent" | "limited" }) {
  return (
    <ul className="space-y-1">
      {people.map((person) => (
        <li key={person.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span
            aria-hidden
            className={cn(
              "size-2 shrink-0 translate-y-[-1px] rounded-full",
              tone === "absent" ? "bg-destructive" : "bg-warning",
            )}
          />
          <span className="font-medium">{person.name}</span>
          {person.roles.length ? (
            <span className="text-xs text-muted-foreground">{person.roles.join(", ")}</span>
          ) : null}
          <span className={cn("basis-full pl-4", person.reason ? "" : "text-muted-foreground")}>
            {person.reason ?? "kein Grund angegeben"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Wer an welchem Tag fehlt – mit Gründen, Terminen und probbaren Szenen. */
export default async function DirectionAvailabilityPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const params = await searchParams;
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const range = parseAvailabilityRange(firstParam(params.ansicht), firstParam(params.wochen));
  const view = await loadDirectionAvailabilityView(show.id, range);

  const link = (next: AvailabilityRange) =>
    `${directionHref("verfuegbarkeit", show.id)}&${availabilityQuery(next)}`;

  const fullDays = view.days.filter((day) => !day.absent.length && !day.limited.length).length;
  const absenceCount = new Map<string, { name: string; days: string[] }>();
  for (const day of view.days) {
    for (const person of day.absent) {
      const entry = absenceCount.get(person.id) ?? { name: person.name, days: [] };
      entry.days.push(formatDay(noon(day.key)));
      absenceCount.set(person.id, entry);
    }
  }
  const mostAbsent = [...absenceCount.values()].sort(
    (a, b) => b.days.length - a.days.length || a.name.localeCompare(b.name, "de"),
  );

  return (
    <div className="space-y-5">
      <DirectionViewHeader
        title="Verfügbarkeit"
        description={`${describeAvailabilityRange(range)}: wer fehlt und warum`}
        showId={show.id}
        pdfAction={
          <AvailabilityPdfButton
            pdfHref={directionPdfHref("verfuegbarkeit", show.id)}
            initial={range}
          />
        }
      />

      <div className="space-y-2">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {AVAILABILITY_MODES.map((mode) => (
            <Chip key={mode} href={link({ ...range, mode })} active={range.mode === mode}>
              {AVAILABILITY_MODE_LABELS[mode]}
            </Chip>
          ))}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {AVAILABILITY_WEEK_OPTIONS.map((weeks) => (
            <Chip key={weeks} href={link({ ...range, weeks })} active={range.weeks === weeks}>
              {weeks === 1 ? "diese Woche" : `${weeks} Wochen`}
            </Chip>
          ))}
        </div>
      </div>

      {!view.members.length ? (
        <DirectionEmpty>Noch keine Mitglieder in dieser Produktion.</DirectionEmpty>
      ) : !view.days.length ? (
        <DirectionEmpty>
          {range.mode === "termine"
            ? "In diesem Zeitraum ist kein Termin eingetragen."
            : "In diesem Zeitraum gibt es keine Kerntage."}
        </DirectionEmpty>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Tage" value={view.days.length} />
            <StatTile label="alle da" value={fullDays} />
            <StatTile label="Personen fehlen" value={absenceCount.size} />
          </div>

          <ul className="space-y-3">
            {view.days.map((day) => {
              const blocked = day.scenes.filter((scene) => scene.status === "missing");
              const ready = day.scenes.length - blocked.length;
              return (
                <li
                  key={day.key}
                  className="space-y-3 rounded-xl border border-border/70 bg-card p-3"
                >
                  <header className="flex items-center gap-3">
                    <DateBadge date={noon(day.key)} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {day.absent.length
                          ? `${day.absent.length} ${day.absent.length === 1 ? "fehlt" : "fehlen"}`
                          : "Alle können"}
                        {day.limited.length ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {day.limited.length} eingeschränkt
                          </span>
                        ) : null}
                      </p>
                      {day.scenes.length ? (
                        <p
                          className={cn(
                            "text-sm",
                            blocked.length ? "text-warning" : "text-muted-foreground",
                          )}
                        >
                          {ready} von {day.scenes.length} Szenen probbar
                        </p>
                      ) : null}
                    </div>
                    {day.finalWeek ? (
                      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        Endprobenwoche
                      </span>
                    ) : null}
                  </header>

                  {day.events.length ? (
                    <ul className="space-y-1 rounded-lg bg-muted/50 p-2 text-sm">
                      {day.events.map((event) => (
                        <li key={event.id}>
                          <span className="tabular-nums text-muted-foreground">
                            {eventTimeLabel(event)}
                          </span>{" "}
                          <span className="font-medium">{event.title}</span>
                          {event.scenes.length ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · Szenen {event.scenes.join(", ")}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {day.absent.length ? <PersonList people={day.absent} tone="absent" /> : null}
                  {day.limited.length ? <PersonList people={day.limited} tone="limited" /> : null}

                  {blocked.length ? (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">
                        Nicht probbar: {blocked.length} {blocked.length === 1 ? "Szene" : "Szenen"}
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {blocked.map((scene) => (
                          <li key={scene.label}>
                            <span className="font-medium">{scene.label}</span>
                            {scene.note ? (
                              <span className="text-muted-foreground"> – fehlt: {scene.note}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {mostAbsent.length ? (
            <section className="space-y-2">
              <h2 className="text-base font-semibold">Wer fehlt wie oft</h2>
              <ul className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card">
                {mostAbsent.map((person) => (
                  <li key={person.name} className="flex gap-3 p-3 text-sm">
                    <span className="w-8 shrink-0 text-right font-semibold tabular-nums">
                      {person.days.length}×
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{person.name}</span>
                      <span className="block text-muted-foreground">{person.days.join(" · ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
