import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/members/page-header";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { CreateRehearsalButton } from "./create-rehearsal-button";

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

function displayName(user?: { name: string | null; email: string | null }) {
  if (!user) return "Unbekannt";
  return user.name?.trim() || user.email?.trim() || "Unbekannt";
}

function ResponseColumn({
  title,
  people,
  emptyText,
}: {
  title: string;
  people: Array<{ id: string; name: string | null; email: string | null }>;
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground/90">{title}</div>
      {people.length ? (
        <ul className="space-y-1 text-sm">
          {people.map((person) => (
            <li
              key={person.id}
              className="rounded border border-border/50 bg-background/80 px-2 py-1"
            >
              {displayName(person)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

function RehearsalCard({ rehearsal }: { rehearsal: RehearsalWithRelations }) {
  const notification = rehearsal.notifications[0];
  const yes = rehearsal.attendance.filter((entry) => entry.status === "yes");
  const no = rehearsal.attendance.filter((entry) => entry.status !== "yes");
  const respondedIds = new Set(rehearsal.attendance.map((entry) => entry.userId));
  const pending = (notification?.recipients ?? []).filter(
    (recipient) => !respondedIds.has(recipient.userId),
  );

  return (
    <details className="overflow-hidden rounded-lg border border-border/60 bg-card/60">
      <summary className="list-none cursor-pointer px-5 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-lg text-foreground">{rehearsal.title}</h3>
            <p className="text-sm text-muted-foreground">
              {dateFormatter.format(new Date(rehearsal.start))}
              {" · "}
              {timeFormatter.format(new Date(rehearsal.start))}
            </p>
            <p className="text-xs text-muted-foreground/80">Ort: {rehearsal.location}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600">
              ✅ {yes.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-rose-600">
              ❌ {no.length}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-muted-foreground">
              … {pending.length}
            </span>
          </div>
        </div>
      </summary>
      <div className="grid gap-6 border-t border-border/60 px-5 py-4 sm:grid-cols-3">
        <ResponseColumn
          title="Zusagen"
          people={yes.map((entry) => ({
            id: entry.user.id,
            name: entry.user.name,
            email: entry.user.email,
          }))}
          emptyText="Noch keine Zusagen."
        />
        <ResponseColumn
          title="Absagen"
          people={no.map((entry) => ({
            id: entry.user.id,
            name: entry.user.name,
            email: entry.user.email,
          }))}
          emptyText="Noch keine Absagen."
        />
        <ResponseColumn
          title="Offen"
          people={pending.map((recipient) => ({
            id: recipient.user.id,
            name: recipient.user.name,
            email: recipient.user.email,
          }))}
          emptyText={notification ? "Alle haben reagiert." : "Es wurde noch keine Benachrichtigung verschickt."}
        />
      </div>
    </details>
  );
}

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
            <RehearsalCard key={rehearsal.id} rehearsal={rehearsal} />
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
