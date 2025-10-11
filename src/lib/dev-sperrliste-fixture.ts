import type { ClientSperrlisteSettings } from "@/lib/sperrliste-settings";
import type { HolidayRange } from "@/types/holidays";
import type { BlockDayResponse } from "@/app/api/block-days/utils";
import { BlockedDayKind, type SperrlisteSettings } from "@prisma/client";

const OFFLINE_STATUS_MESSAGE =
  "Offline-Demo: Die Quelle wurde nicht geprüft, weil keine Datenbank verbunden ist.";

const OFFLINE_UPDATED_AT = "2024-09-05T08:15:00.000Z";
const OFFLINE_CREATED_AT = "2024-02-12T09:30:00.000Z";

export const DEV_SPERRLISTE_DEFAULTS_FIXTURE = {
  holidaySourceUrl:
    "https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-sachsen.ics",
  publicHolidaySourceUrl: "https://www.officeholidays.com/ics/germany/saxony",
} as const;

const PREFERRED_WEEKDAYS = [1, 3, 5] as const;
const EXCEPTION_WEEKDAYS = [0] as const;

export const DEV_SPERRLISTE_SETTINGS_RECORD_FIXTURE: SperrlisteSettings = {
  id: "default",
  freezeDays: 10,
  holidaySourceMode: "default",
  holidaySourceUrl: null,
  holidaySourceStatus: "unknown",
  holidaySourceMessage: OFFLINE_STATUS_MESSAGE,
  holidaySourceCheckedAt: null,
  publicHolidaySourceMode: "default",
  publicHolidaySourceUrl: null,
  publicHolidaySourceStatus: "unknown",
  publicHolidaySourceMessage: OFFLINE_STATUS_MESSAGE,
  publicHolidaySourceCheckedAt: null,
  preferredWeekdays: [...PREFERRED_WEEKDAYS],
  exceptionWeekdays: [...EXCEPTION_WEEKDAYS],
  createdAt: new Date(OFFLINE_CREATED_AT),
  updatedAt: new Date(OFFLINE_UPDATED_AT),
};

export const DEV_SPERRLISTE_CLIENT_SETTINGS_FIXTURE: ClientSperrlisteSettings = {
  freezeDays: 10,
  preferredWeekdays: [...PREFERRED_WEEKDAYS],
  exceptionWeekdays: [...EXCEPTION_WEEKDAYS],
  holidaySource: {
    mode: "default",
    url: null,
    effectiveUrl: DEV_SPERRLISTE_DEFAULTS_FIXTURE.holidaySourceUrl,
  },
  publicHolidaySource: {
    mode: "default",
    url: null,
    effectiveUrl: DEV_SPERRLISTE_DEFAULTS_FIXTURE.publicHolidaySourceUrl,
  },
  holidayStatus: {
    status: "unknown",
    message: OFFLINE_STATUS_MESSAGE,
    checkedAt: null,
  },
  publicHolidayStatus: {
    status: "unknown",
    message: OFFLINE_STATUS_MESSAGE,
    checkedAt: null,
  },
  updatedAt: OFFLINE_UPDATED_AT,
  cacheKey: "offline|demo|v1",
};

export const DEV_SPERRLISTE_HOLIDAYS_FIXTURE: HolidayRange[] = [
  {
    id: "holiday-herbstferien-2024",
    title: "Herbstferien Sachsen",
    startDate: "2024-10-14",
    endDate: "2024-10-25",
    category: "schoolHoliday",
  },
  {
    id: "holiday-reformationstag-2024",
    title: "Reformationstag",
    startDate: "2024-10-31",
    endDate: "2024-10-31",
    category: "publicHoliday",
  },
  {
    id: "holiday-weihnachten-2024",
    title: "Weihnachtsferien",
    startDate: "2024-12-23",
    endDate: "2025-01-03",
    category: "schoolHoliday",
  },
];

export const DEV_SPERRLISTE_BLOCKED_DAYS_FIXTURE: BlockDayResponse[] = [
  {
    id: "blocked-offline-1",
    date: "2024-10-18",
    reason: "Wochenendausflug",
    kind: BlockedDayKind.BLOCKED,
    createdAt: "2024-08-30T12:45:00.000Z",
  },
  {
    id: "blocked-offline-2",
    date: "2024-10-21",
    reason: "Dienstreise",
    kind: BlockedDayKind.LIMITED,
    createdAt: "2024-09-02T18:20:00.000Z",
  },
  {
    id: "blocked-offline-3",
    date: "2024-11-04",
    reason: "Bevorzugte Generalprobe",
    kind: BlockedDayKind.PREFERRED,
    createdAt: "2024-09-10T07:55:00.000Z",
  },
];

export const DEV_SPERRLISTE_OVERVIEW_MEMBERS_FIXTURE = [
  {
    id: "member-offline-1",
    firstName: "Lena",
    lastName: "Schubert",
    name: "Lena Schubert",
    email: "lena.schubert@example.test",
    avatarSource: null,
    avatarUpdatedAt: null,
    onboardingFocus: "acting" as const,
    blockedDays: [
      {
        id: "blocked-offline-1",
        date: "2024-10-18",
        reason: "Wochenendausflug",
        kind: "BLOCKED" as const,
        createdAt: "2024-08-30T12:45:00.000Z",
      },
      {
        id: "blocked-offline-3",
        date: "2024-11-04",
        reason: "Bevorzugte Generalprobe",
        kind: "PREFERRED" as const,
        createdAt: "2024-09-10T07:55:00.000Z",
      },
    ],
  },
  {
    id: "member-offline-2",
    firstName: "Marco",
    lastName: "Wagner",
    name: "Marco Wagner",
    email: "marco.wagner@example.test",
    avatarSource: null,
    avatarUpdatedAt: null,
    onboardingFocus: "tech" as const,
    blockedDays: [
      {
        id: "blocked-offline-2",
        date: "2024-10-21",
        reason: "Dienstreise",
        kind: "LIMITED" as const,
        createdAt: "2024-09-02T18:20:00.000Z",
      },
    ],
  },
] as const;

export const DEV_SPERRLISTE_OFFLINE_MESSAGE =
  "Der Sperrlistenbereich nutzt Beispielwerte, weil keine Datenbank verbunden ist.";
