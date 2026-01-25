import type { ReactNode } from "react";
import Link from "next/link";
import { CharacterCastingType } from "@prisma/client";
import { BadgeCheck, ChevronDown, Filter, FilterX, Pencil, Plus, Search, Trash2, UserRoundCheck, Users } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { getUserDisplayName } from "@/lib/names";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { getRolePreferenceTitle, listRolePreferenceDefinitions } from "@/lib/onboarding/role-preferences";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import {
  assignCharacterCastingAction,
  createCharacterAction,
  deleteCharacterAction,
  removeCharacterCastingAction,
  updateCharacterAction,
} from "../actions";

type DisplayUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name: string | null;
  email: string | null;
};

type CharacterCasting = {
  id: string;
  type: CharacterCastingType;
  notes: string | null;
  user: DisplayUser | null;
};

type Character = {
  id: string;
  name: string;
  shortName: string | null;
  rolePreferenceCode: string | null;
  description: string | null;
  notes: string | null;
  color: string | null;
  order: number | null;
  castings: CharacterCasting[];
};

type ExportCharacter = {
  id: string;
  name: string;
  shortName: string | null;
  rolePreferenceCode: string | null;
  description: string | null;
  notes: string | null;
  color: string | null;
  castings: Array<{
    id: string;
    type: CharacterCastingType;
    notes: string | null;
    userName: string;
  }>;
};

type PageProps = {
  searchParams?: Promise<{
    q?: string | string[] | null;
    castingType?: string | string[] | null;
  }>;
};

type HeaderStat = {
  label: string;
  value: number;
  icon: ReactNode;
  hint?: string;
};

const CASTING_LABELS: Partial<Record<CharacterCastingType, string>> = {
  primary: "Primär",
  alternate: "Sekundär",
};

const CASTING_ORDER: CharacterCastingType[] = [
  CharacterCastingType.primary,
  CharacterCastingType.alternate,
];

const ROLE_PREFERENCE_OPTIONS = listRolePreferenceDefinitions("acting");

const DESCRIPTION_PREVIEW_LENGTH = 100;

const selectSmallClassName =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const currentPath = "/mitglieder/produktionen/besetzung";

function formatUserName(user?: DisplayUser | null) {
  if (!user) return "Unbekannt";
  return getUserDisplayName(user, "Unbekannt");
}

function getCastingLabel(type: CharacterCastingType) {
  return CASTING_LABELS[type] ?? "Weitere";
}

