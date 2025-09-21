import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { addDays, format } from "date-fns";
import { de } from "date-fns/locale/de";
import { BlockCalendar } from "./block-calendar";
import { getSaxonySchoolHolidayRanges } from "@/lib/holidays";

type BlockedDayDTO = {
  id: string;
  date: string;
  reason: string | null;
};

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

  const blockedDays = await prisma.blockedDay.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });

  const holidayRanges = await getSaxonySchoolHolidayRanges();

  const initialBlockedDays: BlockedDayDTO[] = blockedDays.map((entry) => ({
    id: entry.id,
    date: format(entry.date, "yyyy-MM-dd"),
    reason: entry.reason,
  }));

  const freezeUntil = addDays(new Date(), 7);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sperrliste"
        description="Markiere Tage, an denen du nicht verfügbar bist, damit das Team die Planung im Blick behält."
      />
      <div className="rounded-md border p-3 text-sm
        border-amber-300 bg-amber-50 text-amber-900
        dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
        Hinweis: Aus Planungsgründen können Sperrtermine erst ab {format(freezeUntil, "EEEE, d. MMMM yyyy", { locale: de })} eingetragen werden.
      </div>
      <BlockCalendar initialBlockedDays={initialBlockedDays} holidays={holidayRanges} />
    </div>
  );
}
