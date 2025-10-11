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
  readOnly?: boolean;
  readOnlyMessage?: string;
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
  readOnly = false,
  readOnlyMessage,
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
    <Tabs defaultValue="personal" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="order-2 flex w-full gap-1.5 bg-muted/50 p-1 sm:order-1 sm:w-auto">
          <TabsTrigger
            value="personal"
            className="flex-1 gap-2 px-3 py-1.5 text-sm sm:flex-none"
          >
            <CalendarCheck2 className="h-4 w-4" aria-hidden />
            <span>Meine Sperrtermine</span>
          </TabsTrigger>
          <TabsTrigger
            value="overview"
            className="flex-1 gap-2 px-3 py-1.5 text-sm sm:flex-none"
          >
            <UsersRound className="h-4 w-4" aria-hidden />
            <span>Übersicht</span>
          </TabsTrigger>
        </TabsList>
        {actions ? (
          <div className="order-1 flex w-full justify-end sm:order-2 sm:w-auto">
            {actions}
          </div>
        ) : null}
      </div>

      <TabsContent value="personal" className="space-y-4">
        {formattedFreeze ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
            Sperrtermine können ab {formattedFreeze} eingetragen werden.
          </div>
        ) : null}
        <BlockCalendar
          initialBlockedDays={initialBlockedDays}
          holidays={holidays}
          freezeDays={freezeDays}
          preferredWeekdays={preferredWeekdays}
          exceptionWeekdays={exceptionWeekdays}
          readOnly={readOnly}
          readOnlyMessage={readOnlyMessage}
        />
      </TabsContent>

      <TabsContent value="overview">
        <BlockOverview
          members={overviewMembers}
          holidays={holidays}
          preferredWeekdays={preferredWeekdays}
          exceptionWeekdays={exceptionWeekdays}
          canExport={canExport}
          readOnly={readOnly}
        />
      </TabsContent>
    </Tabs>
  );
}
