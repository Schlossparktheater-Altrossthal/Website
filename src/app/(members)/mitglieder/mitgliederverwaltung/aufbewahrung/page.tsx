import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/members/page-header";
import { hasPermission } from "@/lib/permissions";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";
import { findPossibleDuplicates } from "@/lib/member-duplicates";
import { prisma } from "@/lib/prisma";
import { RETENTION_YEARS, collectRetentionCandidates } from "@/lib/retention";

import { AnonymizeButton, PurgeButton } from "./retention-forms-client";

export const dynamic = "force-dynamic";

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);

export default async function AufbewahrungPage() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.MEMBERS.MANAGE"))) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive-foreground">
        Kein Zugriff auf die Mitgliederverwaltung.
      </div>
    );
  }

  const [candidates, users] = await Promise.all([
    collectRetentionCandidates(),
    prisma.user.findMany({
      where: { anonymizedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        dateOfBirth: true,
        deactivatedAt: true,
      },
    }),
  ]);
  const duplicates = findPossibleDuplicates(users);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aufbewahrung & Löschfristen"
        description={`Fristen ab dem Ende der letzten Produktion einer Person: Ernährung und Allergien ${RETENTION_YEARS.dietary} Jahre, Fotoerlaubnisse ${RETENTION_YEARS.photoConsent} Jahre nach Ende der jeweiligen Produktion, Konten ${RETENTION_YEARS.account} Jahre. Wer in einer geplanten oder aktiven Produktion ist, wird nie aufgeführt. Nichts wird automatisch gelöscht.`}
        breadcrumbs={[
          membersNavigationBreadcrumb("/mitglieder/mitgliederverwaltung"),
          { id: "aufbewahrung", label: "Aufbewahrung", isCurrent: true },
        ]}
        actions={
          <Button asChild variant="outline" size="sm" className="whitespace-nowrap">
            <Link href="/mitglieder/mitgliederverwaltung">Zur Mitgliederverwaltung</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Mögliche Doppel-Konten ({duplicates.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hinweise auf Personen mit mehreren Konten, z. B. nach einem neuen Onboarding mit anderer
            E-Mail-Adresse. Bitte prüfen und das überzählige Konto deaktivieren; ein automatisches
            Zusammenführen gibt es nicht.
          </p>
        </CardHeader>
        <CardContent>
          {duplicates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Auffälligkeiten.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {duplicates.map((group) => (
                <li key={group.users.map((user) => user.id).join("|")} className="space-y-1 py-2">
                  <p className="text-muted-foreground">{group.reason}</p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1">
                    {group.users.map((user) => (
                      <li key={user.id}>
                        <Link
                          href={`/mitglieder/mitgliederverwaltung/${user.id}`}
                          className="font-medium hover:underline"
                        >
                          {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                            user.name ||
                            user.email ||
                            user.id}
                        </Link>
                        <span className="text-muted-foreground">
                          {user.email ? ` · ${user.email}` : ""}
                          {user.deactivatedAt ? " · deaktiviert" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>
            Ernährung &amp; Allergien älter als {RETENTION_YEARS.dietary} Jahre (
            {candidates.dietary.length})
          </CardTitle>
          <PurgeButton kind="dietary" count={candidates.dietary.length} />
        </CardHeader>
        <CardContent>
          {candidates.dietary.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nichts zu löschen.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {candidates.dietary.map((entry) => (
                <li key={entry.id}>
                  {entry.name}{" "}
                  <span className="text-muted-foreground">
                    · zuletzt dabei bis {formatDate(entry.lastEnd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>
            Fotoerlaubnisse älter als {RETENTION_YEARS.photoConsent} Jahre (
            {candidates.photoConsents.length})
          </CardTitle>
          <PurgeButton kind="photoConsents" count={candidates.photoConsents.length} />
        </CardHeader>
        <CardContent>
          {candidates.photoConsents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nichts zu löschen.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {candidates.photoConsents.map((entry) => (
                <li key={entry.id}>
                  {entry.userName}{" "}
                  <span className="text-muted-foreground">
                    · {entry.showTitle}, beendet {formatDate(entry.showEnd)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Konten ohne Produktion seit {RETENTION_YEARS.account} Jahren (
            {candidates.accounts.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Nur deaktivierte Konten ohne Vorstands-, Finanz- oder Admin-Rolle. Beim Anonymisieren
            bleiben Produktionszugehörigkeit, Proben- und Finanzeinträge erhalten, Name, Kontakt-,
            Gesundheits- und Zahlungsdaten werden gelöscht. Das Theater-Konto (Authentik) wird nur
            deaktiviert – dort gespeicherte Daten bitte in Authentik löschen.
          </p>
        </CardHeader>
        <CardContent>
          {candidates.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Konten.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {candidates.accounts.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    <Link
                      href={`/mitglieder/mitgliederverwaltung/${entry.id}`}
                      className="font-medium hover:underline"
                    >
                      {entry.name}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      · zuletzt dabei bis {formatDate(entry.lastEnd)}
                    </span>
                  </span>
                  <AnonymizeButton userId={entry.id} name={entry.name} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
