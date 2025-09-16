import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { RehearsalPlanningClient } from "./client";
import { PageHeader } from "@/components/members/page-header";

export default async function ProbenplanungPage() {
  const session = await requireAuth(["board", "admin", "tech"]);
  
  try {
    // Lade Templates und geplante Proben
    const templates = await prisma.rehearsalTemplate.findMany({
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }]
    });
    
    const rehearsals = await prisma.rehearsal.findMany({
      where: {
        start: {
          gte: new Date()
        }
      },
      include: {
        show: true,
        attendance: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
      orderBy: { start: "asc" }
    });
    
    const shows = await prisma.show.findMany({
      select: { id: true, title: true, year: true },
      orderBy: { year: "desc" }
    });

    return (
      <div className="space-y-6">
        <PageHeader 
          title="Probenplanung" 
          description="Verwalte Proben-Templates und plane kommende Proben"
        />
        
        <RehearsalPlanningClient 
          templates={JSON.parse(JSON.stringify(templates))}
          rehearsals={JSON.parse(JSON.stringify(rehearsals))}
          shows={shows.map(s => ({ ...s, title: s.title || undefined }))}
        />
      </div>
    );
  } catch (error) {
    console.error("Error loading rehearsal planning data:", error);
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Probenplanung" 
          description="Fehler beim Laden der Daten"
        />
        <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
          <p>Die Datenbank-Struktur wird gerade aktualisiert. Bitte versuche es in wenigen Minuten erneut.</p>
        </div>
      </div>
    );
  }
}
