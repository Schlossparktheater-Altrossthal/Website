"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { switchProductionAction } from "@/app/(members)/mitglieder/produktionen/actions/production";
import type { SwitcherProduction } from "@/components/production/production-switcher";
import { InfoIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";

function productionTitle(production: { title: string | null; year: number }) {
  return production.title?.trim() || `Produktion ${production.year}`;
}

/**
 * Dezente Leiste, wenn eine abgeschlossene oder archivierte Produktion angezeigt wird –
 * damit niemand aus Versehen im alten Jahrgang plant.
 */
export function PastProductionBanner({
  activeProductionId,
  productions,
}: {
  activeProductionId: string | null;
  productions: SwitcherProduction[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const active = productions.find((production) => production.id === activeProductionId);
  if (!active || active.status === "active" || active.status === "planning") return null;
  const current =
    productions.find((production) => production.status === "active") ??
    productions.find((production) => production.status === "planning");

  const switchToCurrent = () => {
    if (!current) return;
    startTransition(async () => {
      const result = await switchProductionAction(current.id, pathname);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(result.target);
      router.refresh();
    });
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
    >
      <InfoIcon className="size-4 shrink-0 text-warning" />
      <p className="min-w-0 flex-1">
        Du siehst <span className="font-medium">{productionTitle(active)}</span> – diese Produktion
        ist {active.status === "archived" ? "archiviert" : "abgeschlossen"}.
      </p>
      {current ? (
        <Button size="sm" variant="outline" disabled={isPending} onClick={switchToCurrent}>
          Zu {productionTitle(current)}
        </Button>
      ) : null}
    </div>
  );
}
