import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductionWorkspaceHeader } from "@/components/production/workspace-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";
import { CastingWorkspace } from "./casting-workspace";

export default async function ProduktionsBesetzungPage() {
  const session = await requireAuth();
  let activeProduction = null;
  const permissionKey = "mitglieder.produktionen" as const;

  try {
    const allowed = await hasPermission(session.user, permissionKey);
    if (!allowed) {
      return (
        <div className="space-y-6">
          <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
            Du hast keinen Zugriff auf die Produktionsplanung. Das Recht „MITGLIEDER.PRODUKTIONEN“ wird benötigt, um die
            Besetzungsseite zu öffnen.
          </div>
        </div>
      );
    }

    activeProduction = await getActiveProduction(session.user?.id);
    const headerActions = (
      <Button asChild variant="outline" size="sm">
        <Link href="/mitglieder/produktionen">Zur Übersicht</Link>
      </Button>
    );

    if (!activeProduction) {
      return (
        <div className="space-y-6">
          <ProductionWorkspaceHeader
            title="Rollen &amp; Besetzungen"
            description="Erstelle neue Figuren, pflege Beschreibungen und ordne Ensemble-Mitglieder als Primär-, Alternate- oder Cover-Besetzung zu."
            activeWorkspace="casting"
            production={null}
            actions={headerActions}
          />
          <ProductionWorkspaceEmptyState
            title="Keine aktive Produktion ausgewählt"
            description="Wähle in der Produktionsübersicht eine aktive Produktion aus, um Rollen und Besetzungen zu bearbeiten."
          />
        </div>
      );
    }

    const [users, show] = await Promise.all([
      prisma.user.findMany({
        where: {
          deactivatedAt: null,
          productionMemberships: {
            some: {
              showId: activeProduction.id,
              OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
            },
          },
        },
        orderBy: [
          { name: "asc" },
          { email: "asc" },
        ],
        select: { id: true, firstName: true, lastName: true, name: true, email: true },
      }),
      prisma.show.findUnique({
        where: { id: activeProduction.id },
        select: {
          id: true,
          title: true,
          year: true,
          synopsis: true,
          characters: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              name: true,
              shortName: true,
              description: true,
              notes: true,
              color: true,
              order: true,
              castings: {
                select: {
                  id: true,
                  type: true,
                  notes: true,
                  user: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!show) {
      return (
        <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
          Die aktuell ausgewählte Produktion konnte nicht gefunden werden. Bitte wähle sie erneut in der Übersicht aus.
        </div>
      );
    }

    const characters = (show.characters ?? []).map((character) => ({
      ...character,
      castings: character.castings ?? [],
    }));
    const currentPath = "/mitglieder/produktionen/besetzung";
    const characterCount = characters.length;
    const castingCount = characters.reduce((acc, character) => acc + character.castings.length, 0);
    const headerStats = [
      { label: "Rollen", value: characterCount, hint: "Angelegte Figuren" },
      { label: "Besetzungen", value: castingCount, hint: "Zuordnungen im Ensemble" },
      { label: "Mitglieder", value: users.length, hint: "Verfügbare Personen" },
    ];

    const summaryActions = (
      <Button asChild size="sm" variant="outline">
        <Link href="/mitglieder/produktionen/szenen">Szenen &amp; Breakdowns</Link>
      </Button>
    );

    return (
      <div className="space-y-6">
        <ProductionWorkspaceHeader
          title="Rollen &amp; Besetzungen"
          description="Erstelle neue Figuren, pflege Beschreibungen und ordne Ensemble-Mitglieder als Primär-, Alternate- oder Cover-Besetzung zu."
          activeWorkspace="casting"
          production={activeProduction}
          stats={headerStats}
          actions={headerActions}
          summaryActions={summaryActions}
        />

        <CastingWorkspace
          showId={show.id}
          characters={characters}
          users={users}
          currentPath={currentPath}
        />
      </div>
    );
  } catch (error) {
    console.error("Failed to render casting workspace", error);
    const headerActions = (
      <Button asChild variant="outline" size="sm">
        <Link href="/mitglieder/produktionen">Zur Übersicht</Link>
      </Button>
    );

    return (
      <div className="space-y-6">
        <ProductionWorkspaceHeader
          title="Rollen &amp; Besetzungen"
          description="Erstelle neue Figuren, pflege Beschreibungen und ordne Ensemble-Mitglieder als Primär-, Alternate- oder Cover-Besetzung zu."
          activeWorkspace="casting"
          production={activeProduction}
          actions={headerActions}
        />
        <Card className="border-destructive/60 bg-destructive/5">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-medium text-destructive">Die Besetzungen konnten nicht geladen werden.</p>
            <p className="text-muted-foreground">
              Bitte aktualisiere die Seite oder wähle die aktive Produktion in der Übersicht neu aus.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
