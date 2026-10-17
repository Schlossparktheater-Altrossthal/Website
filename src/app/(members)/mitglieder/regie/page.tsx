import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { requireAuth } from "@/lib/rbac";
import { DIRECTION_HOME_PATH, getDirectionShows, pickDirectionShow } from "@/lib/regie/access";
import { cn } from "@/lib/utils";

export const metadata = { title: "Regie" };

type SearchParams = Promise<{ show?: string | string[] }>;

/** Regie-Dashboard (docs/Plan/regie-plan.md). Die Karten folgen in Phase 3–6. */
export default async function DirectionDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) redirect("/login");

  const shows = await getDirectionShows(userId);
  const requested = (await searchParams).show;
  const show = pickDirectionShow(shows, Array.isArray(requested) ? requested[0] : requested);

  if (!show) {
    return (
      <div className="space-y-6">
        <PageHeader title="Regie" />
        <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
          Du bist noch keiner Produktion als Regie oder Regieassistenz zugeordnet. Bitte wende dich
          an die Produktionsleitung.
        </p>
      </div>
    );
  }

  const showLabel = `${show.title ?? "Produktion"} ${show.year}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Regie" description={showLabel} />

      {shows.length > 1 ? (
        <nav aria-label="Produktion wählen" className="flex flex-wrap gap-2">
          {shows.map((entry) => (
            <Link
              key={entry.id}
              href={`${DIRECTION_HOME_PATH}?show=${encodeURIComponent(entry.id)}`}
              aria-current={entry.id === show.id ? "page" : undefined}
              className={cn(
                "min-h-11 rounded-full border px-4 py-2.5 text-sm font-medium",
                entry.id === show.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              {entry.title ?? "Produktion"} {entry.year}
            </Link>
          ))}
        </nav>
      ) : null}

      <p className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
        Hier entsteht das Regie-Dashboard mit Proben, Besetzung, Szenen, Listen und den Wünschen an
        die Planung.
      </p>
    </div>
  );
}
