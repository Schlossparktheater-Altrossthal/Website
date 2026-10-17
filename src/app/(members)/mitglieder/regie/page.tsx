import Link from "next/link";

import { PageHeader } from "@/components/members/page-header";
import { DirectionCard, DirectionEmpty } from "@/components/regie/direction-ui";
import { WishComposer } from "@/components/regie/wish-board";
import { DateBadge } from "@/components/ui/date-badge";
import { prisma } from "@/lib/prisma";
import { DIRECTION_HOME_PATH } from "@/lib/regie/access";
import {
  dayKeyOf,
  eventTimeLabel,
  loadDirectionAvailability,
  loadDirectionCasting,
  loadDirectionEvents,
  loadDirectionPeople,
  loadDirectionProps,
  loadDirectionProtocols,
  loadDirectionScenes,
  loadDirectionScript,
} from "@/lib/regie/data";
import {
  directionHref,
  directionPdfHref,
  resolveDirectionPage,
  type DirectionSearchParams,
} from "@/lib/regie/page";
import { touchDirectionVisit } from "@/lib/regie/visits";
import { listDirectionWishes } from "@/lib/regie/wishes";
import { cn } from "@/lib/utils";

export const metadata = { title: "Regie" };

const newer = (date: Date | null | undefined, since: Date | null) =>
  Boolean(since && date && date > since);