function getCastingOrderIndex(type: CharacterCastingType) {
  const index = CASTING_ORDER.indexOf(type);
  return index === -1 ? CASTING_ORDER.length : index;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength).trimEnd()}…`;
}

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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
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
          <CastingExportDialog characters={characters} showTitle={showTitle} />
          <CreateCharacterDialog showId={showId} users={users} />
        </div>
      </div>
    </div>
  );
}

function CastingFilters({ searchTerm, castingType }: { searchTerm: string; castingType: string }) {
  return (
    <form className="rounded-2xl border border-border/70 bg-card/60 p-3 shadow-sm" method="get" action={currentPath}>
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr_auto] lg:items-center">
        <div className="space-y-1">
          <label className="sr-only" htmlFor="casting-search">
            Suche
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="casting-search"
              name="q"
              placeholder="Nach Rollen oder Personen suchen"
              defaultValue={searchTerm}
              className="h-9 pl-9 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="sr-only" htmlFor="casting-type">
            Besetzungsart
          </label>
          <select
            id="casting-type"
            name="castingType"
            className={selectSmallClassName}
            defaultValue={castingType}
          >
            <option value="all">Alle Besetzungen</option>
            {CASTING_ORDER.map((type) => (
              <option key={type} value={type}>
                {getCastingLabel(type)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="submit" size="icon" aria-label="Suche anwenden">
            <Search className="h-4 w-4" aria-hidden />
          </Button>
          <Button type="submit" variant="outline" size="icon" aria-label="Filter anwenden">
            <Filter className="h-4 w-4" aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" asChild aria-label="Filter und Suche entfernen">
            <Link href={currentPath}>
              <FilterX className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </form>
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
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basisdaten</legend>
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input name="name" placeholder="z.B. Protagonist" minLength={2} maxLength={120} required />
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
              <Textarea name="description" rows={2} maxLength={500} placeholder="Charakterbeschreibung" />
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

function CastingAssignments({
  castings,
}: {
  castings: CharacterCasting[];
}) {
  const sortedCastings = [...castings].sort((a, b) => getCastingOrderIndex(a.type) - getCastingOrderIndex(b.type));

  if (sortedCastings.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Besetzung zugeordnet.</p>;
  }

  return (
    <div className="space-y-2">
      {sortedCastings.map((casting) => (
        <div key={casting.id} className="rounded-lg border border-border/70 bg-background/80 p-2 text-sm shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{formatUserName(casting.user)}</p>
              <p className="text-xs text-muted-foreground">{getCastingLabel(casting.type)}</p>
              {casting.notes ? <p className="text-xs text-muted-foreground">Notiz: {casting.notes}</p> : null}
            </div>
            <form action={removeCharacterCastingAction} method="post">
              <input type="hidden" name="castingId" value={casting.id} />
              <input type="hidden" name="redirectPath" value={currentPath} />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Besetzung entfernen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}

function CharacterCard({ character, users }: { character: Character; users: DisplayUser[] }) {
  const hasCastings = character.castings.length > 0;
  const sortedCastings = [...character.castings].sort(
    (a, b) => getCastingOrderIndex(a.type) - getCastingOrderIndex(b.type),
  );

  return (
    <Card
      id={`role-${character.id}`}
      key={character.id}
      className={cn(
        "min-w-0 w-full overflow-hidden border border-border/70 bg-transparent p-2 shadow-sm",
        !hasCastings && "border-destructive/60",
      )}
      style={{ backgroundColor: character.color ?? "hsl(var(--card))" }}
    >
      <CardHeader className="space-y-2 rounded-lg border border-border/60 bg-background/80 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 items-start gap-3">
            <span
              className="mt-1 h-10 w-1.5 rounded-full"
              style={{ backgroundColor: character.color ?? "#8b5cf6" }}
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg font-semibold">{character.name}</CardTitle>
                {character.rolePreferenceCode ? (
                  <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {getRolePreferenceTitle(character.rolePreferenceCode)}
                  </span>
                ) : null}
              </div>
              {character.description ? (
                <p className="text-sm text-muted-foreground">
                  {truncateText(character.description, DESCRIPTION_PREVIEW_LENGTH)}
                </p>
              ) : null}
              {character.notes ? <p className="text-xs text-muted-foreground">Notiz: {character.notes}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <AssignCastingDialog characterId={character.id} users={users} />
            <UpdateCharacterDialog character={character} />
            <form action={deleteCharacterAction} method="post">
              <input type="hidden" name="characterId" value={character.id} />
              <input type="hidden" name="redirectPath" value={currentPath} />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Rolle entfernen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {character.rolePreferenceCode ? null : (
            <span className="rounded-full bg-muted/50 px-2 py-1">Keine Rollengröße</span>
          )}
          {character.description ? null : <span className="rounded-full bg-muted/50 px-2 py-1">Ohne Beschreibung</span>}
          {hasCastings ? null : (
            <span className="rounded-full bg-destructive/10 px-2 py-1 text-destructive">Nicht besetzt</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 rounded-lg border border-border/60 bg-card/50 px-3 py-3">
        <details className="group rounded-lg border border-border/60 bg-background/60">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-foreground">
            <span className="flex items-center gap-2">
              <span>Besetzung</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                <UserRoundCheck className="h-3 w-3" aria-hidden />
                {sortedCastings.length}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-2 border-t border-border/60 px-3 py-3">
            <CastingAssignments castings={sortedCastings} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function AssignCastingDialog({ characterId, users }: { characterId: string; users: DisplayUser[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Besetzung hinzufügen">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mitglied zuordnen</DialogTitle>
          <DialogDescription>
            Weise dieser Rolle ein Mitglied zu und lege Besetzungsart sowie optionale Notizen fest.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" action={assignCharacterCastingAction} method="post">
          <input type="hidden" name="characterId" value={characterId} />
          <input type="hidden" name="redirectPath" value={currentPath} />
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mitglied</label>
            <select name="userId" className={selectSmallClassName} required>
              <option value="">Mitglied auswählen</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {formatUserName(user)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Besetzungsart</label>
            <CastingTypeSelect defaultValue={CharacterCastingType.primary} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notiz</label>
            <Input name="notes" maxLength={200} placeholder="optional" />
          </div>
          <DialogFooter className="sm:justify-end">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button type="submit">Mitglied besetzen</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UpdateCharacterDialog({ character }: { character: Character }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Rolle bearbeiten">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Rolle bearbeiten</DialogTitle>
          <DialogDescription>Aktualisiere die Stammdaten der Rolle und speichere deine Änderungen.</DialogDescription>
        </DialogHeader>
        <form action={updateCharacterAction} method="post" className="grid gap-3">
          <input type="hidden" name="characterId" value={character.id} />
          <input type="hidden" name="redirectPath" value={currentPath} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</label>
              <Input name="name" defaultValue={character.name} minLength={2} maxLength={120} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rollengröße</label>
              <select
                name="rolePreferenceCode"
                className={selectSmallClassName}
                defaultValue={character.rolePreferenceCode ?? ""}
              >
                <option value="">Keine Rollengröße</option>
                {ROLE_PREFERENCE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beschreibung</label>
              <Textarea name="description" rows={2} maxLength={500} defaultValue={character.description ?? ""} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Farbe</label>
              <input
                type="color"
                name="color"
                defaultValue={character.color ?? "#7c3aed"}
                className="h-10 w-full cursor-pointer rounded-md border border-input bg-background"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notiz</label>
              <Textarea name="notes" rows={2} maxLength={500} defaultValue={character.notes ?? ""} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="submit" variant="outline">
                Rolle aktualisieren
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default async function ProduktionsBesetzungPage({ searchParams }: PageProps) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.produktionen");

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
        Die aktuell ausgewählte Produktion konnte nicht gefunden werden. Bitte wähle sie erneut im Überblick aus.
      </div>
    );
  }

  const characterCount = show.characters.length;
  const castingCount = show.characters.reduce((acc, character) => acc + character.castings.length, 0);
  const assignedActorCount = new Set(
    show.characters.flatMap((character) =>
      character.castings.map((casting) => casting.user?.id).filter((id): id is string => Boolean(id)),
    ),
  ).size;

  const resolvedSearchParams = (await searchParams) ?? {};

  const searchTermRaw = resolvedSearchParams.q;
  const castingTypeRaw = resolvedSearchParams.castingType;

  const searchTerm = Array.isArray(searchTermRaw) ? searchTermRaw[0] ?? "" : searchTermRaw ?? "";
  const castingType = Array.isArray(castingTypeRaw) ? castingTypeRaw[0] ?? "all" : castingTypeRaw ?? "all";

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const activeCastingType = castingType in CASTING_LABELS ? (castingType as CharacterCastingType) : null;

  const filteredCharacters = show.characters.filter((character) => {
    const matchesSearch = normalizedSearch
      ? [
          character.name,
          character.shortName,
          character.rolePreferenceCode ? getRolePreferenceTitle(character.rolePreferenceCode) : null,
          character.description,
          character.notes,
          ...character.castings.map((casting) => formatUserName(casting.user)),
        ].some((value) => value?.toLowerCase().includes(normalizedSearch))
      : true;

    const matchesType = activeCastingType ? character.castings.some((casting) => casting.type === activeCastingType) : true;

    return matchesSearch && matchesType;
  });

  const unassignedCharacters = filteredCharacters.filter((character) => character.castings.length === 0);
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
    { label: "Rollen", value: characterCount, icon: <BadgeCheck className="h-4 w-4" aria-hidden /> },
    { label: "Besetzungen", value: castingCount, icon: <Users className="h-4 w-4" aria-hidden /> },
    { label: "Schauspieler", value: assignedActorCount, icon: <UserRoundCheck className="h-4 w-4" aria-hidden /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Besetzung"
        description="Erstelle neue Figuren, pflege Beschreibungen und organisiere die vollständige Besetzung deines Ensembles."
        breadcrumbs={breadcrumbs}
      />

      <HeaderStats stats={headerStats} showId={show.id} users={users} characters={exportCharacters} showTitle={showTitle} />

      <CastingFilters searchTerm={searchTerm} castingType={castingType} />

      {unassignedCharacters.length > 0 ? (
        <div
          className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive shadow-sm"
          role="status"
        >
          <p className="font-semibold">
            {unassignedCharacters.length === 1 ? "Diese Rolle ist noch nicht besetzt." : "Mehrere Rollen sind noch nicht besetzt."}
          </p>
          <p className="text-xs text-destructive/80">
            Klicke auf eine Rolle, um direkt zur Karte zu springen und ein Mitglied zuzuordnen.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unassignedCharacters.map((character) => (
              <Button
                key={character.id}
                asChild
                variant="outline"
                size="sm"
                className="border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <a href={`#role-${character.id}`}>{character.name}</a>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        {show.characters.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Noch keine Rollen angelegt. Nutze den Button „Rolle anlegen“, um die erste Figur zu erstellen.
              </p>
            </CardContent>
          </Card>
        ) : filteredCharacters.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Keine Rollen erfüllen aktuell die ausgewählten Filter oder Suchbegriffe.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
            {filteredCharacters.map((character) => (
              <CharacterCard key={character.id} character={character} users={users} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
