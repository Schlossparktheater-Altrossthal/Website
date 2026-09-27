import { CalendarIcon } from "@/components/ui/action-icons";
import type { MyEventBucket, MyEventItem } from "@/lib/calendar/my-events";

import { MyEventRow } from "./my-event-row";

const BUCKET_LABELS: Record<MyEventBucket, string> = {
  today: "Heute & Morgen",
  week: "Diese Woche",
  later: "Später",
  past: "Vergangen",
};

/** Reihenfolge der Abschnitte; „Vergangen" steht nur in der Vergangenheitsansicht ganz unten. */
const BUCKET_ORDER: MyEventBucket[] = ["today", "week", "later", "past"];

/** Leerzustand nach dem Muster aus `docs/design-system.md`: zentriert, gedämpft, Icon optional. */
function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        In dieser Auswahl stehen gerade keine Termine an.
      </div>
    );
  }

  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <CalendarIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
      <p>Sobald du zu Terminen eingeladen wirst, erscheinen sie hier.</p>
    </div>
  );
}

/**
 * Liste der eigenen Termine, nach Zeitabschnitten gruppiert. Die Filterleiste steht in der
 * Werkzeugzeile der Seite; hier wird nur nach dem dort gewählten Bereich gefiltert.
 */
export function MyEventsList({
  items,
  activeGroup,
}: {
  items: MyEventItem[];
  activeGroup: string;
}) {
  const visible =
    activeGroup === "all" ? items : items.filter((item) => item.group === activeGroup);

  return (
    <div className="space-y-4">
      {visible.length ? (
        <div className="space-y-6">
          {BUCKET_ORDER.map((bucket) => {
            const bucketItems = visible.filter((item) => item.bucket === bucket);
            if (!bucketItems.length) return null;
            return (
              <section key={bucket} className="space-y-1">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {BUCKET_LABELS[bucket]} ({bucketItems.length})
                </h3>
                <ul>
                  {bucketItems.map((item) => (
                    <MyEventRow key={`${item.group}-${item.id}`} item={item} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState filtered={items.length > 0} />
      )}
    </div>
  );
}
