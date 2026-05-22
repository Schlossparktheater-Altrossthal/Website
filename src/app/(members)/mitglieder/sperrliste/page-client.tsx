"use client";

import { useEffect, useState } from "react";

import type { ClientSperrlisteSettings } from "@/lib/sperrliste-settings";
import type { HolidayRange } from "@/types/holidays";

import type { BlockedDay } from "./block-calendar";
import type { OverviewMember } from "./block-overview";
import { BlocklistSettingsDialog } from "./settings-dialog";
import { BlocklistTabs } from "./sperrliste-tabs";

interface BlocklistPageClientProps {
  initialBlockedDays: BlockedDay[];
  initialHolidays: HolidayRange[];
  overviewMembers: OverviewMember[];
  initialSettings: ClientSperrlisteSettings;
  canManageSettings: boolean;
  canExport: boolean;
  defaultHolidaySourceUrl: string;
  defaultPublicHolidaySourceUrl: string;
  isOffline?: boolean;
  offlineMessage?: string;
}

export function BlocklistPageClient({
  initialBlockedDays,
  initialHolidays,
  overviewMembers,
  initialSettings,
  canManageSettings,
  canExport,
  defaultHolidaySourceUrl,
  defaultPublicHolidaySourceUrl,
  isOffline = false,
  offlineMessage,
}: BlocklistPageClientProps) {
  const [settings, setSettings] = useState<ClientSperrlisteSettings>(initialSettings);
  const [holidays, setHolidays] = useState<HolidayRange[]>(initialHolidays);
  const [defaultHolidayUrl, setDefaultHolidayUrl] = useState(defaultHolidaySourceUrl);
  const [defaultPublicHolidayUrl, setDefaultPublicHolidayUrl] = useState(
    defaultPublicHolidaySourceUrl,
  );
  const [offline, setOffline] = useState<boolean>(Boolean(isOffline));
  const [offlineNotice, setOfflineNotice] = useState<string | null>(
    isOffline ? offlineMessage ?? null : null,
  );
  const defaultOfflineDescription =
    offlineMessage ??
    "Der Sperrlistenbereich läuft im Offline-Demo-Modus. Änderungen werden nicht gespeichert.";

  useEffect(() => {
    setOffline(Boolean(isOffline));
  }, [isOffline]);

  useEffect(() => {
    if (!isOffline) {
      setOfflineNotice(null);
      return;
    }
    setOfflineNotice(defaultOfflineDescription);
  }, [defaultOfflineDescription, isOffline]);

  return (
    <div className="space-y-6">
      {offline ? (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="text-sm font-semibold text-warning">Offline-Demo-Modus</p>
          <p className="text-xs text-warning/80">
            {offlineNotice ?? defaultOfflineDescription}
          </p>
        </div>
      ) : null}
      <BlocklistTabs
        initialBlockedDays={initialBlockedDays}
        holidays={holidays}
        overviewMembers={overviewMembers}
        freezeDays={settings.freezeDays}
        preferredWeekdays={settings.preferredWeekdays}
        exceptionWeekdays={settings.exceptionWeekdays}
        canExport={canExport && !offline}
        readOnly={offline}
        readOnlyMessage={offlineNotice ?? undefined}
        actions={
          canManageSettings && !offline ? (
            <BlocklistSettingsDialog
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
                  setDefaultPublicHolidayUrl(
                    payload.defaults.publicHolidaySourceUrl,
                  );
                }
                if (typeof payload.offline === "boolean") {
                  setOffline(payload.offline);
                  setOfflineNotice(
                    payload.offline
                      ? payload.message ?? defaultOfflineDescription
                      : null,
                  );
                }
              }}
            />
          ) : null
        }
      />
    </div>
  );
}
