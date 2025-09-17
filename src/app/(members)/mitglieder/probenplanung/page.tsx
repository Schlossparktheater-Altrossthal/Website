import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/members/page-header";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { CreateRehearsalButton } from "./create-rehearsal-button";
import { RehearsalCardWithActions } from "./rehearsal-card-with-actions";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
});

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeStyle: "short",
});

type RehearsalWithRelations = Prisma.RehearsalGetPayload<{
  include: {
    attendance: {
      include: {
        user: { select: { id: true; name: true; email: true } };
      };
    };
    notifications: {
      include: {
        recipients: {
          include: {
            user: { select: { id: true; name: true; email: true } };
          };
        };
      };
    };
  };
}>;



export default async function ProbenplanungPage() {
  await requireAuth(["board", "admin", "tech"]);

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
