import { format, isSameMonth, isToday } from "date-fns";
import { de } from "date-fns/locale/de";
import { tv } from "tailwind-variants";

import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { HolidayRange } from "@/types/holidays";

import type { BlockedDay } from "../block-calendar";
import {
  type BlockOverviewSummary,
  type HolidaySegment,
  type PreparedMember,
  type VisibleDayInfo,
} from "./useBlockOverviewData";

export type TimelineStatus =
  | "blocked"
  | "limited"
  | "preferred"
  | "holiday"
  | "free"
  | "freeMuted"
  | "preferredPlaceholder"
  | "exceptionPlaceholder";

export const timelineStatusStyles = tv({
  variants: {
    status: {
      blocked: "bg-destructive/10 text-destructive",
      limited:
        "border border-amber-300/60 bg-amber-200/30 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/15 dark:text-amber-100",
      preferred:
        "border border-emerald-400/60 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
      holiday:
        "border border-sky-400/40 bg-sky-500/10 text-sky-900 dark:text-sky-100",
      free: "border border-border/40 bg-background/60 text-muted-foreground/80 backdrop-blur",
      freeMuted: "border border-border/50 bg-muted/30 text-muted-foreground",
      preferredPlaceholder:
        "border border-primary/40 bg-primary/10 text-primary/90 dark:border-primary/50 dark:bg-primary/20 dark:text-primary-foreground",
      exceptionPlaceholder:
        "border border-primary/25 bg-primary/5 text-primary/75 dark:border-primary/40 dark:bg-primary/15 dark:text-primary-foreground/80",
    },
  },
});

const blockedButtonStyles = tv({
  base: "group relative flex min-h-12 w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-transparent px-3 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  variants: {
    today: {
      true: "ring-1 ring-primary/60",
      false: "",
    },
    outsideMonth: {
      true: "opacity-70",
      false: "",
    },
  },
});

const staticCellStyles = tv({
  base: "relative flex min-h-12 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  variants: {
    today: {
      true: "ring-1 ring-primary/60",
      false: "",
    },
    outsideMonth: {
      true: "opacity-70",
      false: "",
    },
  },
});

interface DesktopTimelineProps {
  currentMonth: Date;
  preparedMembers: PreparedMember[];
  visibleDayInfo: VisibleDayInfo[];
  holidaySegments: HolidaySegment[];
  summary: BlockOverviewSummary;
  preferredWeekdaySet: Set<number>;
  exceptionWeekdaySet: Set<number>;
  sortedPreferredWeekdays: number[];
  preferredDayKeys: Set<string>;
  holidayMap: Map<string, HolidayRange[]>;
  onSelectBlockedDay: (selection: {
    member: PreparedMember;
    entry: BlockedDay;
    date: Date;
    holidayEntries: HolidayRange[];
  }) => void;
  formatCreatedAtLabel: (createdAt?: string | null) => string | null;
}

