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
    <Tabs defaultValue="personal" className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="inline-flex w-full flex-col gap-2 rounded-2xl border border-border/60 bg-background/80 p-2 shadow-sm ring-1 ring-primary/10 backdrop-blur-sm sm:w-auto sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-full sm:border-transparent sm:bg-background/40 sm:p-1.5 sm:shadow-inner">
          <TabsTrigger
            value="personal"
            className="w-full justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground transition sm:w-auto sm:justify-start sm:rounded-full sm:px-5 sm:py-2 sm:text-sm sm:uppercase sm:tracking-wide"
          >
            <CalendarCheck2 className="h-4 w-4 text-muted-foreground/80" aria-hidden />
            <span>Meine Sperrtermine</span>
          </TabsTrigger>
          <TabsTrigger
            value="overview"
            className="w-full justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground transition sm:w-auto sm:justify-start sm:rounded-full sm:px-5 sm:py-2 sm:text-sm sm:uppercase sm:tracking-wide"
          >
            <UsersRound className="h-4 w-4 text-muted-foreground/80" aria-hidden />
            <span>Übersicht</span>
          </TabsTrigger>
        </TabsList>
        {actions ? (
          <div className="w-full sm:w-auto sm:flex-none">
            <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
              {actions}
            </div>
          </div>
        ) : null}
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
