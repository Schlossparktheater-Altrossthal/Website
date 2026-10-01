import Link from "next/link";

import { PageHeader } from "@/components/members/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionNav } from "@/components/ui/section-nav";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { daysUntil, formatCountdown } from "@/lib/planning/schedule";
import { PRODUCTION_STATUS_LABELS } from "@/lib/produktionen/status";
import type { ProductionStatus } from "@prisma/client";

export type ProductionTab = "plan" | "gewerke" | "stueck" | "zuweisung" | "rueckmeldungen";

const TABS: { id: ProductionTab; label: string; href: string; managerOnly: boolean }[] = [
  { id: "plan", label: "Plan", href: "/mitglieder/produktionen", managerOnly: false },
  { id: "gewerke", label: "Gewerke", href: "/mitglieder/produktionen/gewerke", managerOnly: false },
  { id: "stueck", label: "Stück", href: "/mitglieder/produktionen/stueck", managerOnly: true },
  {
    id: "zuweisung",
    label: "Zuweisung",
    href: "/mitglieder/produktionen/zuweisung",
    managerOnly: true,
  },
  {
    id: "rueckmeldungen",
    label: "Rückmeldungen",
    href: "/mitglieder/produktionen/rueckmeldungen-auswertung",
    managerOnly: true,
  },
];

const PREMIERE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

type ProductionHeaderProps = {
  production: {
    id: string;
    title: string | null;
    year: number;
    status?: ProductionStatus | null;
    premiereAt?: Date | null;
  } | null;
  active: ProductionTab;
  /** Produktionsverwaltung: alle Tabs und „Bearbeiten“. */
  canManage: boolean;
  /** Tabs, die trotz fehlender Produktionsverwaltung sichtbar sein sollen (z. B. Zuweisung für Gewerk-Leitungen). */
  extraTabs?: ProductionTab[];
};

/**
 * Kopf aller Produktionsseiten (docs/Plan/projektplanung-plan.md, „Neue Produktionsseite“):
 * Titel, Status, Premiere mit Countdown und die Tabs. Die Produktionsauswahl bleibt im
 * Wechsler der Seitenleiste.
 */
export function ProductionHeader({
  production,
  active,
  canManage,
  extraTabs = [],
}: ProductionHeaderProps) {
  const title = production
    ? production.title?.trim() || `Produktion ${production.year}`
    : "Produktion";
  const premiere = production?.premiereAt ?? null;
  const countdown = formatCountdown(daysUntil(premiere));
  // Die Premiere ist ein Kalendertag (UTC-Mitternacht) – deshalb in UTC formatieren.
  const description = production
    ? premiere
      ? `Premiere ${PREMIERE_FORMAT.format(premiere)} · ${countdown}`
      : `Jahrgang ${production.year} · Premiere noch offen`
    : undefined;
  const tabs = TABS.filter(
    (tab) => canManage || !tab.managerOnly || extraTabs.includes(tab.id) || tab.id === active,
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title={title}
        description={description}
        status={
          production?.status ? (
            <Badge variant="outline">{PRODUCTION_STATUS_LABELS[production.status]}</Badge>
          ) : undefined
        }
        actions={
          canManage && production ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/mitglieder/produktionen/${production.id}`}>Bearbeiten</Link>
            </Button>
          ) : undefined
        }
        breadcrumbs={[membersNavigationBreadcrumb("/mitglieder/produktionen")]}
      />
      {tabs.length > 1 ? (
        <SectionNav
          items={tabs.map(({ id, label, href }) => ({ id, label, href }))}
          activeId={active}
          ariaLabel="Produktionsbereiche"
        />
      ) : null}
    </div>
  );
}
