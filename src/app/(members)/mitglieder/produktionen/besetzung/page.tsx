import type { ReactNode } from "react";
import Link from "next/link";
import { CharacterCastingType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/members/page-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";
import { CastingExportDialog } from "@/components/production/casting-export-dialog";

import { CastingListClient } from "./casting-list-client";
import {
  CASTING_ORDER,
  ROLE_PREFERENCE_OPTIONS,
  type DisplayUser,
  type ExportCharacter,
  formatUserName,
  getCastingLabel,
  selectSmallClassName,
} from "./casting-utils";
import { createCharacterAction } from "../actions/casting";
import { BadgeCheckIcon, UserRoundCheckIcon, UsersIcon } from "@/components/ui/action-icons";

type HeaderStat = {
  label: string;
  value: number;
  icon: ReactNode;
  hint?: string;
};

const currentPath = "/mitglieder/produktionen/besetzung";

function CastingTypeSelect({
  defaultValue,
  name = "type",
  className = selectSmallClassName,
}: {
  defaultValue?: CharacterCastingType;
  name?: string;
  className?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue} className={className}>
      {CASTING_ORDER.map((type) => (
        <option key={type} value={type}>
          {getCastingLabel(type)}
        </option>
      ))}
    </select>
  );
}

function HeaderStats({
  stats,
  showId,
  users,
  characters,
  showTitle,
}: {
  stats: HeaderStat[];
  showId: string;
  users: DisplayUser[];
  characters: ExportCharacter[];
  showTitle: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-br from-card/90 to-muted/50 px-4 py-3 shadow-sm"
            >
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-xl font-bold leading-tight text-foreground">{stat.value}</p>
                {stat.hint ? <p className="text-xs text-muted-foreground">{stat.hint}</p> : null}
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-card/80 text-muted-foreground">
                {stat.icon}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/mitglieder/produktionen/szenen">Zu den Szenen</Link>
          </Button>
          <div className="flex flex-col items-end gap-2">
            <CreateCharacterDialog showId={showId} users={users} />
            <CastingExportDialog characters={characters} showTitle={showTitle} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateCharacterDialog({ showId, users }: { showId: string; users: DisplayUser[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">Rolle anlegen</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neue Rolle anlegen</DialogTitle>
          <DialogDescription>
            Füge Figuren hinzu und definiere Farbe sowie optionale Notizen.
          </DialogDescription>
        </DialogHeader>
        <form action={createCharacterAction} method="post" className="grid gap-6">
          <input type="hidden" name="showId" value={showId} />
          <input type="hidden" name="redirectPath" value={currentPath} />
          <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4 md:grid-cols-2">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Basisdaten
            </legend>
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input
                name="name"
                placeholder="z.B. Protagonist"
                minLength={2}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Rollengröße</label>
              <select name="rolePreferenceCode" className={selectSmallClassName} defaultValue="">
                <option value="">Keine Rollengröße</option>
                {ROLE_PREFERENCE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Beschreibung</label>
              <Textarea
                name="description"
                rows={2}
                maxLength={500}
                placeholder="Charakterbeschreibung"
              />
            </div>
          </fieldset>
          <div className="space-y-1">
            <label className="text-sm font-medium">Farbe</label>
            <input
              type="color"
              name="color"
              defaultValue="#7c3aed"
              className="h-10 w-full cursor-pointer rounded-md border border-input bg-background"
            />
          </div>
          <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4 md:grid-cols-2">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Besetzung
            </legend>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Schauspieler</label>
              <select name="castingUserId" className={selectSmallClassName}>
                <option value="">Optional auswählen</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {formatUserName(user)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Besetzungsart</label>
              <CastingTypeSelect name="castingType" defaultValue={CharacterCastingType.primary} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notiz</label>
              <Input name="castingNotes" maxLength={200} placeholder="optional" />
            </div>
          </fieldset>
          <div className="space-y-1">
            <label className="text-sm font-medium">Notiz</label>
            <Textarea name="notes" rows={2} maxLength={500} placeholder="Interne Notiz" />
          </div>
          <DialogFooter className="pt-2 sm:justify-end">
            <DialogClose asChild>
              <Button type="submit">Rolle speichern</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default async function ProduktionsBesetzungPage() {
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
  const breadcrumbs = [membersNavigationBreadcrumb(currentPath)];

  if (!activeProduction) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Besetzung"
          description="Erstelle neue Figuren, pflege Beschreibungen und organisiere die vollständige Besetzung deines Ensembles."
          breadcrumbs={breadcrumbs}
        />
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle im Produktionsüberblick eine aktive Produktion aus, um die Besetzung zu bearbeiten."
        />
      </div>
    );
  }

  const [users, show] = await Promise.all([
    prisma.user.findMany({
      where: {
        deactivatedAt: null,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { name: "asc" }, { email: "asc" }],
      select: { id: true, firstName: true, lastName: true, name: true, email: true },
    }),
    prisma.show.findUnique({
      where: { id: activeProduction.id },
      select: {
        id: true,
        title: true,
        year: true,
        characters: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            shortName: true,
            rolePreferenceCode: true,
            description: true,
            notes: true,
            color: true,
            order: true,
            castings: {
              select: {
                id: true,
                type: true,
                notes: true,
                user: {
                  select: { id: true, firstName: true, lastName: true, name: true, email: true },
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
        Die aktuell ausgewählte Produktion konnte nicht gefunden werden. Bitte wähle sie erneut im
        Überblick aus.
      </div>
    );
  }

  const characterCount = show.characters.length;
  const castingCount = show.characters.reduce(
    (acc, character) => acc + character.castings.length,
    0,
  );
  const assignedActorCount = new Set(
    show.characters.flatMap((character) =>
      character.castings
        .map((casting) => casting.user?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ).size;

  const showTitle = show.title ?? `Produktion ${show.year}`;
  const exportCharacters: ExportCharacter[] = show.characters.map((character) => ({
    id: character.id,
    name: character.name,
    shortName: character.shortName,
    rolePreferenceCode: character.rolePreferenceCode,
    description: character.description,
    notes: character.notes,
    color: character.color,
    castings: character.castings.map((casting) => ({
      id: casting.id,
      type: casting.type,
      notes: casting.notes,
      userName: formatUserName(casting.user),
    })),
  }));
  const headerStats: HeaderStat[] = [
    {
      label: "Rollen",
      value: characterCount,
      icon: <BadgeCheckIcon className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Besetzungen",
      value: castingCount,
      icon: <UsersIcon className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Schauspieler",
      value: assignedActorCount,
      icon: <UserRoundCheckIcon className="h-4 w-4" aria-hidden />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Besetzung"
        description="Erstelle neue Figuren, pflege Beschreibungen und organisiere die vollständige Besetzung deines Ensembles."
        breadcrumbs={breadcrumbs}
      />

      <HeaderStats
        stats={headerStats}
        showId={show.id}
        users={users}
        characters={exportCharacters}
        showTitle={showTitle}
      />

      <CastingListClient characters={show.characters} users={users} currentPath={currentPath} />
    </div>
  );
}
