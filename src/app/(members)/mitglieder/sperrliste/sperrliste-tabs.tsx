"use client";

import { useMemo } from "react";
import { format, isValid, parseISO } from "date-fns";
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
  freezeUntil?: string | null;
}

export function SperrlisteTabs({
  initialBlockedDays,
  holidays = [],
  overviewMembers,
  freezeUntil,
}: SperrlisteTabsProps) {
  const formattedFreeze = useMemo(() => {
    if (!freezeUntil) return null;
    const parsed = parseISO(freezeUntil);
    if (!isValid(parsed)) {
      return freezeUntil;
    }
    return format(parsed, "EEEE, d. MMMM yyyy", { locale: de });
  }, [freezeUntil]);

  return (
    <Tabs defaultValue="personal" className="space-y-6">
      <TabsList className="mb-6 flex w-full justify-start overflow-x-auto rounded-full bg-background/70 p-1 shadow-inner ring-1 ring-primary/10 backdrop-blur-sm sm:pr-0">
        <TabsTrigger value="personal" className="gap-2 whitespace-nowrap px-5 py-2 text-xs font-semibold uppercase tracking-wide sm:text-sm">
          <CalendarCheck2 className="h-4 w-4 text-muted-foreground/80" aria-hidden />
          <span>Meine Sperrtermine</span>
        </TabsTrigger>
        <TabsTrigger value="overview" className="gap-2 whitespace-nowrap px-5 py-2 text-xs font-semibold uppercase tracking-wide sm:text-sm">
          <UsersRound className="h-4 w-4 text-muted-foreground/80" aria-hidden />
          <span>Übersicht</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="personal" className="space-y-6">
        {formattedFreeze ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            Hinweis: Aus Planungsgründen können Sperrtermine erst ab {formattedFreeze} eingetragen werden.
          </div>
        ) : null}
        <BlockCalendar initialBlockedDays={initialBlockedDays} holidays={holidays} />
      </TabsContent>

      <TabsContent value="overview">
        <BlockOverview members={overviewMembers} holidays={holidays} />
      </TabsContent>
    </Tabs>
  );
}
