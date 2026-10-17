import Link from "next/link";

import { PLANNER_WISHES_PATH, listWishesForEvent } from "@/lib/regie/wishes";

/** Termin-Editor: offene Regie-Wünsche, die zu diesem Tag passen (docs/Plan/regie-plan.md). */
export async function EventWishHint({
  showId,
  eventId,
  dayKey,
}: {
  showId: string;
  eventId: string;
  dayKey: string;
}) {
  const wishes = await listWishesForEvent(showId, eventId, dayKey);
  if (!wishes.length) return null;
  return (
    <section className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Regie-Wünsche für diesen Tag</h2>
        <Link href={PLANNER_WISHES_PATH} className="text-primary hover:underline">
          Alle Wünsche
        </Link>
      </div>
      <ul className="mt-1.5 space-y-1">
        {wishes.map((wish) => (
          <li key={wish.id}>
            <Link href={`${PLANNER_WISHES_PATH}#wunsch-${wish.id}`} className="hover:underline">
              {wish.plannedHere ? "✓ " : "• "}
              {wish.text}
            </Link>
            {wish.scenes.length ? (
              <span className="text-muted-foreground"> · Sz. {wish.scenes.join(", ")}</span>
            ) : null}
            {wish.plannedHere ? (
              <span className="text-info"> · in diesem Termin eingeplant</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
