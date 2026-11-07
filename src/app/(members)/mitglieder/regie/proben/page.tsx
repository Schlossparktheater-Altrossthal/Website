import { endOfISOWeek, format, getISOWeek, startOfISOWeek } from "date-fns";
import { de } from "date-fns/locale/de";

import {
  DirectionChips,
  DirectionEmpty,
  DirectionGroupHeading,
  DirectionViewHeader,
} from "@/components/regie/direction-ui";
import { DateBadge } from "@/components/ui/date-badge";
import { eventTimeLabel, loadDirectionEvents, type DirectionEvent } from "@/lib/regie/data";
import {
  directionHref,
  firstParam,
  resolveDirectionPage,
  type DirectionSearchParams,
} from "@/lib/regie/page";
import { cn } from "@/lib/utils";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Proben · Regie" };

const KINDS = { alle: "Alle", proben: "Proben", sonstige: "Sonstige" } as const;
type Kind = keyof typeof KINDS;
const TIMES = { kommend: "Kommend", vergangen: "Vergangen" } as const;
type Time = keyof typeof TIMES;

function weekLabel(date: Date) {
  const start = startOfISOWeek(date);
  const end = endOfISOWeek(date);
  return `KW ${getISOWeek(date)} · ${format(start, "d. MMM", { locale: de })} – ${format(end, "d. MMM", { locale: de })}`;
}

function EventCard({ event }: { event: DirectionEvent }) {
  const cancelled = event.status === "CANCELLED";
  const coming = event.invited - event.absent.length;
  const hasDetails =
    event.agenda.length > 0 || event.absent.length > 0 || Boolean(event.description);
  const head = (
    <div className="flex gap-3">
      <DateBadge date={event.start} />
      <div className="min-w-0 flex-1 text-sm">
        <p className={cn("font-medium", cancelled && "line-through")}>
          {event.title}
          {event.status === "TENTATIVE" ? (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">
              vorgemerkt
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground">
          {eventTimeLabel(event)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        {cancelled ? (
          <p className="text-destructive">
            abgesagt{event.cancelReason ? `: ${event.cancelReason}` : ""}
          </p>
        ) : null}
        {event.scenes.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {event.scenes.map((scene) => (
              <span
                key={scene}
                className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
              >
                {scene}
              </span>
            ))}
          </div>
        ) : null}
        {event.invited && !cancelled ? (
          <p className="mt-1">
            <span className={event.absent.length ? "text-warning" : "text-success"}>
              {coming} von {event.invited} können
            </span>
            {event.confirmed ? (
              <span className="text-muted-foreground"> · {event.confirmed} zugesagt</span>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <li className={cn("rounded-xl border border-border/70 bg-card", cancelled && "opacity-60")}>
      {hasDetails ? (
        <details className="group">
          <summary className="cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
            {head}
            <p className="mt-2 pl-[3.75rem] text-xs text-primary group-open:hidden">
              Ablauf & Details ▾
            </p>
          </summary>
          <div className="space-y-3 border-t border-border/60 p-3 text-sm">
            {event.description ? (
              <p className="whitespace-pre-line text-muted-foreground">{event.description}</p>
            ) : null}
            {event.agenda.length ? (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Ablauf
                </h3>
                <ol className="space-y-1">
                  {event.agenda.map((item) => (
                    <li key={item.id} className="grid grid-cols-[6.5rem_1fr] gap-2">
                      <span className="tabular-nums text-muted-foreground">{item.time ?? "–"}</span>
                      <span>
                        {item.label}
                        {item.note ? (
                          <span className="block text-xs text-muted-foreground">{item.note}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            {event.absent.length ? (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Fehlen ({event.absent.length})
                </h3>
                <ul className="space-y-0.5">
                  {event.absent.map((name) => (
                    <li key={name} className="flex gap-2">
                      <span
                        aria-hidden
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive"
                      />
                      {name}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </details>
      ) : (
        <div className="p-3">{head}</div>
      )}
    </li>
  );
}

export default async function DirectionRehearsalsPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const params = await searchParams;
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();

  const kindParam = firstParam(params.art);
  const kind: Kind = kindParam && kindParam in KINDS ? (kindParam as Kind) : "alle";
  const timeParam = firstParam(params.zeit);
  const time: Time = timeParam === "vergangen" ? "vergangen" : "kommend";

  const now = new Date();
  const events =
    time === "kommend"
      ? await loadDirectionEvents(show.id, { from: now })
      : await loadDirectionEvents(show.id, { from: new Date(0), to: now, order: "desc" });
  const counts = {
    alle: events.length,
    proben: events.filter((event) => event.rehearsal).length,
    sonstige: events.filter((event) => !event.rehearsal).length,
  };
  const shown = events.filter((event) =>
    kind === "proben" ? event.rehearsal : kind === "sonstige" ? !event.rehearsal : true,
  );
  const weeks: { label: string; events: DirectionEvent[] }[] = [];
  for (const event of shown) {
    const label = weekLabel(event.start);
    if (weeks.at(-1)?.label === label) weeks.at(-1)!.events.push(event);
    else weeks.push({ label, events: [event] });
  }

  const base = directionHref("proben", show.id);
  const link = (next: { art?: Kind; zeit?: Time }) =>
    `${base}&art=${next.art ?? kind}&zeit=${next.zeit ?? time}`;

  return (
    <div className="space-y-4">
      <DirectionViewHeader
        title="Proben & Termine"
        description="Tippe einen Termin an für Ablauf und wer fehlt"
        showId={show.id}
        pdfKind="termine"
      />
      <div className="space-y-2">
        <DirectionChips
          items={(Object.keys(TIMES) as Time[]).map((value) => ({
            href: link({ zeit: value }),
            label: TIMES[value],
            active: time === value,
          }))}
        />
        <DirectionChips
          items={(Object.keys(KINDS) as Kind[]).map((value) => ({
            href: link({ art: value }),
            label: KINDS[value],
            active: kind === value,
            count: counts[value],
          }))}
        />
      </div>
      {weeks.length ? (
        weeks.map((week) => (
          <section key={week.label} className="space-y-2">
            <DirectionGroupHeading>{week.label}</DirectionGroupHeading>
            <ul className="space-y-2">
              {week.events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <DirectionEmpty>
          {time === "kommend" ? "Keine kommenden Termine." : "Noch keine vergangenen Termine."}
        </DirectionEmpty>
      )}
    </div>
  );
}
