import { SectionNav } from "@/components/ui/section-nav";
import type { TicketActor } from "@/lib/karten/access";
import { withShowParam } from "@/lib/karten/context";

export type TicketsSection = "buero" | "einlass" | "einstellungen";

/** Bereiche Kartenbüro / Einlass / Einstellungen – im Mitgliederbereich oder unter /kartenbuero. */
export function TicketsNav({
  actor,
  basePath,
  active,
  showId,
}: {
  actor: TicketActor;
  basePath: string;
  active: TicketsSection;
  showId: string | null;
}) {
  const items = [
    ...(actor.canOffice
      ? [{ id: "buero", label: "Reservierungen", href: withShowParam(basePath, showId) }]
      : []),
    ...(actor.canCheckIn
      ? [{ id: "einlass", label: "Einlass", href: withShowParam(`${basePath}/einlass`, showId) }]
      : []),
    ...(actor.canManage
      ? [
          {
            id: "einstellungen",
            label: "Einstellungen",
            href: withShowParam(`${basePath}/einstellungen`, showId),
          },
        ]
      : []),
  ];
  if (items.length < 2) return null;
  return <SectionNav items={items} activeId={active} ariaLabel="Kartenbereiche" />;
}
