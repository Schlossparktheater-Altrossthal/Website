export type MemberCalendarSourceType =
  | "rehearsal"
  | "department"
  | "personal";

export interface MemberCalendarSource {
  id: string;
  label: string;
  color: string;
  type: MemberCalendarSourceType;
  description?: string | null;
  secondaryLabel?: string | null;
}

export interface MemberCalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  start: string;
  end: string | null;
  allDay?: boolean;
  location?: string | null;
  description?: string | null;
  metadata?: {
    attendanceStatus?: string | null;
    departmentName?: string | null;
    sourceId?: string | null;
  };
}

export interface MemberCalendarSummaryItem {
  id: string;
  label: string;
  value: string;
  hint?: string | null;
}
