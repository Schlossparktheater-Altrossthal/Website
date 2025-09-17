import { PageHeader } from "@/components/members/page-header";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { CreateRehearsalButton } from "./create-rehearsal-button";
import { RehearsalCardWithActions } from "./rehearsal-card-with-actions";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
export default async function ProbenplanungPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.probenplanung");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Probenplanung</div>;
  }

  const rehearsals = await prisma.rehearsal.findMany({
    orderBy: { start: "asc" },
    include: {
      attendance: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      notifications: {
        include: {
          recipients: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Group rehearsals by month for a clearer overview
  const groups = new Map<string, typeof rehearsals>();
  for (const r of rehearsals) {
    const key = format(r.start, "yyyy-MM");
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const total = rehearsals.length;
  const upcoming = rehearsals.filter((r) => new Date(r.start) >= new Date()).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Probenplanung"
        description="Lege neue Proben an, verwalte Termine und Einladungen."
      />

      <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Insgesamt: {total}
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Bevorstehend: {upcoming}
            </span>
          </div>
          <div className="flex justify-end">
            <CreateRehearsalButton />
          </div>
        </div>
      </div>

      {rehearsals.length ? (
        <div className="space-y-6">
          {Array.from(groups.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, list]) => (
              <section key={key} className="space-y-3">
                <h2 className="sticky top-24 z-10 -mx-1 bg-background/70 px-1 text-lg font-semibold backdrop-blur supports-[backdrop-filter]:bg-background/50">
                  {format(new Date(key + "-01T00:00:00"), "MMMM yyyy", { locale: de })}
                </h2>
                <div className="space-y-4">
                  {list.map((rehearsal) => (
                    <RehearsalCardWithActions key={rehearsal.id} rehearsal={rehearsal} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Es sind aktuell keine Proben geplant.</p>
      )}
    </div>
  );
}
