import type { BlockedDayKind } from "@prisma/client";

import type { AvailabilityStatus, SettableStatus } from "@/components/ui/availability-status";
import type { AvatarFields } from "@/lib/avatar-fields";

/** `unassigned`: gehört zur Produktion, hat aber noch keine Rolle und kein Gewerk. */
export type MemberGroup = "actors" | "crew" | "both" | "unassigned";

/** Eigener Eintrag (mit Grund). */
export type MyBlockedDay = {
  id: string;
  date: string;
  kind: BlockedDayKind;
  reason: string | null;
};

export type TeamMember = AvatarFields & {
  id: string;
  name: string;
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
  EMERGENCY: "emergency",
};

/** Nur die in der Sperrliste setzbaren Zustände; „Notfall" kommt aus „Meine Termine". */
export const STATUS_TO_KIND: Record<SettableStatus, BlockedDayKind> = {
  blocked: "BLOCKED",
  limited: "LIMITED",
  preferred: "PREFERRED",
};

export const MEMBER_GROUP_LABELS: Record<MemberGroup, string> = {
  actors: "Schauspiel",
  crew: "Gewerke",
  both: "Schauspiel & Gewerke",
  unassigned: "Noch nicht zugewiesen",
};

/**
 * Gruppe aus den Zuweisungen der Produktion: Rollenbesetzung oder Gewerk „Schauspiel“ zählt als
 * Schauspiel, jedes andere aktive Gewerk als Gewerke.
 */
export function assignmentsToGroup(acting: boolean, crew: boolean): MemberGroup {
  if (acting && crew) return "both";
  if (acting) return "actors";
  if (crew) return "crew";
  return "unassigned";
}

/** Rückfall ohne gewählte Produktion: Schwerpunkt aus dem Onboarding. */
export function focusToGroup(focus: string | null | undefined): MemberGroup {
  return assignmentsToGroup(
    focus === "acting" || focus === "both",
    focus === "tech" || focus === "both",
  );
}
