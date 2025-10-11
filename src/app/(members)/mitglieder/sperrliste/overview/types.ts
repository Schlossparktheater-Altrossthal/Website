import type { WeekdayValue } from "@/lib/weekdays";
import type { HolidayRange } from "@/types/holidays";

import type { BlockedDay } from "../block-calendar";
import type { PreparedMember } from "./useBlockOverviewData";

export type PersonGroup = "actors" | "crew" | "both" | "other";

export type OverviewPersonDay = {
  type: "free" | "limited" | "block" | "preferred";
  label: string | null;
  entry: BlockedDay | null;
  date: Date;
  dayKey: string;
  holidayEntries: HolidayRange[];
};

export type OverviewPerson = {
  id: string;
  name: string;
  initials: string;
  group: PersonGroup;
  stats: { total: number; upcoming: number; label: string };
  member: PreparedMember;
  days: OverviewPersonDay[];
};

export type DayColumn = {
  key: string;
  label: string;
  n: number;
  date: Date;
  accent: boolean;
  weekday: WeekdayValue;
};

export type HolidayIndicator = {
  dayIndex: number;
  label?: string;
  type: "holiday" | "vacation";
  isPublicHoliday: boolean;
};

export type DayBucket = {
  column: DayColumn;
  available: { person: OverviewPerson; cell: OverviewPersonDay }[];
  limited: { person: OverviewPerson; cell: OverviewPersonDay }[];
  blocked: { person: OverviewPerson; cell: OverviewPersonDay }[];
  holiday: HolidayIndicator | null;
};