export function DesktopTimeline({
  currentMonth,
  preparedMembers,
  visibleDayInfo,
  holidaySegments,
  summary,
  preferredWeekdaySet,
  exceptionWeekdaySet,
  sortedPreferredWeekdays,
  preferredDayKeys,
  holidayMap,
  onSelectBlockedDay,
  formatCreatedAtLabel,
}: DesktopTimelineProps) {
  return (
    <div className="relative max-h-[70vh] overflow-auto rounded-2xl border border-border/60 bg-card shadow-sm">
      <table className="w-full min-w-[960px] table-fixed border-collapse text-xs">
        <thead className="sticky top-0 z-30 bg-card/95">
          <tr>
            <th
              scope="col"
              rowSpan={2}
              className="sticky top-0 left-0 z-40 min-w-[220px] border-b border-r border-border/60 bg-card/95 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Mitglied
            </th>
            {visibleDayInfo.map(({ day, key }, index) => {
              const weekday = day.getDay();
              const isPreferredDay = preferredWeekdaySet.has(weekday);
              const isExceptionDay = exceptionWeekdaySet.has(weekday);
              const isPreferredExtra = !isPreferredDay && !isExceptionDay;
              const showDivider =
                sortedPreferredWeekdays.length > 0 &&
                weekday === sortedPreferredWeekdays[0] &&
                index !== 0;
              const isFirstOfMonth = format(day, "d") === "1";

              return (
                <th
                  key={key}
                  scope="col"
                  className={cn(
                    "border-b border-border/60 bg-card/95 px-3 py-2 text-center align-bottom text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/90",
                    showDivider && "border-l border-border/60",
                    isPreferredDay && "text-foreground",
                    isExceptionDay && !isPreferredDay && "text-muted-foreground",
                    isPreferredExtra && preferredDayKeys.has(key) && "text-emerald-500",
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        "text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground/70",
                        isToday(day) && "text-primary",
                      )}
                    >
                      {format(day, "EE", { locale: de })}
                    </span>
                    <span
                      className={cn(
                        "text-base font-semibold",
                        isToday(day) && "text-primary",
                        isPreferredDay && "font-bold",
                      )}
                    >
                      {format(day, "d", { locale: de })}
                    </span>
                    {isFirstOfMonth ? (
                      <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                        {format(day, "MMM", { locale: de })}
                      </span>
                    ) : null}
                  </div>
                </th>
              );
            })}
          </tr>
          <tr>
            {holidaySegments.map((segment) => {
              const summaryLabel =
                segment.titles.length > 1
                  ? `${segment.titles[0] ?? "Ferien & Feiertage"} +${segment.titles.length - 1}`
                  : segment.titles[0] ?? "Ferien & Feiertage";

              return (
                <th
                  key={segment.key}
                  scope="col"
                  colSpan={segment.span}
                  className={cn(
                    "border-b border-border/60 px-2 py-1 text-center align-middle text-[10px] font-semibold uppercase tracking-wide",
                    segment.isHoliday
                      ? "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200"
                      : "bg-card/95 text-transparent",
                    segment.showDivider && "border-l border-border/60",
                  )}
                  aria-hidden={!segment.isHoliday}
                >
                  {segment.isHoliday ? (
                    <span title={segment.titles.join(", ")}>{summaryLabel}</span>
                  ) : (
                    <span className="sr-only">Keine Ferien oder Feiertage</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {preparedMembers.map((member) => {
            const stats = summary.totals.get(member.id);

            return (
              <tr key={member.id} className="align-top transition-colors hover:bg-muted/40">
                <th
                  scope="row"
                  className="sticky left-0 z-30 min-w-[220px] border-b border-r border-border/60 bg-card/95 px-4 py-3 text-left"
                >
                  <div className="flex min-h-16 items-start gap-3">
                    <UserAvatar
                      userId={member.id}
                      email={member.email ?? undefined}
                      firstName={member.firstName ?? undefined}
                      lastName={member.lastName ?? undefined}
                      name={member.displayName}
                      avatarSource={member.avatarSource ?? undefined}
                      avatarUpdatedAt={member.avatarUpdatedAt ?? undefined}
                      size={44}
                      className="h-11 w-11"
                    />
                    <div className="min-w-0 text-foreground">
                      <div className="truncate text-sm font-semibold text-foreground">{member.displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        {stats?.total
                          ? `${stats.total} Sperrtermin${stats.total === 1 ? "" : "e"}`
                          : "Keine Sperrtermine"}
                      </div>
                      {stats?.upcoming ? (
                        <div className="text-sm leading-5 text-primary">{stats.upcoming} bevorstehend</div>
                      ) : null}
                    </div>
                  </div>
                </th>
                {visibleDayInfo.map(({ day, key }, index) => {
                  const entry = member.blockedMap.get(key);
                  const trimmedReason = entry?.reason?.trim() || undefined;
                  const hasReason = Boolean(trimmedReason);
                  const createdAtLabel = formatCreatedAtLabel(entry?.createdAt);
                  const weekday = day.getDay();
                  const showDivider =
                    sortedPreferredWeekdays.length > 0 &&
                    weekday === sortedPreferredWeekdays[0] &&
                    index !== 0;
                  const isPreferredDay = preferredWeekdaySet.has(weekday);
                  const isExceptionDay = exceptionWeekdaySet.has(weekday);
                  const holidayEntries = holidayMap.get(key) ?? [];
                  const isHoliday = holidayEntries.length > 0;
                  const isBlocked = entry?.kind === "BLOCKED";
                  const isLimited = entry?.kind === "LIMITED";
                  const isPreferred = entry?.kind === "PREFERRED";
                  const baseId = `${member.id}-${key}`;
                  const holidayId = isHoliday ? `${baseId}-holiday` : undefined;
                  const createdAtId = createdAtLabel ? `${baseId}-created` : undefined;
                  const describedBy = [holidayId, createdAtId].filter(Boolean).join(" ") || undefined;

                  const label = [
                    format(day, "EEEE, d. MMMM yyyy", { locale: de }),
                    entry
                      ? isPreferred
                        ? trimmedReason ?? "bevorzugt"
                        : isLimited
                          ? trimmedReason ?? "eingeschränkt"
                          : trimmedReason ?? "gesperrt"
                      : "frei",
                  ];

                  if (isHoliday) {
                    const holidaySummary = holidayEntries
                      .map((holiday) =>
                        `${holiday.category === "publicHoliday" ? "Feiertag" : "Ferien"}: ${holiday.title}`,
                      )
                      .join(", ");
                    label.push(holidaySummary || "Ferien & Feiertage");
                  }

                  if (createdAtLabel) {
                    label.push(`Eingetragen am ${createdAtLabel}`);
                  }

                  let status: TimelineStatus = "free";
                  if (isLimited) {
                    status = "limited";
                  } else if (isPreferred) {
                    status = "preferred";
                  } else if (!entry && isHoliday) {
                    status = "holiday";
                  } else if (!entry && !isHoliday && isPreferredDay) {
                    status = "preferredPlaceholder";
                  } else if (!entry && !isHoliday && isExceptionDay) {
                    status = "exceptionPlaceholder";
                  }

                  const outsideMonth = !isSameMonth(day, currentMonth);

                  return (
                    <td
                      key={key}
                      className={cn(
                        "min-w-[72px] border-b border-border/60 px-1 py-1 align-top",
                        showDivider && "border-l border-border/60",
                      )}
                    >
                      {isBlocked && entry ? (
                        <button
                          type="button"
                          onClick={() =>
                            onSelectBlockedDay({
                              member,
                              entry,
                              date: day,
                              holidayEntries,
                            })
                          }
                          className={cn(
                            blockedButtonStyles({
                              today: isToday(day),
                              outsideMonth,
                            }),
                            timelineStatusStyles({ status: "blocked" }),
                          )}
                          aria-label={[...label, "Details öffnen"].join(". ")}
                          aria-describedby={describedBy}
                        >
                          <span className="flex flex-1 items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                              {format(day, "EE", { locale: de })}
                            </span>
                            <span className="text-sm font-semibold">{format(day, "d", { locale: de })}</span>
                            {hasReason ? (
                              <span className="flex-1 truncate text-right normal-case tracking-normal text-[11px]">
                                {trimmedReason}
                              </span>
                            ) : (
                              <span className="flex-1 truncate text-right normal-case tracking-normal text-[11px] text-destructive/70">
                                Keine Details
                              </span>
                            )}
                          </span>
                          {holidayId ? (
                            <span id={holidayId} className="sr-only">
                              {holidayEntries
                                .map((holiday) =>
                                  `${holiday.category === "publicHoliday" ? "Feiertag" : "Ferien"}: ${holiday.title}`,
                                )
                                .join(", ")}
                            </span>
                          ) : null}
                          {createdAtId ? (
                            <span id={createdAtId} className="sr-only">
                              {`Eingetragen am ${createdAtLabel}`}
                            </span>
                          ) : null}
                          <span
                            className="pointer-events-none absolute inset-x-2 bottom-2 h-1 rounded-full bg-destructive/20 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden
                          />
                          <span className="sr-only">Sperrtermin öffnen</span>
                        </button>
                      ) : (
                        <div
                          className={cn(
                            staticCellStyles({
                              today: isToday(day),
                              outsideMonth,
                            }),
                            timelineStatusStyles({
                              status,
                            }),
                          )}
                          aria-label={label.join(". ")}
                          aria-describedby={describedBy}
                          tabIndex={isLimited || isPreferred || (isHoliday && !entry) ? 0 : undefined}
                          aria-selected={isToday(day) || undefined}
                        >
                          {entry ? (
                            <div className="flex w-full items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em]">
                              <span className="truncate">
                                {isPreferred ? "Bevorzugt" : "Eingeschränkt"}
                              </span>
                              <span className="truncate text-right normal-case tracking-normal text-[11px]">
                                {trimmedReason || (isPreferred ? "Ohne Angabe" : "Keine Details")}
                              </span>
                            </div>
                          ) : isHoliday ? (
                            <span className="sr-only" id={holidayId}>
                              {holidayEntries
                                .map((holiday) =>
                                  `${holiday.category === "publicHoliday" ? "Feiertag" : "Ferien"}: ${holiday.title}`,
                                )
                                .join(", ") || "Ferien & Feiertage"}
                            </span>
                          ) : isPreferredDay ? (
                            <span className="sr-only">Bevorzugter Probentag</span>
                          ) : isExceptionDay ? (
                            <span className="sr-only">Ausnahmeprobentag</span>
                          ) : (
                            <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground/70">
                              Frei
                            </span>
                          )}
                          {createdAtId ? (
                            <span id={createdAtId} className="sr-only">
                              {`Eingetragen am ${createdAtLabel}`}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
