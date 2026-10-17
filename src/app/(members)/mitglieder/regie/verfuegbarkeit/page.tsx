import { DirectionEmpty, DirectionViewHeader } from "@/components/regie/direction-ui";
import { formatDay, loadDirectionAvailability } from "@/lib/regie/data";
import { resolveDirectionPage, type DirectionSearchParams } from "@/lib/regie/page";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Verfügbarkeit · Regie" };

const DAYS = 14;

/** Wer an welchem Tag fehlt – ohne Gründe (die sieht nur die Planung). */
export default async function DirectionAvailabilityPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const { days, members } = await loadDirectionAvailability(show.id, {
    from: new Date(),
    days: DAYS,
  });
  const byDay = days.map((day) => {
    const absent = members.filter((m) => m.entries[day] && m.entries[day] !== "LIMITED");
    const limited = members.filter((m) => m.entries[day] === "LIMITED");
    return { day, absent, limited };
  });

  return (
    <div className="space-y-5">
      <DirectionViewHeader
        title="Verfügbarkeit"
        description="Nächste 2 Wochen: wer fehlt (ohne Gründe)"
        showId={show.id}
        pdfKind="verfuegbarkeit"
      />
      {members.length ? (
        <ul className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card">
          {byDay.map(({ day, absent, limited }) => (
            <li key={day} className="grid grid-cols-[5.5rem_1fr] gap-3 p-3 text-sm">
              <span className="font-medium tabular-nums">
                {formatDay(new Date(`${day}T12:00:00Z`))}
              </span>
              <span>
                {absent.length ? (
                  <span className="block">
                    <span className="text-destructive">fehlen:</span>{" "}
                    {absent.map((member) => member.name).join(", ")}
                  </span>
                ) : null}
                {limited.length ? (
                  <span className="block">
                    <span className="text-warning">eingeschränkt:</span>{" "}
                    {limited.map((member) => member.name).join(", ")}
                  </span>
                ) : null}
                {!absent.length && !limited.length ? (
                  <span className="text-muted-foreground">alle können</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <DirectionEmpty>Noch keine Mitglieder in dieser Produktion.</DirectionEmpty>
      )}
    </div>
  );
}
