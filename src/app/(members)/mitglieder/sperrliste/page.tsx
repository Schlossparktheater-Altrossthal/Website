import type { BlockedDayKind } from "@prisma/client";
import { addMonths, format, startOfMonth } from "date-fns";

import { PageHeader } from "@/components/members/page-header";
import { getActiveProductionId } from "@/lib/active-production";
import { readCalendarEntries } from "@/lib/calendar/entries";
import { currentMembershipWhere } from "@/lib/produktionen/status";
import { CALENDAR_PLANNER_PERMISSION } from "@/lib/calendar/permissions";
import { databaseEnabled } from "@/lib/dev-database";
import {
  DEV_SPERRLISTE_BLOCKED_DAYS_FIXTURE,
  DEV_SPERRLISTE_CLIENT_SETTINGS_FIXTURE,
  DEV_SPERRLISTE_DEFAULTS_FIXTURE,
  DEV_SPERRLISTE_HOLIDAYS_FIXTURE,
  DEV_SPERRLISTE_OVERVIEW_MEMBERS_FIXTURE,
} from "@/lib/dev-sperrliste-fixture";
import { getSaxonySchoolHolidayRanges } from "@/lib/holidays";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { compareMembersByLastName, getUserDisplayName } from "@/lib/names";
import type { AvatarFields } from "@/lib/avatar-fields";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  getDefaultHolidaySourceUrl,
  getDefaultPublicHolidaySourceUrl,
  readSperrlisteSettings,
  resolveBlocklistSettings,
  toClientBlocklistSettings,
} from "@/lib/sperrliste-settings";

import { BlocklistPageClient, type BlocklistPageData } from "./page-client";
import {
  KIND_TO_STATUS,
  assignmentsToGroup,
  focusToGroup,
  type MemberGroup,
  type TeamEntry,
  type TeamMember,
} from "./types";

/** Blaupause des Gewerks „Schauspiel“ – Mitglieder dort zählen zum Ensemble. */
const ACTING_TEMPLATE_SLUG = "schauspiel";

const DESCRIPTION = "Trage ein, wann du nicht kannst – das Team sieht auf einen Blick, wer fehlt.";

type MemberRecord = AvatarFields & {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  group: MemberGroup;
  blockedDays: {
    id: string;
    date: string;
    kind: BlockedDayKind;
    reason: string | null;
  }[];
};

function buildTeam(records: MemberRecord[], includeReasons: boolean) {
  const members: TeamMember[] = [];
  const entries: TeamEntry[] = [];
  for (const record of [...records].sort(compareMembersByLastName)) {
    members.push({
      id: record.id,
      name: getUserDisplayName(record),
      email: record.email,
      avatarSource: record.avatarSource,
      avatarUpdatedAt: record.avatarUpdatedAt,
      group: record.group,
    });
    for (const day of record.blockedDays) {
      entries.push({
        userId: record.id,
        date: day.date,
        status: KIND_TO_STATUS[day.kind],
        // Gründe sieht nur, wer plant – sie verlassen den Server sonst nicht.
        reason: includeReasons ? (day.reason?.trim() ?? null) || null : null,
      });
    }
  }
  return { members, entries };
}

