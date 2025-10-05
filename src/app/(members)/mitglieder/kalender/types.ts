export type MemberCalendarSourceType =
  | "rehearsal"
  | "department"
  | "personal"
  | "task"
  | "milestone";

export type MemberCalendarEventBadgeTone =
  | "default"
  | "secondary"
  | "accent"
  | "muted"
  | "success"
  | "warning"
  | "info"
  | "destructive";

export interface MemberCalendarEventMetadata {
  attendanceStatus?: string | null;
  departmentName?: string | null;
  sourceId?: string | null;
  badge?: {
    label: string;
    tone?: MemberCalendarEventBadgeTone;
  } | null;
  note?: string | null;
}

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
  metadata?: MemberCalendarEventMetadata;
}

export interface MemberCalendarSummaryItem {
  id: string;
  label: string;
  value: string;
  hint?: string | null;
}
