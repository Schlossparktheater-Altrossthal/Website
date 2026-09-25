import type { BlockedDayKind } from "@prisma/client";

import type { AvailabilityStatus } from "@/components/ui/availability-status";

export type MemberGroup = "actors" | "crew" | "both" | "other";

/** Eigener Eintrag (mit Grund). */
export type MyBlockedDay = {
  id: string;
  date: string;
  kind: BlockedDayKind;
  reason: string | null;
};

export type TeamMember = {
  id: string;
  name: string;
  initials: string;
  group: MemberGroup;
};

/** Eintrag eines Mitglieds; `reason` nur für Planer gefüllt. */
export type TeamEntry = {
  userId: string;
  date: string;
  status: Exclude<AvailabilityStatus, "free">;
  reason: string | null;
};

export const KIND_TO_STATUS: Record<BlockedDayKind, Exclude<AvailabilityStatus, "free">> = {
  BLOCKED: "blocked",
  LIMITED: "limited",
  PREFERRED: "preferred",
};

export const STATUS_TO_KIND: Record<Exclude<AvailabilityStatus, "free">, BlockedDayKind> = {
  blocked: "BLOCKED",
  limited: "LIMITED",
  preferred: "PREFERRED",
};

export const MEMBER_GROUP_LABELS: Record<MemberGroup, string> = {
  actors: "Schauspiel",
  crew: "Gewerke",
  both: "Schauspiel & Gewerke",
  other: "Ohne Angabe",
};

export function focusToGroup(focus: string | null | undefined): MemberGroup {
  if (focus === "acting") return "actors";
  if (focus === "tech") return "crew";
  if (focus === "both") return "both";
  return "other";
}
