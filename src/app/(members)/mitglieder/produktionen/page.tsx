import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProductionWorkspaceHeader } from "@/components/production/workspace-header";

import {
  clearActiveProductionAction,
  createProductionAction,
  setActiveProductionAction,
} from "./actions";

function formatShowTitle(show: { title: string | null; year: number }) {
  if (show.title && show.title.trim()) {
    return show.title;
  }
  return `Produktion ${show.year}`;
}

export default async function ProduktionenPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.produktionen");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
        Du hast keinen Zugriff auf die Produktionsplanung.
      </div>
    );
  }

  const [shows, activeProduction] = await Promise.all([
    prisma.show.findMany({
      orderBy: { year: "desc" },
      select: { id: true, year: true, title: true, synopsis: true },
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
        <Link href="/mitglieder/produktionen/besetzung">Rollen &amp; Besetzung öffnen</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/mitglieder/produktionen/szenen">Szenen &amp; Breakdowns öffnen</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/mitglieder/produktionen/gewerke">Gewerke &amp; Teams verwalten</Link>
      </Button>
      <form action={clearActiveProductionAction} className="ml-auto flex-shrink-0">
        <input type="hidden" name="redirectPath" value="/mitglieder/produktionen" />
        <Button type="submit" variant="ghost" size="sm">
          Aktive Auswahl zurücksetzen
        </Button>
      </form>
    </>
  ) : null;

  const headerActions = (
    <>
      <Button asChild variant="outline" size="sm">
        <Link href="#produktionen">Produktion auswählen</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="#produktion-anlegen">Neue Produktion anlegen</Link>
      </Button>
    </>
  );

  return (
    <div className="space-y-12">
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
              Nutze die Navigation für Rollen sowie Szenen &amp; Breakdowns, um fokussiert an deiner Produktion zu arbeiten.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/mitglieder/produktionen/besetzung">Rollenbereich öffnen</Link>
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
          {shows.length > 0 ? (
            <Badge variant="outline">{shows.length} Eintr{shows.length === 1 ? "ag" : "äge"}</Badge>
          ) : null}
        </div>

        <Card id="produktion-anlegen" className="border-dashed border-primary/50 bg-primary/5">
          <CardHeader className="space-y-2">
            <CardTitle className="text-base font-semibold text-primary">Neue Produktion anlegen</CardTitle>
            <p className="text-sm text-muted-foreground">
              Erfasse Jahrgang, optionale Beschreibung und starte direkt in den modernen Gewerke-, Rollen- und Szenen-Workflows.
            </p>
          </CardHeader>
          <CardContent>
            <form action={createProductionAction} className="grid gap-6">
              <input type="hidden" name="redirectPath" value="/mitglieder/produktionen" />
              <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4 sm:grid-cols-2">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Basisdaten
                </legend>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Jahr</label>
                  <Input type="number" name="year" min={1900} max={2200} defaultValue={suggestedYear} required />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Titel</label>
                  <Input name="title" placeholder="Titel der Produktion" maxLength={160} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium">Kurzbeschreibung</label>
                  <Textarea
                    name="synopsis"
                    rows={3}
                    maxLength={600}
                    placeholder="Optionaler Teaser, Autor oder kurzes Motto."
                  />
                </div>
              </fieldset>

              <details className="rounded-lg border border-border/60 bg-background/60 p-4 transition [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                  <span>Timeline &amp; Kommunikation (optional)</span>
                  <span className="text-xs text-muted-foreground">Bereich öffnen</span>
                </summary>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Startdatum</label>
                    <Input type="date" name="startDate" />
                  </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Enddatum</label>
                  <Input type="date" name="endDate" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium">Beginn der Endprobenwoche</label>
                  <Input type="date" name="finalRehearsalWeekStart" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium">Premierenankündigung</label>
                  <Input type="date" name="revealDate" />
                </div>
              </div>
              </details>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    name="setActive"
                    defaultChecked={shouldSetActiveByDefault}
                    className="mt-1 h-4 w-4 rounded border border-border bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  <span className="leading-snug">Nach dem Anlegen als aktive Produktion setzen</span>
                </label>
                <Button type="submit" className="sm:w-auto">
                  Produktion erstellen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {shows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Produktionen angelegt. Nutze das Formular, um deine erste Produktion anzulegen.
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
                      <form action={setActiveProductionAction} className="flex-shrink-0">
                        <input type="hidden" name="showId" value={show.id} />
                        <input type="hidden" name="redirectPath" value="/mitglieder/produktionen" />
                        <Button type="submit" size="sm" disabled={isActive}>
                          {isActive ? "Aktiv ausgewählt" : "Als aktiv setzen"}
                        </Button>
                      </form>
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