/** Regie-Dashboard (docs/Plan/regie-plan.md): Karten statt Menü, Handy zuerst. */
export default async function DirectionDashboardPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const { userId, shows, show } = await resolveDirectionPage(searchParams);

  if (!show) {
    return (
      <div className="space-y-6">
        <PageHeader title="Regie" />
        <DirectionEmpty>
          Du bist noch keiner Produktion als Regie oder Regieassistenz zugeordnet. Bitte wende dich
          an die Produktionsleitung.
        </DirectionEmpty>
      </div>
    );
  }

  const since = await touchDirectionVisit(userId, show.id);
  const [
    wishes,
    events,
    scenes,
    roles,
    availability,
    protocols,
    props,
    script,
    people,
    castChange,
  ] = await Promise.all([
    listDirectionWishes(show.id),
    loadDirectionEvents(show.id),
    loadDirectionScenes(show.id),
    loadDirectionCasting(show.id),
    loadDirectionAvailability(show.id, { from: new Date(), days: 14 }),
    loadDirectionProtocols(show.id, 5),
    loadDirectionProps(show.id),
    loadDirectionScript(show.id),
    loadDirectionPeople(show.id),
    prisma.characterCasting.aggregate({
      where: { character: { showId: show.id } },
      _max: { updatedAt: true },
    }),
  ]);

  const showLabel = `${show.title ?? "Produktion"} ${show.year}`;
  const href = (section: string) => directionHref(section, show.id);
  const pdf = (kind: string) => directionPdfHref(kind, show.id);

  const openWishes = wishes.filter((wish) => wish.status === "open").length;
  const plannedWishes = wishes.filter((wish) => wish.status === "planned").length;
  const nextEvents = events.filter((event) => event.status !== "CANCELLED").slice(0, 3);
  const rehearsals = events.filter((event) => event.rehearsal && event.status !== "CANCELLED");
  const unassigned = roles.filter((role) => !role.castings.length);
  const absentDays = availability.members.reduce(
    (sum, member) =>
      sum + Object.values(member.entries).filter((kind) => kind !== "LIMITED").length,
    0,
  );
  const absentPeople = availability.members.filter((member) =>
    Object.values(member.entries).some((kind) => kind !== "LIMITED"),
  ).length;
  const openTasks = protocols.reduce(
    (sum, protocol) => sum + protocol.notes.filter((n) => n.type === "TASK" && !n.done).length,
    0,
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Regie" description={showLabel} />

      {shows.length > 1 ? (
        <nav aria-label="Produktion wählen" className="flex flex-wrap gap-2">
          {shows.map((entry) => (
            <Link
              key={entry.id}
              href={`${DIRECTION_HOME_PATH}?show=${encodeURIComponent(entry.id)}`}
              aria-current={entry.id === show.id ? "page" : undefined}
              className={cn(
                "min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium",
                entry.id === show.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {entry.title ?? "Produktion"} {entry.year}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DirectionCard
          title="Wünsche an die Planung"
          className="border-primary/40 sm:col-span-2 lg:col-span-1 lg:row-span-2"
          isNew={wishes.some((wish) => newer(new Date(wish.updatedAt), since))}
          summary={
            wishes.length
              ? `${openWishes} offen · ${plannedWishes} eingeplant · ${wishes.length} insgesamt`
              : "Was soll die Probenplanung berücksichtigen? Hier schickst du es ab."
          }
          viewHref={wishes.length ? href("wuensche") : null}
          actions={
            <WishComposer
              showId={show.id}
              scenes={scenes.map((scene) => ({ id: scene.id, label: scene.label }))}
              people={people}
            />
          }
        >
          {wishes.length ? (
            <ul className="space-y-1.5 text-sm">
              {wishes.slice(0, 3).map((wish) => (
                <li key={wish.id} className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`${href("wuensche")}#wunsch-${wish.id}`}
                    className="line-clamp-1 min-w-0 hover:underline"
                  >
                    {wish.text}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {
                      {
                        open: "offen",
                        planned: "eingeplant",
                        done: "erledigt",
                        declined: "abgelehnt",
                      }[wish.status]
                    }
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </DirectionCard>

        <DirectionCard
          title="Nächste Proben"
          isNew={events.some((event) => newer(event.updatedAt, since))}
          summary={
            rehearsals.length
              ? `${rehearsals.length} Proben geplant`
              : "Noch keine kommenden Proben."
          }
          viewHref={events.length ? href("proben") : null}
          pdfHref={events.length ? pdf("termine") : null}
        >
          {nextEvents.length ? (
            <ul className="space-y-2">
              {nextEvents.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <DateBadge date={event.start} />
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="text-muted-foreground">
                      {eventTimeLabel(event)}
                      {event.scenes.length ? ` · Sz. ${event.scenes.join(", ")}` : ""}
                    </p>
                    {event.absent.length ? (
                      <p className="text-warning">fehlen: {event.absent.join(", ")}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </DirectionCard>

        <DirectionCard
          title="Szenen × Personen"
          summary={
            scenes.length
              ? `${scenes.length} Szenen · ${roles.length} Rollen`
              : "Noch keine Szenen angelegt."
          }
          viewHref={scenes.length ? href("szenen") : null}
          pdfHref={scenes.length ? pdf("szenen") : null}
        />

        <DirectionCard
          title="Verfügbarkeit"
          summary={
            absentPeople
              ? `Nächste 2 Wochen: ${absentPeople} Personen fehlen an ${absentDays} Tagen`
              : "Nächste 2 Wochen: niemand hat sich abgemeldet."
          }
          viewHref={href("verfuegbarkeit")}
          pdfHref={pdf("verfuegbarkeit")}
        />

        <DirectionCard
          title="Besetzung"
          isNew={newer(castChange._max.updatedAt, since)}
          summary={
            roles.length
              ? unassigned.length
                ? `${roles.length} Rollen · ${unassigned.length} unbesetzt`
                : `${roles.length} Rollen, alle besetzt`
              : "Noch keine Rollen angelegt."
          }
          viewHref={roles.length ? href("besetzung") : null}
          pdfHref={roles.length ? pdf("besetzung") : null}
        />

        <DirectionCard
          title="Probenprotokolle"
          isNew={protocols.some((protocol) => newer(protocol.updatedAt, since))}
          summary={
            protocols.length
              ? `Zuletzt: ${protocols[0].title}, ${protocols[0].start.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}${openTasks ? ` · ${openTasks} offene Aufgaben` : ""}`
              : "Noch keine Protokolle."
          }
          viewHref={protocols.length ? href("protokolle") : null}
        />

        <DirectionCard
          title="Ausstattung"
          isNew={newer(props.lastChange, since)}
          summary={
            props.total
              ? `${props.total} Stücke · ${props.open} noch nicht fertig`
              : "Noch keine Requisiten oder Kostüme erfasst."
          }
          viewHref={props.scenes.length ? href("ausstattung") : null}
          pdfHref={props.scenes.length ? pdf("ausstattung") : null}
        />

        <DirectionCard
          title="Skript"
          isNew={newer(script?.releasedAt, since)}
          summary={
            script
              ? `Aktuelle Fassung: ${script.label}${script.releasedAt ? ` (${script.releasedAt.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })})` : ""}`
              : "Noch keine Fassung freigegeben."
          }
          pdfHref={script ? pdf("skript") : null}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Stand {dayKeyOf(new Date()).split("-").reverse().join(".")} · Alle Listen sind nur zum
        Lesen. PDFs nur für den internen Gebrauch.
      </p>
    </div>
  );
}
