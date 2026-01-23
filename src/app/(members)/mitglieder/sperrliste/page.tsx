import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { format } from "date-fns";
import type { BlockedDay as BlockedDayDTO } from "./block-calendar";
import { getSaxonySchoolHolidayRanges } from "@/lib/holidays";
import {
  getDefaultHolidaySourceUrl,
  getDefaultPublicHolidaySourceUrl,
  readSperrlisteSettings,
  resolveSperrlisteSettings,
  toClientSperrlisteSettings,
} from "@/lib/sperrliste-settings";
import { SperrlistePageClient } from "./page-client";
import type { OverviewMember } from "./block-overview";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { databaseEnabled } from "@/lib/dev-database";
import {
  DEV_SPERRLISTE_BLOCKED_DAYS_FIXTURE,
  DEV_SPERRLISTE_CLIENT_SETTINGS_FIXTURE,
  DEV_SPERRLISTE_DEFAULTS_FIXTURE,
  DEV_SPERRLISTE_HOLIDAYS_FIXTURE,
  DEV_SPERRLISTE_OFFLINE_MESSAGE,
  DEV_SPERRLISTE_OVERVIEW_MEMBERS_FIXTURE,
} from "@/lib/dev-sperrliste-fixture";

export default async function SperrlistePage() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error("Benutzerinformationen konnten nicht geladen werden.");
  }

  const databaseOnline = databaseEnabled();

  let allowed = true;
  let canManageSettings = false;
  let canExport = false;

  if (databaseOnline) {
    const [allowedResult, manageResult, exportResult] = await Promise.all([
      hasPermission(session.user, "mitglieder.sperrliste"),
      hasPermission(session.user, "mitglieder.sperrliste.settings"),
      hasPermission(session.user, "mitglieder.sperrliste.export"),
    ]);
    allowed = allowedResult;
    canManageSettings = manageResult;
    canExport = exportResult;
  }

  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Sperrliste</div>;
  }

  if (!databaseOnline) {
    const initialBlockedDays: BlockedDayDTO[] = DEV_SPERRLISTE_BLOCKED_DAYS_FIXTURE.map((entry) => ({
      id: entry.id,
      date: entry.date,
      reason: entry.reason,
      kind: entry.kind,
      createdAt: entry.createdAt,
    }));

    const overviewMembers: OverviewMember[] = DEV_SPERRLISTE_OVERVIEW_MEMBERS_FIXTURE.map((member) => ({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      name: member.name,
      email: member.email,
      avatarSource: member.avatarSource,
      avatarUpdatedAt: member.avatarUpdatedAt,
      onboardingFocus: member.onboardingFocus,
      blockedDays: member.blockedDays.map((entry) => ({
        id: entry.id,
        date: entry.date,
        reason: entry.reason,
        kind: entry.kind,
        createdAt: entry.createdAt,
      })),
    }));

    const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/sperrliste")];

    return (
      <div className="space-y-6">
        <PageHeader
          title="Sperrliste"
          breadcrumbs={breadcrumbs}
        />
        <SperrlistePageClient
          initialBlockedDays={initialBlockedDays}
          initialHolidays={DEV_SPERRLISTE_HOLIDAYS_FIXTURE}
          overviewMembers={overviewMembers}
          initialSettings={DEV_SPERRLISTE_CLIENT_SETTINGS_FIXTURE}
          canManageSettings={false}
          canExport={false}
          defaultHolidaySourceUrl={DEV_SPERRLISTE_DEFAULTS_FIXTURE.holidaySourceUrl}
          defaultPublicHolidaySourceUrl={DEV_SPERRLISTE_DEFAULTS_FIXTURE.publicHolidaySourceUrl}
          isOffline
          offlineMessage={DEV_SPERRLISTE_OFFLINE_MESSAGE}
        />
      </div>
    );
  }

  const settingsRecord = await readSperrlisteSettings();
  const resolvedSettingsBefore = resolveSperrlisteSettings(settingsRecord);

  const [personalBlockedDays, holidayRanges, overviewUsers] = await Promise.all([
    prisma.blockedDay.findMany({
      where: { userId },
      orderBy: { date: "asc" },
    }),
    getSaxonySchoolHolidayRanges(resolvedSettingsBefore.cacheKey),
    prisma.user.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        avatarSource: true,
        avatarImageUpdatedAt: true,
        onboardingProfile: {
          select: {
            focus: true,
          },
        },
        blockedDays: {
          orderBy: { date: "asc" },
          select: {
            id: true,
            date: true,
            reason: true,
            kind: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const refreshedSettingsRecord = await readSperrlisteSettings();
  const resolvedSettings = resolveSperrlisteSettings(refreshedSettingsRecord);
  const clientSettings = toClientSperrlisteSettings(resolvedSettings);
  const defaultHolidaySourceUrl = getDefaultHolidaySourceUrl();
  const defaultPublicHolidaySourceUrl = getDefaultPublicHolidaySourceUrl();

  const initialBlockedDays: BlockedDayDTO[] = personalBlockedDays.map((entry) => ({
    id: entry.id,
    date: format(entry.date, "yyyy-MM-dd"),
    reason: entry.reason,
    kind: entry.kind,
    createdAt: entry.createdAt.toISOString(),
  }));

  const overviewMembers: OverviewMember[] = overviewUsers.map((user) => ({
    id: user.id,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
    avatarSource: user.avatarSource ?? null,
    avatarUpdatedAt: user.avatarImageUpdatedAt
      ? user.avatarImageUpdatedAt.toISOString()
      : null,
    onboardingFocus: user.onboardingProfile?.focus ?? null,
    blockedDays: user.blockedDays.map((entry) => ({
      id: entry.id,
      date: format(entry.date, "yyyy-MM-dd"),
      reason: entry.reason,
      kind: entry.kind,
      createdAt: entry.createdAt.toISOString(),
    })),
  }));

  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/sperrliste")];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sperrliste"
        description="Markiere Tage, an denen du nicht verfügbar bist, damit das Team die Planung im Blick behält."
        breadcrumbs={breadcrumbs}
      />
      <SperrlistePageClient
        initialBlockedDays={initialBlockedDays}
        initialHolidays={holidayRanges}
        overviewMembers={overviewMembers}
        initialSettings={clientSettings}
        canManageSettings={canManageSettings}
        canExport={canExport}
        defaultHolidaySourceUrl={defaultHolidaySourceUrl}
        defaultPublicHolidaySourceUrl={defaultPublicHolidaySourceUrl}
        isOffline={false}
      />
    </div>
  );
}
