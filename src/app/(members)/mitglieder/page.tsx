import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { Rehearsal } from "@prisma/client";
import { AttendanceForm } from "./save-attendance";
import { PageHeader } from "@/components/members/page-header";
import { StatCard } from "@/components/members/stat-card";
import { Calendar, Clock, Users } from "lucide-react";

type SessionUser = { id: string; name?: string | null; email?: string | null };

export default async function MitgliederPage() {
  const session = await requireAuth();
  const user = session.user as SessionUser | undefined;
  let rehearsal: Rehearsal | null = null;
  try {
    rehearsal = await prisma.rehearsal.findFirst({ orderBy: { start: "asc" } });
  } catch {
    rehearsal = null;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mitgliederbereich" description={`Willkommen, ${user?.name ?? user?.email ?? ""}`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Nächste Probe" value={rehearsal ? new Date(rehearsal.start).toLocaleString("de-DE") : "keine geplant"} icon={<Calendar size={20} />} />
        <StatCard label="Dauer" value={rehearsal ? `${Math.round((new Date(rehearsal.end).getTime() - new Date(rehearsal.start).getTime())/3600000)}h` : "–"} icon={<Clock size={20} />} />
        <StatCard label="Team" value="Besetzung (bald)" icon={<Users size={20} />} />
      </div>

      <div className="space-y-2">
        {rehearsal ? (
          <>
            <div className="font-semibold">Zusage zur nächsten Probe</div>
            <AttendanceForm rehearsalId={rehearsal.id} />
          </>
        ) : (
          <p>Noch keine Proben geplant.</p>
        )}
      </div>
    </div>
  );
}
