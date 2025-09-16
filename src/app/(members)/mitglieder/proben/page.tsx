import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { RehearsalDashboard } from "./client";
import { PageHeader } from "@/components/members/page-header";
import { Card } from "@/components/ui/card";

export default async function ProbenPage() {
  const session = await requireAuth();
  const userId = (session.user as any).id as string;

  try {
    const rehearsals = await prisma.rehearsal.findMany({
      where: {
        start: {
          gte: new Date(),
        },
      },
      include: {
        show: {
          select: { id: true, title: true, year: true },
        },
        attendance: {
          where: { userId },
          select: { status: true },
        },
        attendanceLogs: {
          where: { userId },
          orderBy: { changedAt: "desc" },
          take: 10,
          include: {
            changedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: { attendance: true },
        },
      },
      orderBy: { start: "asc" },
    });

    const rehearsalsForClient = rehearsals.map((rehearsal) => ({
      id: rehearsal.id,
      title: rehearsal.show?.title || "Probe",
      start: rehearsal.start.toISOString(),
      end: rehearsal.end.toISOString(),
      location: rehearsal.location,
      show: rehearsal.show
        ? { id: rehearsal.show.id, title: rehearsal.show.title, year: rehearsal.show.year }
        : null,
      myStatus: rehearsal.attendance[0]?.status || null,
      totalAttendees: rehearsal._count.attendance,
      logs: rehearsal.attendanceLogs.map((log) => ({
        id: log.id,
        previous: log.previous,
        next: log.next,
        comment: log.comment,
        changedAt: log.changedAt.toISOString(),
        changedBy: {
          id: log.changedBy.id,
          name: log.changedBy.name,
          email: log.changedBy.email,
        },
      })),
    }));

    return (
      <div className="space-y-6">
        <PageHeader
          title="Meine Proben"
          description="Übersicht über kommende Proben, Status und Kommentare"
        />

        <RehearsalDashboard rehearsals={rehearsalsForClient} />
      </div>
    );
  } catch (error) {
    console.error("Error loading rehearsals:", error);
    return (
      <div className="space-y-6">
        <PageHeader
          title="Meine Proben"
          description="Fehler beim Laden der Proben"
        />
        <Card className="p-6 border-red-200 bg-red-50">
          <p>Die Proben-Daten konnten nicht geladen werden. Bitte versuche es später erneut.</p>
        </Card>
      </div>
    );
  }
}
