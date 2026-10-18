"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductionStatus } from "@prisma/client";
import { toast } from "sonner";

import { ProductionStatusPill } from "@/components/production/production-status-pill";
import { CheckIcon, ChevronRightIcon, PlusIcon } from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list-row";

import { switchProductionAction } from "../actions/production";
import { CreateProductionForm, UpdateProductionForm } from "../production-forms-client";
import { ProductionStatusControl } from "./production-status-control";

export type ManagedProduction = {
  id: string;
  year: number;
  title: string | null;
  synopsis: string | null;
  dates: unknown;
  revealedAt: string | null;
  premiereAt: string | null;
  status: ProductionStatus;
  memberCount: number;
};

const PAGE_PATH = "/mitglieder/produktionen/verwalten";

const GROUPS: { id: string; label: string; statuses: ProductionStatus[]; collapsed?: boolean }[] = [
  { id: "active", label: "Läuft", statuses: ["active"] },
  { id: "planning", label: "In Planung", statuses: ["planning"] },
  { id: "finished", label: "Abgeschlossen", statuses: ["finished"] },
  { id: "archived", label: "Archiviert", statuses: ["archived"], collapsed: true },
];

// Die Premiere ist ein Kalendertag (UTC-Mitternacht) – deshalb in UTC formatieren.
const PREMIERE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function productionTitle(show: { title: string | null; year: number }) {
  return show.title?.trim() || `Produktion ${show.year}`;
}

function describe(show: ManagedProduction) {
  const parts = [
    show.premiereAt
      ? `Premiere ${PREMIERE_FORMAT.format(new Date(show.premiereAt))}`
      : "Premiere offen",
    show.memberCount === 1 ? "1 Person" : `${show.memberCount} Personen`,
  ];
  return parts.join(" · ");
}

function YearTile({ year }: { year: number }) {
  return (
    <span className="flex size-10 flex-col items-center justify-center rounded-md border border-border/60 bg-muted/60 leading-none">
      <span className="text-[10px] text-muted-foreground">{String(year).slice(0, 2)}</span>
      <span className="text-base font-semibold tabular-nums">{String(year).slice(-2)}</span>
    </span>
  );
}

export function ProductionsManager({
  shows,
  activeShowId,
  suggestedYear,
  openCreate,
}: {
  shows: ManagedProduction[];
  activeShowId: string | null;
  suggestedYear: number;
  openCreate: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(openCreate);
  const [editId, setEditId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isSwitching, startSwitch] = useTransition();
  const editing = shows.find((show) => show.id === editId) ?? null;

  const closeCreate = (open: boolean) => {
    setCreateOpen(open);
    if (!open && openCreate) router.replace(PAGE_PATH, { scroll: false });
  };

  const showProduction = (show: ManagedProduction) => {
    startSwitch(async () => {
      const result = await switchProductionAction(show.id, PAGE_PATH);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Angezeigt: ${productionTitle(show)}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
          <PlusIcon className="size-4" />
          Neue Produktion
        </Button>
      </div>

      {shows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Noch keine Produktion angelegt.
        </p>
      ) : null}

      {GROUPS.map((group) => {
        const items = shows.filter((show) => group.statuses.includes(show.status));
        if (items.length === 0) return null;
        const collapsed = group.collapsed && !showArchived;
        return (
          <section key={group.id} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-eyebrow uppercase tracking-wide text-muted-foreground">
                {group.label} <span className="tabular-nums">· {items.length}</span>
              </h2>
              {group.collapsed ? (
                <button
                  type="button"
                  onClick={() => setShowArchived((value) => !value)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {showArchived ? "Ausblenden" : "Anzeigen"}
                </button>
              ) : null}
            </div>
            {collapsed ? null : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {items.map((show) => {
                  const isActive = show.id === activeShowId;
                  return (
                    <li key={show.id}>
                      <ListRow
                        onClick={() => setEditId(show.id)}
                        leading={<YearTile year={show.year} />}
                        title={productionTitle(show)}
                        description={describe(show)}
                        trailing={
                          <>
                            {isActive ? (
                              <span className="hidden items-center gap-1 text-primary sm:inline-flex">
                                <CheckIcon className="size-3.5" />
                                Angezeigt
                              </span>
                            ) : null}
                            {group.statuses.length > 1 ? (
                              <ProductionStatusPill status={show.status} />
                            ) : null}
                          </>
                        }
                        aria-current={isActive ? "true" : undefined}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <BottomSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditId(null)}
        title={editing ? productionTitle(editing) : "Produktion"}
        description="Status, Anzeige und Stammdaten der Produktion"
      >
        {editing ? (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Status</h3>
              <ProductionStatusControl
                key={`${editing.id}-${editing.status}`}
                showId={editing.id}
                showTitle={productionTitle(editing)}
                status={editing.status}
              />
            </section>

            <section className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
              {editing.id === activeShowId ? (
                <p className="flex items-center gap-2 text-sm">
                  <CheckIcon className="size-4 text-primary" />
                  Wird dir gerade angezeigt
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Du siehst gerade eine andere Produktion.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSwitching}
                    onClick={() => showProduction(editing)}
                  >
                    Anzeigen
                  </Button>
                </>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Stammdaten</h3>
              <UpdateProductionForm
                key={editing.id}
                show={editing}
                redirectPath={PAGE_PATH}
                onSuccess={() => {
                  setEditId(null);
                  router.refresh();
                }}
              />
            </section>

            <Link
              href={`/mitglieder/produktionen/${editing.id}`}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm transition hover:bg-muted/50"
            >
              <span>
                <span className="block font-medium">Premiere, Endprobenwoche &amp; Onboarding</span>
                <span className="block text-xs text-muted-foreground">
                  Weitere Einstellungen der Produktion
                </span>
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </Link>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={createOpen}
        onOpenChange={closeCreate}
        title="Neue Produktion"
        description="Jahr und Titel genügen – alles Weitere kannst du später ergänzen."
        showDescription
      >
        <CreateProductionForm
          suggestedYear={suggestedYear}
          shouldSetActiveByDefault
          redirectPath={PAGE_PATH}
          onSuccess={() => {
            closeCreate(false);
            router.refresh();
          }}
        />
      </BottomSheet>
    </div>
  );
}
