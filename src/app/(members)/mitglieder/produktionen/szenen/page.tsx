import { BreakdownStatus } from "@prisma/client";
import { Clapperboard, FileStack, Theater } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { ProductionWorkspaceHeader } from "@/components/production/workspace-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";

import { SceneListClient } from "./scene-list-client";
import { SceneCreateDialog } from "./scene-create-dialog";

type SceneIdentifier = string | null;

function parseSceneIdentifier(value: SceneIdentifier): number[] {
  if (!value) return [Number.POSITIVE_INFINITY];
  return value
    .split(".")
    .map((segment) => Number.parseInt(segment, 10))
    .filter((segment) => !Number.isNaN(segment));
}

function compareSceneIdentifiers(
  a: SceneIdentifier,
  b: SceneIdentifier,
): number {
  const aParts = parseSceneIdentifier(a);
  const bParts = parseSceneIdentifier(b);
  const maxLength = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const aPart = aParts[index] ?? 0;
    const bPart = bParts[index] ?? 0;
    if (aPart !== bPart) {
      return aPart - bPart;
    }
  }
  return 0;
}

export default async function ProduktionsSzenenPage() {
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

  const activeProduction = await getActiveProduction(session.user?.id);

  if (!activeProduction) {
    return (
      <div className="space-y-6">
        <ProductionWorkspaceHeader
          title="Szenen"
          description="Plane Szenenabläufe, pflege Orte und Zeiten und verknüpfe Aufgaben für alle Gewerke übersichtlich."
          activeWorkspace="scenes"
          production={null}
          hideTitle
          showDivider
          showNavigation={false}
        />
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle im Produktionsüberblick eine aktive Produktion aus, um Szenen und Aufgaben zu verwalten."
        />
      </div>
    );
  }

  const [users, departments, show] = await Promise.all([
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
        { lastName: "asc" },
        { firstName: "asc" },
        { name: "asc" },
        { email: "asc" },
      ],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
      },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, color: true },
    }),
    prisma.show.findUnique({
      where: { id: activeProduction.id },
      select: {
        id: true,
        title: true,
        year: true,
        synopsis: true,
        characters: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, shortName: true, color: true },
        },
        scenes: {
          orderBy: { identifier: "asc" },
          select: {
            id: true,
            identifier: true,
            title: true,
            summary: true,
            location: true,
            notes: true,
            characters: {
              orderBy: { character: { name: "asc" } },
              select: {
                id: true,
                isFeatured: true,
                character: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                    color: true,
                  },
                },
              },
            },
            breakdownItems: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                title: true,
                description: true,
                note: true,
                status: true,
                neededBy: true,
                department: {
                  select: { id: true, name: true, slug: true, color: true },
                },
                assignedToId: true,
                assignedTo: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    name: true,
                    email: true,
                  },
                },
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
        Die aktuell ausgewählte Produktion konnte nicht gefunden werden. Bitte
        wähle sie erneut im Überblick aus.
      </div>
    );
  }

  const currentPath = "/mitglieder/produktionen/szenen";
  const statusOptions = Object.values(BreakdownStatus);
  const scenes = show.scenes
    .map((scene) => ({
      ...scene,
      breakdownItems: scene.breakdownItems.map((item) => ({
        ...item,
        neededBy: item.neededBy ? item.neededBy.toISOString() : null,
      })),
    }))
    .sort((a, b) => compareSceneIdentifiers(a.identifier, b.identifier));
  const sceneCount = scenes.length;
  const breakdownCount = scenes.reduce(
    (acc, scene) => acc + scene.breakdownItems.length,
    0,
  );
  const characterCount = show.characters.length;
  const summaryStats = [
    {
      label: "Szenen",
      value: sceneCount,
      icon: <Clapperboard className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Breakdowns",
      value: breakdownCount,
      icon: <FileStack className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Rollen",
      value: characterCount,
      icon: <Theater className="h-4 w-4" aria-hidden />,
    },
  ];

  return (
    <div className="space-y-6">
      <ProductionWorkspaceHeader
        title="Szenen"
        description="Plane Szenenabläufe, pflege Orte und Zeiten und verknüpfe Aufgaben für alle Gewerke übersichtlich."
        activeWorkspace="scenes"
        production={activeProduction}
        hideTitle
        hideProductionCard
        showDivider
        showNavigation={false}
      />

      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summaryStats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-br from-card/90 to-muted/50 px-4 py-3 shadow-sm"
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="text-xl font-bold leading-tight text-foreground">
                    {stat.value}
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-card/80 text-muted-foreground">
                  {stat.icon}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end">
            <SceneCreateDialog showId={show.id} currentPath={currentPath} />
          </div>
        </div>
      </div>

      <SceneListClient
        scenes={scenes}
        characters={show.characters}
        departments={departments}
        users={users}
        currentPath={currentPath}
        statusOptions={statusOptions}
      />
    </div>
  );
}
