import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { RehearsalAvailabilityClient } from "./client";
import { PageHeader } from "@/components/members/page-header";

export default async function VerfuegbarkeitPage() {
  const session = await requireAuth();
  const userId = (session.user as any).id as string;

  try {
    // Lade kommende Proben für die nächsten 2 Monate
    const twoMonthsFromNow = new Date();
    twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);

    const upcomingRehearsals = await prisma.rehearsal.findMany({
      where: {
        start: {
          gte: new Date(),
          lte: twoMonthsFromNow
        }
      },
      include: {
        show: {
          select: { id: true, title: true, year: true }
        },
        attendance: {
          where: { userId },
          select: { id: true, status: true }
        }
      },
      orderBy: { start: "asc" }
    });

    // Lade Verfügbarkeits-Templates des Users
    const availabilityTemplates = await prisma.availabilityTemplate.findMany({
      where: { userId }
    });

    // Lade spezifische Verfügbarkeiten für die kommenden Proben-Tage
    const rehearsalDates = upcomingRehearsals.map(r => 
      new Date(new Date(r.start).toDateString()) // Nur das Datum ohne Zeit
    );

    const availabilityDays = await prisma.availabilityDay.findMany({
      where: {
        userId,
        date: {
          in: rehearsalDates
        }
      }
    });

    return (
      <div className="space-y-6">
        <PageHeader 
          title="Verfügbarkeit für Proben" 
          description="Teile mit, wann du für kommende Proben verfügbar bist"
        />
        
        <RehearsalAvailabilityClient 
          rehearsals={JSON.parse(JSON.stringify(upcomingRehearsals))}
          availabilityTemplates={JSON.parse(JSON.stringify(availabilityTemplates))}
          availabilityDays={JSON.parse(JSON.stringify(availabilityDays))}
          userId={userId}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading availability data:", error);
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Verfügbarkeit" 
          description="Fehler beim Laden der Daten"
        />
        <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
          <p>Die Datenbank-Struktur wird gerade aktualisiert. Bitte versuche es in wenigen Minuten erneut.</p>
        </div>
      </div>
    );
  }
}
