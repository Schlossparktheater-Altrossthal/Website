import { DirectionEmpty, DirectionViewHeader } from "@/components/regie/direction-ui";
import { DateBadge } from "@/components/ui/date-badge";
import { eventTimeLabel, loadDirectionEvents } from "@/lib/regie/data";
import { resolveDirectionPage, type DirectionSearchParams } from "@/lib/regie/page";
import { cn } from "@/lib/utils";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Proben · Regie" };

export default async function DirectionRehearsalsPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const events = await loadDirectionEvents(show.id);

  return (
    <div className="space-y-5">
      <DirectionViewHeader
        title="Proben & Termine"
        description="Kommende Termine mit Szenen und wer fehlt"
        showId={show.id}
        pdfKind="termine"
      />
      {events.length ? (
        <ul className="space-y-2">
          {events.map((event) => {
            const cancelled = event.status === "CANCELLED";
            return (
              <li
                key={event.id}
                className={cn(
                  "flex gap-3 rounded-xl border border-border/70 bg-card p-3",
                  cancelled && "opacity-60",
                )}
              >
                <DateBadge date={event.start} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className={cn("font-medium", cancelled && "line-through")}>
                    {event.title}
                    {event.status === "TENTATIVE" ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        vorgemerkt
                      </span>
                    ) : null}
                    {cancelled ? (
                      <span className="ml-2 text-xs font-normal text-destructive">abgesagt</span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground">
                    {eventTimeLabel(event)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                  {event.scenes.length ? <p>Szenen: {event.scenes.join(", ")}</p> : null}
                  {event.invited ? (
                    <p className="text-muted-foreground">
                      {event.invited - event.absent.length} von {event.invited} können
                    </p>
                  ) : null}
                  {event.absent.length ? (
                    <p className="text-warning">fehlen: {event.absent.join(", ")}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <DirectionEmpty>Noch keine kommenden Termine.</DirectionEmpty>
      )}
    </div>
  );
}
