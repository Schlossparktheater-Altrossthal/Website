"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ProductionStatus } from "@prisma/client";
import { toast } from "sonner";

import { switchProductionAction } from "@/app/(members)/mitglieder/produktionen/actions/production";
import { ProductionStatusPill } from "@/components/production/production-status-pill";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  LoadingIcon,
  PlusIcon,
  SettingsIcon,
} from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { PRODUCTION_STATUS_LABELS } from "@/lib/produktionen/status";
import { cn } from "@/lib/utils";

export type SwitcherProduction = {
  id: string;
  title: string | null;
  year: number;
  status: ProductionStatus;
};

const GROUPS: { label: string; statuses: ProductionStatus[] }[] = [
  { label: "Läuft", statuses: ["active"] },
  { label: "In Planung", statuses: ["planning"] },
  { label: "Vergangen", statuses: ["finished", "archived"] },
];

const MANAGE_HREF = "/mitglieder/produktionen?verwalten=1";

function productionTitle(production: { title: string | null; year: number }) {
  return production.title?.trim() || `Produktion ${production.year}`;
}

function YearTile({ year, className }: { year: number; className?: string }) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-[13px] font-semibold tabular-nums text-foreground/80",
        className,
      )}
    >
      {String(year).slice(-2)}
    </div>
  );
}

/**
 * Wechsler oben in der Seitenleiste (docs/Plan/produktionen-wechsler-plan.md):
 * ein Tipp zeigt eine andere Produktion an und springt auf die gleichwertige Seite.
 * Desktop als Popover, mobil als Blatt von unten.
 */
export function ProductionSwitcher({
  activeProductionId,
  productions,
  canManage,
  isCollapsed,
  isMobile,
}: {
  activeProductionId: string | null;
  productions: SwitcherProduction[];
  canManage: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const active = productions.find((production) => production.id === activeProductionId) ?? null;
  const canSwitch = canManage || productions.length > 1;

  if (!active && !canManage && productions.length === 0) return null;

  const select = (production: SwitcherProduction) => {
    if (production.id === activeProductionId) {
      setOpen(false);
      return;
    }
    setPendingId(production.id);
    startTransition(async () => {
      const result = await switchProductionAction(production.id, pathname);
      if (!result.ok) {
        toast.error(result.error);
        setPendingId(null);
        return;
      }
      setOpen(false);
      setPendingId(null);
      router.push(result.target);
      router.refresh();
    });
  };

  const trigger = (
    <SidebarMenuButton
      size="lg"
      aria-label={
        active ? `Angezeigte Produktion: ${productionTitle(active)}` : "Produktion wählen"
      }
      onClick={canSwitch && isMobile ? () => setOpen(true) : undefined}
      disabled={!canSwitch}
      className={cn(
        "h-auto items-center gap-[var(--space-2xs)] px-[var(--space-xs)] py-[var(--space-2xs)] disabled:opacity-100",
        isCollapsed && "justify-center px-0",
      )}
      tooltip={isCollapsed ? (active ? productionTitle(active) : "Produktion wählen") : undefined}
    >
      <YearTile
        year={active?.year ?? 0}
        className={cn(
          "border-sidebar-border/60 bg-sidebar/70 text-sidebar-foreground/80",
          isCollapsed && "size-8 text-xs",
          !active && "text-transparent",
        )}
      />
      {!isCollapsed ? (
        <div className="flex min-w-0 flex-1 flex-col text-left">
          <span className="truncate text-sm font-semibold leading-5 text-sidebar-foreground">
            {active ? productionTitle(active) : "Produktion wählen"}
          </span>
          <span className="truncate text-xs text-sidebar-foreground/70">
            {active
              ? `${active.year} · ${PRODUCTION_STATUS_LABELS[active.status]}`
              : "Noch keine ausgewählt"}
          </span>
        </div>
      ) : null}
      {!isCollapsed && canSwitch ? (
        <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/60" />
      ) : null}
    </SidebarMenuButton>
  );

  const list = (
    <div className="space-y-3">
      {GROUPS.map((group) => {
        const items = productions.filter((production) =>
          group.statuses.includes(production.status),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="px-2 pb-1 text-eyebrow uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((production) => {
                const isActive = production.id === activeProductionId;
                const isLoading = isPending && pendingId === production.id;
                return (
                  <li key={production.id}>
                    <button
                      type="button"
                      onClick={() => select(production)}
                      disabled={isPending}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait",
                        isActive && "bg-accent/60",
                      )}
                    >
                      <YearTile year={production.year} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {productionTitle(production)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Jahrgang {production.year}
                        </span>
                      </span>
                      {group.statuses.length > 1 ? (
                        <ProductionStatusPill status={production.status} />
                      ) : null}
                      <span className="flex size-5 shrink-0 items-center justify-center">
                        {isLoading ? (
                          <LoadingIcon className="size-4 animate-spin text-muted-foreground" />
                        ) : isActive ? (
                          <CheckIcon className="size-4 text-primary" />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {productions.length === 0 ? (
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">
          Noch keine Produktion angelegt.
        </p>
      ) : null}
    </div>
  );

  const footer = canManage ? (
    <div className="flex flex-col gap-0.5">
      <Link
        href={`${MANAGE_HREF}&neu=1`}
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition hover:bg-accent"
      >
        <span className="flex size-9 items-center justify-center rounded-md border border-dashed border-border">
          <PlusIcon className="size-4" />
        </span>
        Neue Produktion
      </Link>
      <Link
        href={MANAGE_HREF}
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <span className="flex size-9 items-center justify-center">
          <SettingsIcon className="size-4" />
        </span>
        Alle Produktionen verwalten
      </Link>
    </div>
  ) : null;

  return (
    <SidebarGroup className={cn(!isCollapsed && "pt-[var(--space-2xs)]")}>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            {isMobile || !canSwitch ? (
              <>
                {trigger}
                <BottomSheet
                  open={open}
                  onOpenChange={setOpen}
                  title="Produktion wechseln"
                  description="Wähle, welche Produktion du sehen möchtest."
                  footer={footer}
                >
                  {list}
                </BottomSheet>
              </>
            ) : (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                <PopoverContent
                  align="start"
                  side={isCollapsed ? "right" : "bottom"}
                  className="w-80 p-2"
                >
                  <div className="max-h-[60vh] overflow-y-auto">{list}</div>
                  {footer ? <div className="mt-2 border-t border-border pt-2">{footer}</div> : null}
                </PopoverContent>
              </Popover>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
