import Link from "next/link";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";

import { PageHeader } from "@/components/members/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { getUserDisplayName } from "@/lib/names";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Geplant",
  CONFIRMED: "Bestätigt",
  CANCELLED: "Abgesagt",
  COMPLETED: "Abgeschlossen",
};

const RESPONSE_LABELS: Record<string, string> = {
  yes: "Zusage",
  no: "Absage",
  emergency: "Notfall",
  maybe: "Unentschieden",
  open: "Keine Rückmeldung",
};

const RESPONSE_BADGES: Record<string, string> = {
  yes: "border-emerald-200 bg-emerald-500/10 text-emerald-700",
  no: "border-rose-200 bg-rose-500/10 text-rose-700",
  emergency: "border-amber-200 bg-amber-500/10 text-amber-700",
  maybe: "border-sky-200 bg-sky-500/10 text-sky-700",
  open: "border-slate-200 bg-muted text-muted-foreground",
};

function sanitizeDescription(html: string | null | undefined) {
  if (!html) return null;
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "blockquote", "a", "h2", "h3"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

type DisplayUser = {
  firstName?: string | null;
  lastName?: string | null;
  name: string | null;
  email: string | null;
};

function displayName(user?: DisplayUser | null) {
  if (!user) return "Unbekannt";
  return getUserDisplayName(user, "Unbekannt");
}

export default async function RehearsalDetailPage({
  params,
}: {
  params: Promise<{ rehearsalId: string }>;
}) {
  const session = await requireAuth();
  const [canViewOwn, canPlan] = await Promise.all([
    hasPermission(session.user, "mitglieder.meine-proben"),
    hasPermission(session.user, "mitglieder.probenplanung"),
  ]);

  if (!canViewOwn && !canPlan) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Probenansicht.</div>;
  }

  const resolvedParams = await params;
  const rehearsalId = resolvedParams?.rehearsalId;
  if (!rehearsalId) {
    notFound();
  }

  const rehearsal = await prisma.rehearsal.findUnique({
    where: { id: rehearsalId },
    include: {
      invitees: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true,
              roles: { select: { role: true } },
            },
          },
        },
      },
      attendance: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
        },
      },
    },
  });

  if (!rehearsal) {
    return <div className="text-sm text-red-600">Diese Probe existiert nicht.</div>;
  }

  if (rehearsal.status === "DRAFT" && !canPlan) {
    return <div className="text-sm text-muted-foreground">Dieser Entwurf ist noch nicht veröffentlicht.</div>;
  }

  const formatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" });
  const sanitizedDescription = sanitizeDescription(rehearsal.description);
  const attendanceMap = new Map(rehearsal.attendance.map((entry) => [entry.userId, entry.status ?? "open"]));

  const invitees = rehearsal.invitees.map((invitee) => {
    const status = attendanceMap.get(invitee.userId) ?? "open";
    return {
      id: invitee.userId,
      user: invitee.user,
      status,
    };
  });

  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/meine-proben"),
    { id: rehearsal.id, label: rehearsal.title || "Probe", isCurrent: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={rehearsal.title || "Probe"}
        description="Alle Details, Teilnehmer und Rückmeldungen zu diesem Termin."
        breadcrumbs={breadcrumbs}
      />

      <Card>
        <CardHeader>
          <CardTitle>Überblick</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {STATUS_LABELS[rehearsal.status] ?? rehearsal.status}
            </Badge>
            {canPlan && rehearsal.status === "DRAFT" ? (
              <Badge variant="destructive">Entwurf</Badge>
            ) : null}
            {canPlan ? (
              <Link
                href={`/mitglieder/probenplanung/proben/${rehearsal.id}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                In der Planung bearbeiten
              </Link>
            ) : null}
          </div>
          <p>
            <span className="font-medium text-foreground">Wann:&nbsp;</span>
            {formatter.format(rehearsal.start)}
          </p>
          <p>
            <span className="font-medium text-foreground">Ort:&nbsp;</span>
            {rehearsal.location}
          </p>
          {rehearsal.registrationDeadline ? (
            <p>
              <span className="font-medium text-foreground">Rückmeldefrist:&nbsp;</span>
              {formatter.format(rehearsal.registrationDeadline)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {sanitizedDescription ? (
        <Card>
          <CardHeader>
            <CardTitle>Beschreibung</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-a:text-primary"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Eingeladene Mitglieder</CardTitle>
        </CardHeader>
        <CardContent>
          {invitees.length ? (
            <ul className="space-y-2">
              {invitees.map((entry) => {
                const status = RESPONSE_LABELS[entry.status] ? entry.status : "open";
                return (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/70 p-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">{displayName(entry.user)}</p>
                      {entry.user.email ? (
                        <p className="text-xs text-muted-foreground">{entry.user.email}</p>
                      ) : null}
                    </div>
                    <Badge variant="outline" className={RESPONSE_BADGES[status] ?? RESPONSE_BADGES.open}>
                      {RESPONSE_LABELS[status] ?? RESPONSE_LABELS.open}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Für diese Probe wurden noch keine Einladungen vergeben.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
