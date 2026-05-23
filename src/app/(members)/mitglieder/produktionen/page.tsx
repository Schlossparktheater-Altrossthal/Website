import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductionWorkspaceHeader } from "@/components/production/workspace-header";

import {
  ClearActiveProductionForm,
  CreateProductionDialog,
  SetActiveProductionForm,
  UpdateProductionDialog,
} from "./production-forms-client";

function formatShowTitle(show: { title: string | null; year: number }) {
  if (show.title && show.title.trim()) {
    return show.title;
  }
  return `Produktion ${show.year}`;
}

export default async function ProduktionenPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
          Du hast keinen Zugriff auf die Produktionsplanung.
        </div>
      </div>
    );
  }

  const [shows, activeProduction] = await Promise.all([
    prisma.show.findMany({
      orderBy: { year: "desc" },
      select: { id: true, year: true, title: true, synopsis: true, dates: true, revealedAt: true },
    }),
    getActiveProduction(session.user?.id),
  ]);

  const activeShowId = activeProduction?.id ?? null;
  const currentYear = new Date().getFullYear();
  const highestExistingYear = shows.length > 0 ? shows[0].year : currentYear - 1;
  const suggestedYear = highestExistingYear >= currentYear ? highestExistingYear + 1 : currentYear;
  const shouldSetActiveByDefault = !activeProduction;

  let activeStats: { characters: number; scenes: number; breakdownItems: number } | null = null;
  if (activeShowId) {
    const [characters, scenes, breakdownItems] = await Promise.all([
      prisma.character.count({ where: { showId: activeShowId } }),
      prisma.scene.count({ where: { showId: activeShowId } }),
      prisma.sceneBreakdownItem.count({ where: { scene: { showId: activeShowId } } }),
    ]);
    activeStats = { characters, scenes, breakdownItems };
  }

  const workspaceStats: { label: string; value: number; hint?: string }[] = [
    {
      label: "Produktionen",
      value: shows.length,
      hint: shows.length === 1 ? "im Archiv verfügbar" : "im Archiv verfügbar",
    },
  ];
  if (activeStats) {
    workspaceStats.unshift(
      {
        label: "Rollen",
        value: activeStats.characters,
        hint: "Angelegte Figuren in dieser Produktion",
      },
      {
        label: "Szenen",
        value: activeStats.scenes,
        hint: "Erfasste Szenen inklusive Reihenfolge",
      },
      {
        label: "Breakdowns",
        value: activeStats.breakdownItems,
        hint: "Offene Aufgaben über alle Gewerke",
      }
    );
  }

  const summaryActions = activeProduction ? (
    <>
      <Button asChild>
        <Link href="/mitglieder/produktionen/besetzung">Besetzung öffnen</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/mitglieder/produktionen/szenen">Szenen öffnen</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/mitglieder/produktionen/gewerke">Gewerke &amp; Teams verwalten</Link>
      </Button>
      <ClearActiveProductionForm
        redirectPath="/mitglieder/produktionen"
        className="ml-auto flex-shrink-0"
      />
    </>
  ) : null;

  const headerActions = (
    <Button asChild variant="outline" size="sm">
      <Link href="#produktionen">Produktion auswählen</Link>
    </Button>
  );

  return (
    <div className="space-y-6">
      <ProductionWorkspaceHeader
        title="Moderne Produktionsplanung"
        description="Koordiniere Teams, Besetzungen und Szenen mit einer klaren Navigation. Wähle eine aktive Produktion, um fokussiert zu arbeiten und behalte gleichzeitig alle Gewerke im Blick."
        activeWorkspace="overview"
        production={activeProduction}
        stats={workspaceStats}
        actions={headerActions}
        summaryActions={summaryActions}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold">Gewerke &amp; Teams</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pflege Farben, Beschreibungen und Zuständigkeiten deiner Produktionsgewerke in einem dedizierten Arbeitsbereich.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link href="/mitglieder/produktionen/gewerke">Zum Team-Workspace</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold">Strukturierte Arbeitsabläufe</CardTitle>
            <p className="text-sm text-muted-foreground">
              Nutze die Navigation für Rollen sowie Szenen, um fokussiert an deiner Produktion zu arbeiten.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/mitglieder/produktionen/besetzung">Besetzung öffnen</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/mitglieder/produktionen/szenen">Szenenbereich öffnen</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section id="produktionen" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Produktionen verwalten</h2>
            <p className="text-sm text-muted-foreground">
              Setze eine Produktion als aktiv, um Rollen, Szenen und Breakdown-Aufgaben gezielt zu bearbeiten.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {shows.length > 0 ? (
              <Badge variant="outline">
                {shows.length} Eintr
                {shows.length === 1 ? "ag" : "äge"}
              </Badge>
            ) : null}
            <CreateProductionDialog
              redirectPath="/mitglieder/produktionen"
              suggestedYear={suggestedYear}
              shouldSetActiveByDefault={shouldSetActiveByDefault}
              trigger={<Button size="sm">Neue Produktion anlegen</Button>}
            />
          </div>
        </div>

        {shows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Produktionen angelegt. Nutze den Button „Neue Produktion anlegen“, um deine erste Produktion einzurichten.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shows.map((show) => {
              const isActive = show.id === activeShowId;
              const title = formatShowTitle(show);
              return (
                <li key={show.id}>
                  <Card
                    className={cn(
                      "flex h-full flex-col justify-between border-border/60 bg-background/70 transition hover:border-primary/50 hover:shadow-md",
                      isActive && "border-primary/60 bg-primary/5 shadow-md"
                    )}
                  >
                    <CardHeader className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Jahrgang {show.year}</p>
                          <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
                        </div>
                        {isActive ? <Badge>Aktiv</Badge> : null}
                      </div>
                      {show.synopsis ? (
                        <p className="text-sm text-muted-foreground">{show.synopsis}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Keine Kurzbeschreibung hinterlegt.</p>
                      )}
                    </CardHeader>
                    <CardContent className="mt-auto flex flex-wrap items-center gap-2">
                      <SetActiveProductionForm
                        showId={show.id}
                        showTitle={title}
                        redirectPath="/mitglieder/produktionen"
                        isActive={isActive}
                      />
                      <UpdateProductionDialog
                        show={{
                          id: show.id,
                          year: show.year,
                          title: show.title,
                          synopsis: show.synopsis,
                          dates: show.dates,
                          revealedAt: show.revealedAt ? show.revealedAt.toISOString() : null,
                        }}
                        redirectPath="/mitglieder/produktionen"
                        trigger={
                          <Button size="sm" variant="ghost" className="flex-shrink-0">
                            Bearbeiten
                          </Button>
                        }
                      />
                      <Button asChild size="sm" variant="outline" className="flex-shrink-0">
                        <Link href={`/mitglieder/produktionen/${show.id}`}>Details anzeigen</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
