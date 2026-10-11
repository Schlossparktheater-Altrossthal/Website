import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { PUBLIC_TICKETS_PATH } from "@/lib/karten/constants";
import { showDisplayTitle } from "@/lib/karten/mails";
import { loadPublicShows } from "@/lib/karten/queries";

export const dynamic = "force-dynamic";

export default async function PublicTicketsIndexPage() {
  const shows = await loadPublicShows();
  if (shows.length === 1) redirect(`${PUBLIC_TICKETS_PATH}/${shows[0].id}`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold md:text-3xl">Karten reservieren</h1>
      {shows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Zurzeit gibt es keine Vorstellungen mit Kartenreservierung. Schau bald wieder vorbei!
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shows.map((show) => (
            <Link key={show.id} href={`${PUBLIC_TICKETS_PATH}/${show.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <h2 className="text-lg font-semibold">{showDisplayTitle(show)}</h2>
                <p className="text-sm text-muted-foreground">Sommer {show.year}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
