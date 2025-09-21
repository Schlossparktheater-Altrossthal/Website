import { ReactNode } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clapperboard } from "lucide-react";

import { ProductionWorkspaceNav } from "./workspace-nav";

type WorkspaceKey = "overview" | "departments" | "casting" | "scenes";

type ProductionSummary = {
  id: string;
  title: string | null;
  year: number;
  synopsis: string | null;
};

type ProductionStat = {
  label: string;
  value: number | string;
  hint?: string;
};

type ProductionWorkspaceHeaderProps = {
  title: string;
  description: string;
  activeWorkspace: WorkspaceKey;
  production?: ProductionSummary | null;
  stats?: ProductionStat[];
  actions?: ReactNode;
  summaryActions?: ReactNode;
};

function formatProductionTitle(production?: ProductionSummary | null) {
  if (!production) return "Noch keine Produktion ausgewählt";
  if (production.title && production.title.trim()) {
    return production.title;
  }
  return `Produktion ${production.year}`;
}

export function ProductionWorkspaceHeader({
  title,
  description,
  activeWorkspace,
  production,
  stats,
  actions,
  summaryActions,
}: ProductionWorkspaceHeaderProps) {
  const hasStats = Boolean(stats && stats.length > 0);
  const formattedTitle = formatProductionTitle(production);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Produktionsbereich</p>
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">{title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground md:text-base">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <ProductionWorkspaceNav active={activeWorkspace} />

      <Card className="border-border/70 bg-background/70">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">{formattedTitle}</CardTitle>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {production ? `Jahrgang ${production.year}` : "Wähle in der Übersicht eine aktive Produktion aus."}
              </p>
            </div>
            <Badge variant={production ? "default" : "outline"}>
              {production ? "Aktiv" : "Auswahl erforderlich"}
            </Badge>
          </div>
          {production?.synopsis ? (
            <p className="text-sm text-muted-foreground">{production.synopsis}</p>
          ) : null}
        </CardHeader>
        {production ? (
          summaryActions ? (
            <CardContent className="flex flex-wrap gap-2">{summaryActions}</CardContent>
          ) : null
        ) : (
          <CardContent className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Ohne aktive Produktion fehlen Rollen, Szenen und Aufgaben. Wähle eine Produktion aus oder lege eine neue an, um loszulegen.
            </p>
            <Button asChild size="sm" variant="outline" className="ml-auto">
              <Link href="/mitglieder/produktionen" title="Produktion auswählen">
                <Clapperboard aria-hidden className="h-4 w-4" />
                <span>Produktion auswählen</span>
              </Link>
            </Button>
          </CardContent>
        )}
      </Card>

      {hasStats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats!.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-border/60 bg-background/60 p-4 shadow-sm"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</div>
              {stat.hint ? (
                <p className="text-xs text-muted-foreground">{stat.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
