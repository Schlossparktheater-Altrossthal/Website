import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { addDays, format } from "date-fns";
import type { BlockedDay as BlockedDayDTO } from "./block-calendar";
import { getSaxonySchoolHolidayRanges } from "@/lib/holidays";
import { SperrlisteTabs } from "./sperrliste-tabs";
import type { OverviewMember } from "./block-overview";

export default async function SperrlistePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.sperrliste");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Sperrliste</div>;
  }
  const userId = session.user?.id;

  if (!userId) {
    throw new Error("Benutzerinformationen konnten nicht geladen werden.");
  }

  const [personalBlockedDays, holidayRanges, overviewUsers] = await Promise.all([
    prisma.blockedDay.findMany({
      where: { userId },
      orderBy: { date: "asc" },
    }),
    getSaxonySchoolHolidayRanges(),
    prisma.user.findMany({
      orderBy: [
        { firstName: "asc" },
        { lastName: "asc" },
      ],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        avatarSource: true,
        avatarImageUpdatedAt: true,
        blockedDays: {
          orderBy: { date: "asc" },
          select: {
            id: true,
            date: true,
            reason: true,
          },
        },
      },
    }),
  ]);

  const initialBlockedDays: BlockedDayDTO[] = personalBlockedDays.map((entry) => ({
    id: entry.id,
    date: format(entry.date, "yyyy-MM-dd"),
    reason: entry.reason,
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
    blockedDays: user.blockedDays.map((entry) => ({
      id: entry.id,
      date: format(entry.date, "yyyy-MM-dd"),
      reason: entry.reason,
    })),
  }));

  const freezeUntil = addDays(new Date(), 7);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sperrliste"
        description="Markiere Tage, an denen du nicht verfügbar bist, damit das Team die Planung im Blick behält."
      />
      <SperrlisteTabs
        initialBlockedDays={initialBlockedDays}
        holidays={holidayRanges}
        overviewMembers={overviewMembers}
        freezeUntil={freezeUntil.toISOString()}
      />
    </div>
  );
}
