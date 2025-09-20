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
    getActiveProduction(),
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

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-background p-8 shadow-lg">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Produktionsplanung
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
                Moderne Oberfläche für deine Produktionen
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Koordiniere Teams, Besetzungen und Szenen mit einer klaren Navigation. Wähle eine aktive Produktion, um fokussiert
                zu arbeiten und behalte gleichzeitig alle Gewerke im Blick.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground md:max-w-xs md:text-right">
            <span>Nutze die neuen Menüpunkte für Gewerke, Besetzungen und Szenen für eine klare Arbeitsaufteilung.</span>
            <span className="font-medium text-foreground">Starte mit der Auswahl deiner Produktion.</span>
          </div>
        </div>
      </section>

      {activeProduction ? (
        <section>
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">
                    Aktive Produktion
                  </CardTitle>
                  <h2 className="mt-1 text-2xl font-semibold text-foreground md:text-3xl">
                    {formatShowTitle(activeProduction)}
                  </h2>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Jahrgang {activeProduction.year}</p>
                </div>
                <Badge>Aktiv</Badge>
              </div>
              {activeProduction.synopsis ? (
                <p className="max-w-3xl text-sm text-muted-foreground">{activeProduction.synopsis}</p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-6">
              {activeStats ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Rollen</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{activeStats.characters}</div>
                    <p className="text-xs text-muted-foreground">Angelegte Figuren in dieser Produktion</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Szenen</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{activeStats.scenes}</div>
                    <p className="text-xs text-muted-foreground">Erfasste Szenen inklusive Reihenfolge</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Breakdowns</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{activeStats.breakdownItems}</div>
                    <p className="text-xs text-muted-foreground">Offene Aufgaben über alle Gewerke</p>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
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
              </div>
            </CardContent>
          </Card>
        </section>
      ) : (
        <section>
          <Card className="border-dashed border-border/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg font-semibold">Noch keine aktive Produktion ausgewählt</CardTitle>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Wähle unten eine Produktion aus, um Rollen, Szenen und Breakdowns mit der neuen Oberfläche zu bearbeiten. Du kannst
                die Auswahl jederzeit wieder ändern.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="#produktionen">Produktion auswählen</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/mitglieder/produktionen/gewerke">Gewerke &amp; Teams aufrufen</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

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
              Nutze die neuen Navigationspunkte für Rollen sowie Szenen &amp; Breakdowns, um fokussiert an deiner Produktion zu
              arbeiten.
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

      <section id="produktionen" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Produktionen auswählen</h2>
            <p className="text-sm text-muted-foreground">
              Setze eine Produktion als aktiv, um Rollen, Szenen und Breakdown-Aufgaben gezielt zu bearbeiten.
            </p>
          </div>
          {shows.length > 0 ? (
            <Badge variant="outline">{shows.length} Eintr{shows.length === 1 ? "ag" : "äge"}</Badge>
          ) : null}
        </div>
        {shows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Produktionen angelegt. Nutze das Formular, um deine erste Produktion anzulegen.
          </p>
        ) : null}
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <li>
            <Card className="flex h-full flex-col border-dashed border-primary/50 bg-primary/5">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base font-semibold text-primary">Neue Produktion anlegen</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Erfasse Jahrgang, optionale Beschreibung und starte direkt in den modernen Gewerke-, Rollen- und Szenen-Workflows.
                </p>
              </CardHeader>
              <CardContent>
                <form action={createProductionAction} className="grid gap-4">
                  <input type="hidden" name="redirectPath" value="/mitglieder/produktionen" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Jahr</label>
                      <Input type="number" name="year" min={1900} max={2200} defaultValue={suggestedYear} required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Titel</label>
                      <Input name="title" placeholder="Titel der Produktion" maxLength={160} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Kurzbeschreibung</label>
                    <Textarea
                      name="synopsis"
                      rows={3}
                      maxLength={600}
                      placeholder="Optionaler Teaser, Autor*in oder kurzes Motto."
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Startdatum</label>
                      <Input type="date" name="startDate" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Enddatum</label>
                      <Input type="date" name="endDate" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Premierenankündigung</label>
                    <Input type="date" name="revealDate" />
                  </div>
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
          </li>
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
      </section>
    </div>
  );
}
