import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { RehearsalCalendar } from "./client";
import { PageHeader } from "@/components/members/page-header";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Users } from "lucide-react";

export default async function ProbenPage() {
  const session = await requireAuth();
  const userId = (session.user as any).id as string;

  try {
    // Lade kommende Proben mit Attendance-Informationen
    const rehearsals = await prisma.rehearsal.findMany({ 
      where: {
        start: {
          gte: new Date()
        }
      },
      include: {
        show: {
          select: { id: true, title: true, year: true }
        },
        attendance: {
          where: { userId },
          select: { status: true }
        },
        _count: {
          select: { attendance: true }
        }
      },
      orderBy: { start: "asc" }
    });

    const events = rehearsals.map((r) => ({ 
      id: r.id, 
      title: r.show?.title || "Probe", 
      start: r.start, 
      end: r.end, 
      location: r.location,
      myStatus: r.attendance[0]?.status || null,
      totalAttendees: r._count.attendance
    }));

    const upcomingRehearsals = rehearsals.slice(0, 3); // Nächste 3 Proben

    return (
      <div className="space-y-6">
        <PageHeader 
          title="Meine Proben" 
          description="Übersicht über kommende Proben und deine Zusagen"
        />

        {/* Nächste Proben als Cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Nächste Proben</h2>
          {upcomingRehearsals.length === 0 ? (
            <Card className="p-6 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Keine kommenden Proben geplant</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {upcomingRehearsals.map((rehearsal) => (
                <Card key={rehearsal.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {rehearsal.show?.title || "Probe"}
                        </h3>
                        {rehearsal.show && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            {rehearsal.show.year}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(rehearsal.start).toLocaleDateString("de-DE")}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(rehearsal.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {rehearsal.location}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {rehearsal._count.attendance} Zusagen
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-sm px-2 py-1 rounded ${
                        rehearsal.attendance[0]?.status === "yes" ? "bg-green-100 text-green-800" :
                        rehearsal.attendance[0]?.status === "no" ? "bg-red-100 text-red-800" :
                        rehearsal.attendance[0]?.status === "maybe" ? "bg-amber-100 text-amber-800" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {rehearsal.attendance[0]?.status === "yes" ? "Zusage" :
                         rehearsal.attendance[0]?.status === "no" ? "Absage" :
                         rehearsal.attendance[0]?.status === "maybe" ? "Vielleicht" :
                         "Offen"}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Kalender-Ansicht */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Kalender-Ansicht</h2>
          <RehearsalCalendar events={events as any} />
        </div>
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

