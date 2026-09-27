import { blockLabel } from "@/lib/calendar/scene-schedule";
import type { EventStatus } from "@prisma/client";
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

const STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: "Entwurf",
  TENTATIVE: "Vorgemerkt",
  SCHEDULED: "Geplant",
  CANCELLED: "Abgesagt",
};

function sanitizeDescription(html: string | null | undefined) {
  if (!html) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "blockquote", "a", "h2", "h3"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
  // Ein leerer Editor speichert „<p></p>“ – dann gibt es keine Beschreibung.
  return sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).trim() ? clean : null;
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
  const [canViewOwn, canPlanAnywhere] = await Promise.all([
    hasPermission(session.user, "PRIVATE.REHEARSAL.OWN.VIEW"),
    hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE"),
  ]);

  if (!canViewOwn && !canPlanAnywhere) {
    return <div className="text-sm text-destructive">Kein Zugriff auf die Probenansicht.</div>;
  }

  const resolvedParams = await params;
  const rehearsalId = resolvedParams?.rehearsalId;
  if (!rehearsalId) {
    notFound();
  }

  const rehearsal = await prisma.calendarEvent.findFirst({
    // Proben und andere Termine mit Einladung; Gewerk-Termine stehen im Gewerk-Portal.
    where: { id: rehearsalId, departmentId: null },
    include: {
      blocks: {
        orderBy: [{ startsAt: { sort: "asc", nulls: "last" } }, { order: "asc" }],
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          type: true,
          title: true,
          location: true,
          description: true,
          scene: { select: { identifier: true, sequence: true, title: true } },
          department: { select: { name: true } },
        },
      },
      participants: {
        where: { invited: true },
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
    },
  });

  if (!rehearsal) {
    return <div className="text-sm text-destructive">Dieser Termin existiert nicht.</div>;
  }
  const agenda = rehearsal.blocks.filter((block) => block.type !== "SCENE" || block.scene);

  // Produktionsrollen planen nur Proben ihrer eigenen Produktion.
  const canPlan =
    canPlanAnywhere &&
    (!rehearsal.showId ||
      (await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE", {
        showId: rehearsal.showId,
      })));

  if (rehearsal.status === "DRAFT" && !canPlan) {
    return (
      <div className="text-sm text-muted-foreground">
        Dieser Entwurf ist noch nicht veröffentlicht.
      </div>
    );
  }

  const formatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" });
  const sanitizedDescription = sanitizeDescription(rehearsal.description);
  const timeFormatter = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
  const own = rehearsal.participants.find((entry) => entry.userId === session.user?.id);
  const ownWindow =
    own?.personalStart && own.personalEnd
      ? { start: own.personalStart, end: own.personalEnd }
      : null;
  const invitees = rehearsal.participants.map((invitee) => ({
    id: invitee.userId,
    user: invitee.user,
    optional: invitee.level === "OPTIONAL",
    declined: invitee.response === "no" || invitee.response === "emergency",
  }));

  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/meine-proben"),
    { id: rehearsal.id, label: rehearsal.title || "Termin", isCurrent: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={rehearsal.title || "Termin"}
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
              {STATUS_LABELS[rehearsal.status]}
            </Badge>
            {canPlan && rehearsal.status === "DRAFT" ? (
              <Badge variant="destructive">Entwurf</Badge>
            ) : null}
            {canPlan ? (
              <Link
                href={`/mitglieder/terminplanung/${rehearsal.id}`}
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
        </CardContent>
      </Card>

      {agenda.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Ablauf</CardTitle>
            {ownWindow ? (
              <p className="text-sm text-muted-foreground">
                Deine Zeit laut Ablauf: {timeFormatter.format(ownWindow.start)}–
                {timeFormatter.format(ownWindow.end)} Uhr
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {agenda.map((block) => (
                <li key={block.id} className="flex gap-3">
                  {block.startsAt && block.endsAt ? (
                    <span className="w-28 shrink-0 tabular-nums text-muted-foreground">
                      {timeFormatter.format(block.startsAt)}–{timeFormatter.format(block.endsAt)}
                    </span>
                  ) : null}
                  <span>
                    {blockLabel(block)}
                    {block.description ? (
                      <span className="block text-xs text-muted-foreground">
                        {block.description}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

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
                    {entry.declined ? (
                      <Badge
                        variant="outline"
                        className="border-destructive bg-destructive/10 text-destructive"
                      >
                        Abgesagt
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        {entry.optional ? "Optional" : "Erwartet"}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Für diesen Termin wurden noch keine Einladungen vergeben.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