export default async function BlocklistPage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error("Benutzerinformationen konnten nicht geladen werden.");
  }

  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/sperrliste")];

  if (!databaseEnabled()) {
    const team = buildTeam(
      DEV_SPERRLISTE_OVERVIEW_MEMBERS_FIXTURE.map((member) => ({
        ...member,
        group: focusToGroup(member.onboardingFocus),
        blockedDays: member.blockedDays.map(({ id, date, kind, reason }) => ({
          id,
          date,
          kind,
          reason,
        })),
      })),
      false,
    );
    const data: BlocklistPageData = {
      currentUserId: userId,
      myEntries: DEV_SPERRLISTE_BLOCKED_DAYS_FIXTURE.map(({ id, date, kind, reason }) => ({
        id,
        date,
        kind,
        reason,
      })),
      members: team.members,
      teamEntries: team.entries,
      holidays: DEV_SPERRLISTE_HOLIDAYS_FIXTURE,
      calendarEntries: [],
      finalWeek: null,
      settings: DEV_SPERRLISTE_CLIENT_SETTINGS_FIXTURE,
      defaultHolidaySourceUrl: DEV_SPERRLISTE_DEFAULTS_FIXTURE.holidaySourceUrl,
      defaultPublicHolidaySourceUrl: DEV_SPERRLISTE_DEFAULTS_FIXTURE.publicHolidaySourceUrl,
      canPlan: false,
      canManageSettings: false,
      canExport: false,
      readOnly: true,
    };
    return (
      <div className="space-y-6">
        <PageHeader title="Sperrliste" description={DESCRIPTION} breadcrumbs={breadcrumbs} />
        <BlocklistPageClient data={data} />
      </div>
    );
  }

  // Sperrtermine gehören der Person (wer nicht kann, kann für keine Produktion); die
  // Team-Ansicht und die Rechte richten sich nach der gewählten Produktion.
  const activeProductionId = await getActiveProductionId(userId);
  const scope = { showId: activeProductionId };
  const [allowed, canPlan, canManageSettings, canExport] = await Promise.all([
    hasPermission(session.user, "PRIVATE.REHEARSAL.BLOCKLIST.VIEW", scope),
    hasPermission(session.user, CALENDAR_PLANNER_PERMISSION, scope),
    hasPermission(session.user, "PRIVATE.REHEARSAL.BLOCKLIST.SETTINGS", scope),
    hasPermission(session.user, "PRIVATE.REHEARSAL.BLOCKLIST.EXPORT", scope),
  ]);

  if (!allowed) {
    return <div className="text-sm text-destructive">Kein Zugriff auf die Sperrliste</div>;
  }

  // Vergangene Monate sind für die Planung uninteressant: ab Vormonat gut ein Jahr voraus.
  const from = addMonths(startOfMonth(new Date()), -1);
  const to = addMonths(from, 14);

  const settings = resolveBlocklistSettings(await readSperrlisteSettings());

  const [holidays, users, calendarEntries, production] = await Promise.all([
    getSaxonySchoolHolidayRanges(settings.cacheKey),
    prisma.user.findMany({
      where: {
        deactivatedAt: null,
        ...(activeProductionId
          ? {
              OR: [
                { id: userId },
                {
                  productionMemberships: {
                    some: { showId: activeProductionId, ...currentMembershipWhere() },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        avatarSource: true,
        avatarImageUpdatedAt: true,
        onboardingProfile: { select: { focus: true } },
        // Ohne Produktion passt `showId: ""` auf nichts – dann zählt der Onboarding-Schwerpunkt.
        characterCastings: {
          where: { character: { showId: activeProductionId ?? "" } },
          select: { id: true },
          take: 1,
        },
        departmentMemberships: {
          where: {
            status: "active",
            department: { showId: activeProductionId ?? "", archivedAt: null },
          },
          select: { department: { select: { template: { select: { slug: true } } } } },
        },
        blockedDays: {
          where: { date: { gte: from, lt: to } },
          orderBy: { date: "asc" },
          select: { id: true, date: true, kind: true, reason: true },
        },
      },
    }),
    // Termine mit Zielgruppe sehen nur Eingeladene; die Planung sieht alle.
    readCalendarEntries({
      from,
      to,
      showId: activeProductionId,
      viewerId: canPlan ? undefined : userId,
    }),
    activeProductionId
      ? prisma.show.findUnique({
          where: { id: activeProductionId },
          select: {
            id: true,
            title: true,
            year: true,
            finalRehearsalWeekStart: true,
            finalRehearsalWeekEnd: true,
          },
        })
      : null,
  ]);

  const records: MemberRecord[] = users.map((user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    email: user.email,
    avatarSource: user.avatarSource,
    avatarUpdatedAt: user.avatarImageUpdatedAt,
    group: activeProductionId
      ? assignmentsToGroup(
          user.characterCastings.length > 0 ||
            user.departmentMemberships.some(
              (membership) => membership.department.template.slug === ACTING_TEMPLATE_SLUG,
            ),
          user.departmentMemberships.some(
            (membership) => membership.department.template.slug !== ACTING_TEMPLATE_SLUG,
          ),
        )
      : focusToGroup(user.onboardingProfile?.focus),
    blockedDays: user.blockedDays.map((day) => ({
      id: day.id,
      date: format(day.date, "yyyy-MM-dd"),
      kind: day.kind,
      reason: day.reason,
    })),
  }));
  const team = buildTeam(records, canPlan);
  const myEntries = records.find((record) => record.id === userId)?.blockedDays ?? [];

  const finalWeek = production?.finalRehearsalWeekStart
    ? {
        start: format(production.finalRehearsalWeekStart, "yyyy-MM-dd"),
        end: production.finalRehearsalWeekEnd
          ? format(production.finalRehearsalWeekEnd, "yyyy-MM-dd")
          : null,
      }
    : null;

  const data: BlocklistPageData = {
    currentUserId: userId,
    myEntries,
    members: team.members,
    teamEntries: team.entries,
    holidays,
    calendarEntries,
    finalWeek,
    // Der Ferienabruf aktualisiert den Prüfstatus der Quellen – deshalb neu lesen.
    settings: toClientBlocklistSettings(resolveBlocklistSettings(await readSperrlisteSettings())),
    defaultHolidaySourceUrl: getDefaultHolidaySourceUrl(),
    defaultPublicHolidaySourceUrl: getDefaultPublicHolidaySourceUrl(),
    canPlan,
    canManageSettings,
    canExport,
    readOnly: false,
    production: production
      ? { id: production.id, title: production.title ?? String(production.year) }
      : null,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Sperrliste" description={DESCRIPTION} breadcrumbs={breadcrumbs} />
      <BlocklistPageClient data={data} />
    </div>
  );
}
