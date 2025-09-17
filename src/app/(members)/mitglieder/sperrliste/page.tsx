import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { format } from "date-fns";
import { BlockCalendar } from "./block-calendar";

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

  const initialBlockedDays: BlockedDayDTO[] = blockedDays.map((entry) => ({
    id: entry.id,
    date: format(entry.date, "yyyy-MM-dd"),
    reason: entry.reason,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sperrliste"
        description="Markiere Tage, an denen du nicht verfügbar bist, damit das Team die Planung im Blick behält."
      />
      <BlockCalendar initialBlockedDays={initialBlockedDays} />
    </div>
  );
}
