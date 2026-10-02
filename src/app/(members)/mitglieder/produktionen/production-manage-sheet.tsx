"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ProductionStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PRODUCTION_STATUS_LABELS } from "@/lib/produktionen/status";

import {
  CreateProductionDialog,
  SetActiveProductionForm,
  UpdateProductionDialog,
} from "./production-forms-client";
import { ProductionStatusForm } from "./production-status-form";

export const MANAGE_PARAM = "verwalten";

type ManagedShow = {
  id: string;
  year: number;
  title: string | null;
  synopsis: string | null;
  dates: unknown;
  revealedAt: string | null;
  status: ProductionStatus;
};

/**
 * „Produktionen verwalten“ aus dem Wechsler der Seitenleiste: anlegen, aktiv setzen,
 * Status ändern und bearbeiten – ersetzt die frühere Kartenliste der Übersicht.
 * Offen, solange `?verwalten=1` in der Adresse steht.
 */
export function ProductionManageSheet({
  shows,
  activeShowId,
  suggestedYear,
}: {
  shows: ManagedShow[];
  activeShowId: string | null;
  suggestedYear: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get(MANAGE_PARAM) === "1";
  const redirectPath = `${pathname}?${MANAGE_PARAM}=1`;

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete(MANAGE_PARAM);
    const query = next.toString();
    // Nur die Adresse ändern: kein Server-Neuladen, man bleibt an derselben Stelle der Seite.
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Produktionen verwalten</SheetTitle>
          <SheetDescription className="sr-only">
            Produktionen anlegen, aktiv setzen und archivieren
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <CreateProductionDialog
            redirectPath={redirectPath}
            suggestedYear={suggestedYear}
            shouldSetActiveByDefault={!activeShowId}
            trigger={<Button className="w-full">Neue Produktion anlegen</Button>}
          />
          <ul className="divide-y divide-border rounded-lg border border-border">
            {shows.map((show) => {
              const title = show.title?.trim() || `Produktion ${show.year}`;
              const isActive = show.id === activeShowId;
              return (
                <li key={show.id} className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">Jahrgang {show.year}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      <Badge variant="outline">{PRODUCTION_STATUS_LABELS[show.status]}</Badge>
                      {isActive ? <Badge>Ausgewählt</Badge> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isActive ? (
                      <SetActiveProductionForm
                        showId={show.id}
                        showTitle={title}
                        redirectPath={redirectPath}
                        isActive={isActive}
                      />
                    ) : null}
                    <ProductionStatusForm
                      showId={show.id}
                      showTitle={title}
                      status={show.status}
                      redirectPath={redirectPath}
                    />
                    <UpdateProductionDialog
                      show={show}
                      redirectPath={redirectPath}
                      trigger={
                        <Button size="sm" variant="ghost">
                          Bearbeiten
                        </Button>
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
