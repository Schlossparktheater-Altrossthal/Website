import type { MilestoneAnchor } from "@prisma/client";

/** Fristen sind Kalendertage (UTC-Mitternacht) – deshalb in UTC formatieren. */
export const DAY_FORMAT = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export const SHORT_DAY_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

export const MONTH_FORMAT = new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: "UTC" });

export function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

const ANCHOR_NAMES: Record<Exclude<MilestoneAnchor, "fixed" | "milestone">, string> = {
  premiere: "Premiere",
  finalRehearsalStart: "Beginn Endprobenwoche",
};

/** „14 Tage vor Premiere“, „am 01.03.2027“, „3 Tage nach GEMA“. */
export function describeAnchor(
  milestone: {
    anchorType: MilestoneAnchor;
    offsetDays: number;
    fixedDate: string | null;
    anchorMilestoneId: string | null;
  },
  titles: Map<string, string>,
): string {
  if (milestone.anchorType === "fixed") {
    return milestone.fixedDate
      ? `fest am ${DAY_FORMAT.format(new Date(milestone.fixedDate))}`
      : "festes Datum";
  }
  const target =
    milestone.anchorType === "milestone"
      ? (titles.get(milestone.anchorMilestoneId ?? "") ?? "Meilenstein")
      : ANCHOR_NAMES[milestone.anchorType];
  const days = milestone.offsetDays;
  if (days === 0) {
    return milestone.anchorType === "premiere" ? "am Tag der Premiere" : `zeitgleich mit ${target}`;
  }
  const amount = Math.abs(days) === 1 ? "1 Tag" : `${Math.abs(days)} Tage`;
  return `${amount} ${days < 0 ? "vor" : "nach"} ${target}`;
}
