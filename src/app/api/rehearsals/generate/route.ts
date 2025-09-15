import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(["board", "admin", "tech"]);
    const { weeksAhead = 8 } = await request.json();
    
    // Hole aktive Templates
    const templates = await prisma.rehearsalTemplate.findMany({
      where: { isActive: true }
    });
    
    if (templates.length === 0) {
      return NextResponse.json({ error: "Keine aktiven Templates gefunden" }, { status: 400 });
    }
    
    const createdRehearsals = [];
    const today = new Date();
    const endDate = new Date(today.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000);
    
    // Für jede Woche in dem Zeitraum
    for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
      const weekday = d.getDay();
      const dateTemplates = templates.filter(t => t.weekday === weekday);
      
      for (const template of dateTemplates) {
        // Prüfe ob bereits eine Probe für diesen Tag existiert
        const existing = await prisma.rehearsal.findFirst({
          where: {
            start: {
              gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
              lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
            }
          }
        });
        
        if (!existing) {
          // Erstelle neue Probe basierend auf Template
          const [startHour, startMin] = template.startTime.split(':').map(Number);
          const [endHour, endMin] = template.endTime.split(':').map(Number);
          
          const startDateTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour, startMin);
          const endDateTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), endHour, endMin);
          
          const rehearsal = await prisma.rehearsal.create({
            data: {
              title: template.name,
              start: startDateTime,
              end: endDateTime,
              location: template.location,
              description: template.description,
              requiredRoles: template.requiredRoles,
              isFromTemplate: true,
              templateId: template.id,
              priority: template.priority,
              status: "PLANNED",
              createdBy: (session.user as any).id
            }
          });
          
          createdRehearsals.push(rehearsal);
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      created: createdRehearsals.length,
      message: `${createdRehearsals.length} Proben erstellt` 
    });
    
  } catch (error) {
    console.error("Error generating rehearsals:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
