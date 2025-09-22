"use client";

import { useState } from "react";

import type { ClientSperrlisteSettings } from "@/lib/sperrliste-settings";
import type { HolidayRange } from "@/types/holidays";

import type { BlockedDay } from "./block-calendar";
import type { OverviewMember } from "./block-overview";
import { SperrlisteSettingsManager } from "./settings-manager";
import { SperrlisteTabs } from "./sperrliste-tabs";

interface SperrlistePageClientProps {
  initialBlockedDays: BlockedDay[];
  initialHolidays: HolidayRange[];
  overviewMembers: OverviewMember[];
  initialSettings: ClientSperrlisteSettings;
  canManageSettings: boolean;
  defaultHolidaySourceUrl: string;
}

export function SperrlistePageClient({
  initialBlockedDays,
  initialHolidays,
  overviewMembers,
  initialSettings,
  canManageSettings,
  defaultHolidaySourceUrl,
}: SperrlistePageClientProps) {
  const [settings, setSettings] = useState<ClientSperrlisteSettings>(initialSettings);
  const [holidays, setHolidays] = useState<HolidayRange[]>(initialHolidays);
  const [defaultHolidayUrl, setDefaultHolidayUrl] = useState(defaultHolidaySourceUrl);

  return (
    <div className="space-y-6">
      {canManageSettings ? (
        <SperrlisteSettingsManager
          settings={settings}
          defaultHolidaySourceUrl={defaultHolidayUrl}
          onSettingsChange={(payload) => {
            setSettings(payload.settings);
            if (payload.holidays) {
              setHolidays(payload.holidays);
            }
            if (payload.defaults?.holidaySourceUrl) {
              setDefaultHolidayUrl(payload.defaults.holidaySourceUrl);
            }
          }}
        />
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
