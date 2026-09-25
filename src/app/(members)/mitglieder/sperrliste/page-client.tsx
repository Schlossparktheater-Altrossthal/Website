"use client";

import { useCallback, useState } from "react";

import { CalendarCheckIcon, CalendarPlusIcon, UsersRoundIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CalendarEntry } from "@/lib/calendar/event-kinds";
import type { FinalWeekRange } from "@/lib/sperrliste/day-tiers";
import { toDayKey } from "@/lib/sperrliste/day-tiers";
import type { ClientSperrlisteSettings } from "@/lib/sperrliste-settings";
import type { HolidayRange } from "@/types/holidays";

import { EventDialog, type EventDialogState } from "./event-dialog";
import { ExportButton } from "./export-button";
import { MyCalendar } from "./my-calendar";
import { BlocklistSettingsDialog } from "./settings-dialog";
import { TeamView } from "./team-view";
import type { MyBlockedDay, TeamEntry, TeamMember } from "./types";
import { useCalendarModel } from "./use-calendar-model";
import { useMyEntries } from "./use-my-entries";

export type BlocklistPageData = {
  currentUserId: string;
  myEntries: MyBlockedDay[];
  members: TeamMember[];
  teamEntries: TeamEntry[];
  holidays: HolidayRange[];
  calendarEntries: CalendarEntry[];
  finalWeek: FinalWeekRange;
  settings: ClientSperrlisteSettings;
  defaultHolidaySourceUrl: string;
  defaultPublicHolidaySourceUrl: string;
  /** Plant: sieht Gründe, pflegt Termine. */
  canPlan: boolean;
  canManageSettings: boolean;
  canExport: boolean;
  readOnly: boolean;
};

export function BlocklistPageClient({ data }: { data: BlocklistPageData }) {
  const [tab, setTab] = useState("mine");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [settings, setSettings] = useState(data.settings);
  const [holidays, setHolidays] = useState(data.holidays);
  const [defaults, setDefaults] = useState({
    holiday: data.defaultHolidaySourceUrl,
    publicHoliday: data.defaultPublicHolidaySourceUrl,
  });
  const [teamEntries, setTeamEntries] = useState(data.teamEntries);
  const [calendarEntries, setCalendarEntries] = useState(data.calendarEntries);
  const [eventDialog, setEventDialog] = useState<EventDialogState>(null);

  const { entries, setDay, addRange, pendingKey } = useMyEntries({
    initialEntries: data.myEntries,
    currentUserId: data.currentUserId,
    showReasonsInTeam: data.canPlan,
    onTeamChange: setTeamEntries,
  });

  const model = useCalendarModel({
    month,
    holidays,
    calendarEntries,
    teamEntries,
    finalWeek: data.finalWeek,
    preferredWeekdays: settings.preferredWeekdays,
    exceptionWeekdays: settings.exceptionWeekdays,
    freezeDays: settings.freezeDays,
  });

  const openCreate = useCallback((date: string) => setEventDialog({ mode: "create", date }), []);
  const openEdit = useCallback(
    (entry: CalendarEntry) => setEventDialog({ mode: "edit", entry }),
    [],
  );

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {data.canPlan && !data.readOnly ? (
        <Button type="button" size="sm" onClick={() => openCreate(toDayKey(new Date()))}>
          <CalendarPlusIcon className="h-4 w-4" aria-hidden />
          Termin
        </Button>
      ) : null}
      {data.canExport && !data.readOnly && tab === "team" ? (
        <ExportButton
          members={data.members}
          entries={teamEntries}
          holidays={holidays}
          finalWeek={data.finalWeek}
          preferredWeekdays={settings.preferredWeekdays}
          exceptionWeekdays={settings.exceptionWeekdays}
        />
      ) : null}
      {data.canManageSettings && !data.readOnly ? (
        <BlocklistSettingsDialog
          settings={settings}
          defaultHolidaySourceUrl={defaults.holiday}
          defaultPublicHolidaySourceUrl={defaults.publicHoliday}
          onSettingsChange={(payload) => {
            setSettings(payload.settings);
            if (payload.holidays) setHolidays(payload.holidays);
            if (payload.defaults) {
              setDefaults((current) => ({
                holiday: payload.defaults?.holidaySourceUrl ?? current.holiday,
                publicHoliday: payload.defaults?.publicHolidaySourceUrl ?? current.publicHoliday,
              }));
            }
          }}
        />
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      {data.readOnly ? (
        <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm text-warning-foreground">
          Offline-Demo: Änderungen werden nicht gespeichert.
        </div>
      ) : null}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="mine" className="gap-2">
              <CalendarCheckIcon className="h-4 w-4" aria-hidden />
              Mein Kalender
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <UsersRoundIcon className="h-4 w-4" aria-hidden />
              Team
            </TabsTrigger>
          </TabsList>
          {actions}
        </div>

        <TabsContent value="mine">
          <MyCalendar
            month={month}
            onMonthChange={setMonth}
            model={model}
            entries={entries}
            pendingKey={pendingKey}
            readOnly={data.readOnly}
            freezeDays={settings.freezeDays}
            canPlan={data.canPlan}
            onSetDay={setDay}
            onAddRange={addRange}
            onCreateEvent={openCreate}
            onEditEvent={openEdit}
          />
        </TabsContent>
        <TabsContent value="team">
          <TeamView
            month={month}
            onMonthChange={setMonth}
            model={model}
            members={data.members}
            canPlan={data.canPlan}
            readOnly={data.readOnly}
            onCreateEvent={openCreate}
            onEditEvent={openEdit}
          />
        </TabsContent>
      </Tabs>

      <EventDialog
        state={eventDialog}
        onClose={() => setEventDialog(null)}
        onSaved={(entry, previousId) =>
          setCalendarEntries((current) =>
            [...current.filter((item) => item.id !== (previousId ?? entry.id)), entry].sort(
              (a, b) => a.start.localeCompare(b.start),
            ),
          )
        }
        onDeleted={(id) =>
          setCalendarEntries((current) =>
            current.filter((item) => !(item.source === "event" && item.id === id)),
          )
        }
      />
    </div>
  );
}
