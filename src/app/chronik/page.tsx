import { prisma } from "@/lib/prisma";
import type { Show } from "@prisma/client";
import { ChronikStacked } from "./stacked";
import { ChronikTimeline } from "./timeline";

export default async function ChronikPage() {
  const now = new Date();
  let shows: Show[] = [];
  try {
    shows = await prisma.show.findMany({
      where: { revealedAt: { not: null, lte: now } },
      orderBy: [{ year: "desc" }],
    });
  } catch {
    shows = [];
  }

  if (shows.length === 0) {
    return (
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-foreground/90">Chronik erwacht bald</h1>
          <p className="text-foreground/70 leading-relaxed">
            Die Geschichten vergangener Sommer werden bald enthüllt. Hier werden die mystischen Momente unserer Aufführungen für die Ewigkeit bewahrt.
          </p>
        </div>
      </div>
    );
  }

  const items = shows.map((s) => ({
    id: s.id,
    year: s.year,
    title: s.title,
    synopsis: s.synopsis ?? null,
    posterUrl: s.posterUrl ?? null,
    meta: (s as any).meta ?? null,
  }));
  
  return (
    <div className="relative">
      {/* Header Section */}
      <div className="container mx-auto px-6 py-16 text-center space-y-6">
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-white [text-shadow:_0_0_10px_rgba(0,0,0,0.9),_2px_2px_6px_rgba(0,0,0,0.8)]">
          Chronik vergangener Sommer
        </h1>
        <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto [text-shadow:_0_0_8px_rgba(0,0,0,0.9),_1px_1px_4px_rgba(0,0,0,0.8)]">
          Eine Reise durch die mystischen Momente unserer Aufführungen
        </p>
      </div>

      {/* Gallery Content */}
      <ChronikStacked items={items as any} />
      
      {/* Animated Bottom Timeline */}
      <ChronikTimeline items={items} />
    </div>
  );
}
