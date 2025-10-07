"use client";

import { useMemo, type ReactNode } from "react";
import { addDays, format } from "date-fns";
import { de } from "date-fns/locale/de";

import { CalendarCheck2, UsersRound } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlockCalendar, type BlockedDay } from "./block-calendar";
import { BlockOverview, type OverviewMember } from "./block-overview";
import type { HolidayRange } from "@/types/holidays";

interface SperrlisteTabsProps {
  initialBlockedDays: BlockedDay[];
  holidays?: HolidayRange[];
  overviewMembers: OverviewMember[];
  freezeDays?: number;
  preferredWeekdays?: number[];
  exceptionWeekdays?: number[];
  canExport?: boolean;
  actions?: ReactNode;
}

export function SperrlisteTabs({
  initialBlockedDays,
  holidays = [],
  overviewMembers,
  freezeDays = 0,
  preferredWeekdays = [],
  exceptionWeekdays = [],
  canExport = false,
  actions,
}: SperrlisteTabsProps) {
  const formattedFreeze = useMemo(() => {
    if (!freezeDays || freezeDays <= 0) {
      return null;
    }
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const freezeUntil = addDays(startOfToday, freezeDays);
    return format(freezeUntil, "EEEE, d. MMMM yyyy", { locale: de });
  }, [freezeDays]);

  return (
    <Tabs defaultValue="personal" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {actions ? (
          <div className="order-1 flex justify-end sm:order-2 sm:flex-none sm:justify-end">
            {actions}
          </div>
        ) : null}
        <TabsList className="order-2 flex w-full justify-start overflow-x-auto rounded-full bg-background/70 p-1 shadow-inner ring-1 ring-primary/10 backdrop-blur-sm sm:order-1 sm:w-auto sm:flex-1 sm:pr-0">
          <TabsTrigger value="personal" className="gap-2 whitespace-nowrap px-5 py-2 text-xs font-semibold uppercase tracking-wide sm:text-sm">
            <CalendarCheck2 className="h-4 w-4 text-muted-foreground/80" aria-hidden />
            <span>Meine Sperrtermine</span>
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-2 whitespace-nowrap px-5 py-2 text-xs font-semibold uppercase tracking-wide sm:text-sm">
            <UsersRound className="h-4 w-4 text-muted-foreground/80" aria-hidden />
            <span>Übersicht</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="personal" className="space-y-6">
        {formattedFreeze ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            Hinweis: Aus Planungsgründen können Sperrtermine erst ab {formattedFreeze} eingetragen werden.
          </div>
        ) : null}
        <BlockCalendar
          initialBlockedDays={initialBlockedDays}
          holidays={holidays}
          freezeDays={freezeDays}
          preferredWeekdays={preferredWeekdays}
          exceptionWeekdays={exceptionWeekdays}
        />
      </TabsContent>

      <TabsContent value="overview">
        <BlockOverview
          members={overviewMembers}
          holidays={holidays}
          preferredWeekdays={preferredWeekdays}
          exceptionWeekdays={exceptionWeekdays}
          canExport={canExport}
        />
      </TabsContent>
    </Tabs>
  );
}
