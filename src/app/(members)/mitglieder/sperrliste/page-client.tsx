"use client";

import { useState } from "react";

import type { ClientSperrlisteSettings } from "@/lib/sperrliste-settings";
import type { HolidayRange } from "@/types/holidays";

import type { BlockedDay } from "./block-calendar";
import type { OverviewMember } from "./block-overview";
import { SperrlisteSettingsDialog } from "./settings-dialog";
import { SperrlisteTabs } from "./sperrliste-tabs";

interface SperrlistePageClientProps {
  initialBlockedDays: BlockedDay[];
  initialHolidays: HolidayRange[];
  overviewMembers: OverviewMember[];
  initialSettings: ClientSperrlisteSettings;
  canManageSettings: boolean;
  defaultHolidaySourceUrl: string;
  defaultPublicHolidaySourceUrl: string;
}

export function SperrlistePageClient({
  initialBlockedDays,
  initialHolidays,
  overviewMembers,
  initialSettings,
  canManageSettings,
  defaultHolidaySourceUrl,
  defaultPublicHolidaySourceUrl,
}: SperrlistePageClientProps) {
  const [settings, setSettings] = useState<ClientSperrlisteSettings>(initialSettings);
  const [holidays, setHolidays] = useState<HolidayRange[]>(initialHolidays);
  const [defaultHolidayUrl, setDefaultHolidayUrl] = useState(defaultHolidaySourceUrl);
  const [defaultPublicHolidayUrl, setDefaultPublicHolidayUrl] = useState(
    defaultPublicHolidaySourceUrl,
  );

  return (
    <div className="space-y-6">
      {canManageSettings ? (
        <div className="flex justify-end">
          <SperrlisteSettingsDialog
            settings={settings}
            defaultHolidaySourceUrl={defaultHolidayUrl}
            defaultPublicHolidaySourceUrl={defaultPublicHolidayUrl}
            onSettingsChange={(payload) => {
              setSettings(payload.settings);
              if (payload.holidays) {
                setHolidays(payload.holidays);
              }
              if (payload.defaults?.holidaySourceUrl) {
                setDefaultHolidayUrl(payload.defaults.holidaySourceUrl);
              }
              if (payload.defaults?.publicHolidaySourceUrl) {
                setDefaultPublicHolidayUrl(payload.defaults.publicHolidaySourceUrl);
              }
            }}
          />
        </div>
      ) : null}

      <SperrlisteTabs
        initialBlockedDays={initialBlockedDays}
        holidays={holidays}
        overviewMembers={overviewMembers}
        freezeDays={settings.freezeDays}
        preferredWeekdays={settings.preferredWeekdays}
        exceptionWeekdays={settings.exceptionWeekdays}
      />
    </div>
  );
}
