import { PageHeader } from "@/components/members/page-header";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { CreateRehearsalButton } from "./create-rehearsal-button";
import { RehearsalCardWithActions } from "./rehearsal-card-with-actions";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Probenplanung"
        description="Lege neue Proben an und behalte im Blick, wer zugesagt hat."
      />

      <div className="flex justify-end">
        <CreateRehearsalButton />
      </div>

      {rehearsals.length ? (
        <div className="space-y-4">
          {rehearsals.map((rehearsal) => (
            <RehearsalCardWithActions key={rehearsal.id} rehearsal={rehearsal} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Es sind aktuell keine Proben geplant.
        </p>
      )}
    </div>
  );
}
