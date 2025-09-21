import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { setActiveProductionAction, updateProductionTimelineAction } from "../actions";

function formatShowTitle(show: { title: string | null; year: number }) {
  if (show.title && show.title.trim()) return show.title;
  return `Produktion ${show.year}`;
}

export default async function ProduktionDetailPage({ params }: { params: { showId: string } }) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.produktionen");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
        Du hast keinen Zugriff auf diese Produktion.
      </div>
    );
  }

  const [show, breakdownCount] = await Promise.all([
    prisma.show.findUnique({
      where: { id: params.showId },
      select: {
        id: true,
        title: true,
        year: true,
        synopsis: true,
        finalRehearsalWeekStart: true,
        _count: { select: { characters: true, scenes: true } },
      },
    }),
    prisma.sceneBreakdownItem.count({ where: { scene: { showId: params.showId } } }),
  ]);

  if (!show) {
    notFound();
  }

  const activeProductionId = await getActiveProductionId();
  const isActive = activeProductionId === show.id;
  const title = formatShowTitle(show);
  const finalRehearsalWeekStartValue = show.finalRehearsalWeekStart
    ? show.finalRehearsalWeekStart.toISOString().slice(0, 10)
    : "";
  const finalRehearsalWeekStartLabel = show.finalRehearsalWeekStart
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(show.finalRehearsalWeekStart)
    : null;

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Produktion {show.year}</p>
            <h1 className="text-3xl font-semibold">{title}</h1>
            {show.synopsis ? (
              <p className="max-w-2xl text-sm text-muted-foreground">{show.synopsis}</p>
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/mitglieder/produktionen">Zur Produktionsübersicht</Link>
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg font-semibold">Status &amp; Kennzahlen</CardTitle>
            <Badge variant={isActive ? "default" : "outline"}>{isActive ? "Aktiv" : "Inaktiv"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Überblick über Rollen, Szenen und Breakdown-Aufgaben dieser Produktion sowie schnelle Aktionen für die neuen Arbeitsbereiche.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Rollen</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{show._count.characters}</div>
              <p className="text-xs text-muted-foreground">Angelegte Figuren in dieser Produktion</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Szenen</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{show._count.scenes}</div>
              <p className="text-xs text-muted-foreground">Erfasste Szenen inklusive Reihenfolge</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Breakdowns</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{breakdownCount}</div>
              <p className="text-xs text-muted-foreground">Aufgaben über alle Gewerke hinweg</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/mitglieder/produktionen/besetzung">Rollen &amp; Besetzung</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/mitglieder/produktionen/szenen">Szenen &amp; Breakdowns</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/mitglieder/produktionen/gewerke">Gewerke &amp; Teams</Link>
            </Button>
            {!isActive ? (
              <form action={setActiveProductionAction} className="ml-auto flex-shrink-0">
                <input type="hidden" name="showId" value={show.id} />
                <input type="hidden" name="redirectPath" value={`/mitglieder/produktionen/${show.id}`} />
                <Button type="submit" size="sm">
                  Produktion aktiv setzen
                </Button>
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">Endprobenwoche</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hinterlege den Start der großen Endprobenwoche. Mitglieder sehen darauf basierend einen Countdown
            im Dashboard.
          </p>
        </CardHeader>
        <CardContent>
          <form action={updateProductionTimelineAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <input type="hidden" name="showId" value={show.id} />
            <input type="hidden" name="redirectPath" value={`/mitglieder/produktionen/${show.id}`} />
            <div className="space-y-2 sm:max-w-xs">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="finalRehearsalWeekStart">
                  Beginn der Endprobenwoche
                </label>
                <Input
                  id="finalRehearsalWeekStart"
                  type="date"
                  name="finalRehearsalWeekStart"
                  defaultValue={finalRehearsalWeekStartValue}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {finalRehearsalWeekStartLabel
                  ? `Aktueller Start: ${finalRehearsalWeekStartLabel}`
                  : "Kein Datum hinterlegt."}
              </p>
            </div>
            <Button type="submit" className="sm:w-auto">
              Zeitplan aktualisieren
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">Nächste Schritte</CardTitle>
          <p className="text-sm text-muted-foreground">
            Nutze die neuen Navigationspunkte, um die Produktion in klar getrennten Arbeitsbereichen zu pflegen. Alle Änderungen aktualisieren die Statistik oben automatisch, sobald du zur Übersicht zurückkehrst.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/mitglieder/produktionen">Zur Übersicht zurückkehren</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/mitglieder/produktionen/besetzung">Zum Rollenbereich</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/mitglieder/produktionen/szenen">Zum Szenenbereich</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
