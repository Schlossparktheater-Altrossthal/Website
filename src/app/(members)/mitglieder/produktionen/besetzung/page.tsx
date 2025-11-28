import Link from "next/link";
import { CharacterCastingType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { getUserDisplayName } from "@/lib/names";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { BadgeCheck, Check, ChevronDown, Filter, Pencil, Plus, Search, Sparkles, Trash2, UserRoundCheck, Users, ArrowUpDown } from "lucide-react";

import {
  createCharacterAction,
  updateCharacterAction,
  deleteCharacterAction,
  assignCharacterCastingAction,
  updateCharacterCastingAction,
  removeCharacterCastingAction,
} from "../actions";

const CASTING_LABELS: Record<CharacterCastingType, string> = {
  primary: "Primär",
  alternate: "Alternate",
  cover: "Cover",
  cameo: "Cameo",
};

const CASTING_ORDER: CharacterCastingType[] = [
  CharacterCastingType.primary,
  CharacterCastingType.alternate,
  CharacterCastingType.cover,
  CharacterCastingType.cameo,
];

const selectSmallClassName =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type DisplayUser = {
  firstName?: string | null;
  lastName?: string | null;
  name: string | null;
  email: string | null;
};

function formatUserName(user?: DisplayUser | null) {
  if (!user) return "Unbekannt";
  return getUserDisplayName(user, "Unbekannt");
}

type BesetzungSearchParams = {
  q?: string;
  person?: string;
  scene?: string;
  sort?: "order" | "name" | "scene";
};

export default async function ProduktionsBesetzungPage({
  searchParams,
}: {
  searchParams?: Promise<BesetzungSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
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
  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/produktionen/besetzung")];

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
        scenes: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            identifier: true,
            title: true,
            characters: { select: { characterId: true } },
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

  const currentPath = "/mitglieder/produktionen/besetzung";
  const characterCount = show.characters.length;
  const castingCount = show.characters.reduce((acc, character) => acc + character.castings.length, 0);
  const searchQuery = (resolvedSearchParams?.q ?? "").trim();
  const personFilter = resolvedSearchParams?.person ?? "";
  const sceneFilter = resolvedSearchParams?.scene ?? "";
  const sortOrder = resolvedSearchParams?.sort ?? "order";
  const characterSceneCounts = new Map<string, number>();

  show.scenes?.forEach((scene) => {
    scene.characters.forEach((sceneCharacter) => {
      characterSceneCounts.set(
        sceneCharacter.characterId,
        (characterSceneCounts.get(sceneCharacter.characterId) ?? 0) + 1,
      );
    });
  });

  const filteredCharacters = show.characters.filter((character) => {
    const matchesQuery = searchQuery
      ? [character.name, character.shortName]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;

    const matchesPerson = personFilter
      ? character.castings.some((casting) => casting.user?.id === personFilter)
      : true;

    const matchesScene = sceneFilter
      ? show.scenes?.some((scene) =>
          scene.id === sceneFilter && scene.characters.some((sceneCharacter) => sceneCharacter.characterId === character.id),
        ) ?? false
      : true;

    return matchesQuery && matchesPerson && matchesScene;
  });

  const sortedCharacters = [...filteredCharacters].sort((a, b) => {
    if (sortOrder === "name") {
      return a.name.localeCompare(b.name, "de");
    }

    if (sortOrder === "scene") {
      const scenesA = characterSceneCounts.get(a.id) ?? 0;
      const scenesB = characterSceneCounts.get(b.id) ?? 0;
      if (scenesA === scenesB) {
        return a.name.localeCompare(b.name, "de");
      }
      return scenesB - scenesA;
    }

    return (a.order ?? 0) - (b.order ?? 0);
  });

  const sceneOptions = show.scenes?.map((scene) => ({
    id: scene.id,
    label: scene.title ?? scene.identifier ?? "Szene", 
  }));
  const headerStats = [
    {
      label: "Rollen",
      value: characterCount,
      hint: "Angelegte Figuren",
      icon: <Sparkles className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Besetzungen",
      value: castingCount,
      hint: "Zuordnungen im Ensemble",
      icon: <BadgeCheck className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Mitglieder",
      value: users.length,
      hint: "Verfügbare Personen",
      icon: <Users className="h-4 w-4" aria-hidden />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Besetzung"
        description="Erstelle neue Figuren, pflege Beschreibungen und organisiere die vollständige Besetzung deines Ensembles."
        breadcrumbs={breadcrumbs}
      />

      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {headerStats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3 shadow-sm"
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold leading-tight text-foreground">{stat.value}</p>
                  {stat.hint ? (
                    <p className="text-xs text-muted-foreground">{stat.hint}</p>
                  ) : null}
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-background/70 text-muted-foreground">
                  {stat.icon}
                </span>
              </div>
            ))}
          </div>
          <div className="flex w-full flex-col items-stretch gap-2">
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/mitglieder/produktionen/szenen">Zu den Szenen</Link>
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full">
                  Neue Rolle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Neue Rolle anlegen</DialogTitle>
                  <DialogDescription>
                    Füge Figuren hinzu und definiere Reihenfolge, Farbe sowie optionale Notizen.
                  </DialogDescription>
                </DialogHeader>
                <form action={createCharacterAction} method="post" className="grid gap-6">
                  <input type="hidden" name="showId" value={show.id} />
                  <input type="hidden" name="redirectPath" value={currentPath} />
                  <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4 md:grid-cols-2">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Basisdaten
                    </legend>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Name</label>
                      <Input name="name" placeholder="z.B. Protagonist" minLength={2} maxLength={120} required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Kurzname</label>
                      <Input name="shortName" placeholder="Kurzlabel" maxLength={40} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-sm font-medium">Beschreibung</label>
                      <Textarea name="description" rows={2} maxLength={500} placeholder="Charakterbeschreibung" />
                    </div>
                  </fieldset>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Farbe</label>
                      <input
                        type="color"
                        name="color"
                        defaultValue="#7c3aed"
                        className="h-10 w-full cursor-pointer rounded-md border border-input bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Sortierung</label>
                      <Input type="number" name="order" min={0} max={9999} placeholder="0" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Notiz</label>
                    <Textarea name="notes" rows={2} maxLength={500} placeholder="Interne Notiz" />
                  </div>
                  <DialogFooter className="pt-2 sm:justify-end">
                    <Button type="submit">Rolle speichern</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3 shadow-sm">
        <form className="flex w-full flex-wrap items-center gap-2" method="get">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              name="q"
              defaultValue={searchQuery}
              placeholder="Rollen durchsuchen"
              className="pl-9 pr-24"
              type="search"
              aria-label="Rollen suchen"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Sortierung anpassen"
                  >
                    <ArrowUpDown className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Sortierung</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {[
                    { label: "Standard (Reihenfolge)", value: "order" },
                    { label: "Rollennamen A-Z", value: "name" },
                    { label: "Szenenanzahl (absteigend)", value: "scene" },
                  ].map((option) => (
                    <form key={option.value} method="get" className="w-full">
                      <input type="hidden" name="q" value={searchQuery} />
                      <input type="hidden" name="person" value={personFilter} />
                      <input type="hidden" name="scene" value={sceneFilter} />
                      <DropdownMenuItem asChild>
                        <button
                          type="submit"
                          name="sort"
                          value={option.value}
                          className="flex w-full items-center justify-between"
                        >
                          <span>{option.label}</span>
                          {sortOrder === option.value ? <Check className="h-4 w-4" aria-hidden /> : null}
                        </button>
                      </DropdownMenuItem>
                    </form>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Filter öffnen"
                  >
                    <Filter className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Nach Personen filtern</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <form method="get" className="w-full">
                    <input type="hidden" name="q" value={searchQuery} />
                    <input type="hidden" name="scene" value={sceneFilter} />
                    <input type="hidden" name="sort" value={sortOrder} />
                    <DropdownMenuItem asChild>
                      <button type="submit" name="person" value="" className="flex w-full items-center justify-between">
                        <span>Alle Personen</span>
                        {personFilter === "" ? <Check className="h-4 w-4" aria-hidden /> : null}
                      </button>
                    </DropdownMenuItem>
                  </form>
                  {users.map((user) => (
                    <form key={user.id} method="get" className="w-full">
                      <input type="hidden" name="q" value={searchQuery} />
                      <input type="hidden" name="scene" value={sceneFilter} />
                      <input type="hidden" name="sort" value={sortOrder} />
                      <DropdownMenuItem asChild>
                        <button type="submit" name="person" value={user.id} className="flex w-full items-center justify-between">
                          <span>{formatUserName(user)}</span>
                          {personFilter === user.id ? <Check className="h-4 w-4" aria-hidden /> : null}
                        </button>
                      </DropdownMenuItem>
                    </form>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Nach Szenen filtern</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <form method="get" className="w-full">
                    <input type="hidden" name="q" value={searchQuery} />
                    <input type="hidden" name="person" value={personFilter} />
                    <input type="hidden" name="sort" value={sortOrder} />
                    <DropdownMenuItem asChild>
                      <button type="submit" name="scene" value="" className="flex w-full items-center justify-between">
                        <span>Alle Szenen</span>
                        {sceneFilter === "" ? <Check className="h-4 w-4" aria-hidden /> : null}
                      </button>
                    </DropdownMenuItem>
                  </form>
                  {sceneOptions?.map((scene) => (
                    <form key={scene.id} method="get" className="w-full">
                      <input type="hidden" name="q" value={searchQuery} />
                      <input type="hidden" name="person" value={personFilter} />
                      <input type="hidden" name="sort" value={sortOrder} />
                      <DropdownMenuItem asChild>
                        <button type="submit" name="scene" value={scene.id} className="flex w-full items-center justify-between">
                          <span>{scene.label}</span>
                          {sceneFilter === scene.id ? <Check className="h-4 w-4" aria-hidden /> : null}
                        </button>
                      </DropdownMenuItem>
                    </form>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <input type="hidden" name="person" value={personFilter} />
          <input type="hidden" name="scene" value={sceneFilter} />
          <input type="hidden" name="sort" value={sortOrder} />
          <Button type="submit" size="sm" variant="outline">
            Suchen
          </Button>
        </form>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {show.characters.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Noch keine Rollen angelegt. Nutze den Button &bdquo;Rolle anlegen&ldquo;, um die erste Figur zu erstellen.
              </p>
            </CardContent>
          </Card>
        ) : sortedCharacters.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Keine Rollen entsprechen derzeit den Such- und Filtereinstellungen.
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedCharacters.map((character) => {
            const sortedCastings = [...character.castings].sort((a, b) => {
              const orderA = CASTING_ORDER.indexOf(a.type);
              const orderB = CASTING_ORDER.indexOf(b.type);
              return orderA - orderB;
            });

            return (
              <Card key={character.id} className="overflow-hidden border border-border/70 bg-card/70 shadow-sm">
                <CardHeader className="space-y-2 border-b border-border/60 bg-background/50 px-3 py-3">
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
                            {character.shortName ? (
                              <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {character.shortName}
                              </span>
                            ) : null}
                          </div>
                          {character.description ? (
                            <p className="text-sm text-muted-foreground">{character.description}</p>
                          ) : null}
                          {character.notes ? (
                            <p className="text-xs text-muted-foreground">Notiz: {character.notes}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              aria-label="Besetzung hinzufügen"
                            >
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
                              <input type="hidden" name="characterId" value={character.id} />
                              <input type="hidden" name="redirectPath" value={currentPath} />
                              <div className="space-y-1">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Mitglied
                                </label>
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
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Besetzungsart
                                </label>
                                <select
                                  name="type"
                                  className={selectSmallClassName}
                                  defaultValue={CharacterCastingType.primary}
                                >
                                  {CASTING_ORDER.map((type) => (
                                    <option key={type} value={type}>
                                      {CASTING_LABELS[type]}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Notiz
                                </label>
                                <Input name="notes" maxLength={200} placeholder="optional" />
                              </div>
                              <DialogFooter className="sm:justify-end">
                                <DialogClose asChild>
                                  <Button type="button" variant="ghost">
                                    Abbrechen
                                  </Button>
                                </DialogClose>
                                <Button type="submit">Mitglied besetzen</Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              aria-label="Rolle bearbeiten"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>Rolle bearbeiten</DialogTitle>
                              <DialogDescription>
                                Aktualisiere die Stammdaten der Rolle und speichere deine Änderungen.
                              </DialogDescription>
                            </DialogHeader>
                            <form
                              action={updateCharacterAction}
                              method="post"
                              className="grid gap-3"
                            >
                              <input type="hidden" name="characterId" value={character.id} />
                              <input type="hidden" name="redirectPath" value={currentPath} />
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</label>
                                  <Input name="name" defaultValue={character.name} minLength={2} maxLength={120} required />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kurzname</label>
                                  <Input name="shortName" defaultValue={character.shortName ?? ""} maxLength={40} />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beschreibung</label>
                                  <Textarea name="description" rows={2} maxLength={500} defaultValue={character.description ?? ""} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sortierung</label>
                                  <Input type="number" name="order" defaultValue={character.order ?? 0} min={0} max={9999} />
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
                                <Button type="submit" variant="outline">
                                  Rolle aktualisieren
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-1">
                        <UserRoundCheck className="h-3.5 w-3.5" aria-hidden /> {sortedCastings.length} Besetzungen
                      </span>
                      {character.description ? null : (
                        <span className="rounded-full bg-muted/50 px-2 py-1">Ohne Beschreibung</span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 bg-card/40 px-3 py-3">
                    <details className="group rounded-lg border border-border/60 bg-background/50">
                      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-foreground">
                        <span>Besetzung</span>
                        <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                          {sortedCastings.length > 0 ? `${sortedCastings.length} Zuordnungen` : "Noch keine Zuordnungen"}
                          <ChevronDown className="h-4 w-4 transition duration-200 group-open:rotate-180" aria-hidden />
                        </span>
                      </summary>
                      <div className="space-y-3 border-t border-border/60 px-3 py-3">
                        {sortedCastings.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Noch keine Besetzung zugeordnet.</p>
                        ) : (
                          sortedCastings.map((casting) => (
                            <div
                              key={casting.id}
                              className="rounded-lg border border-border/70 bg-background/80 p-3 text-sm shadow-sm"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium">{formatUserName(casting.user)}</p>
                                  <p className="text-xs text-muted-foreground">{CASTING_LABELS[casting.type]}</p>
                                  {casting.notes ? (
                                    <p className="text-xs text-muted-foreground">Notiz: {casting.notes}</p>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        aria-label="Besetzung bearbeiten"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Besetzung bearbeiten</DialogTitle>
                                        <DialogDescription>
                                          Passe Besetzungsart und optionale Notizen für {formatUserName(casting.user)} an.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <form action={updateCharacterCastingAction} method="post" className="grid gap-3">
                                        <input type="hidden" name="castingId" value={casting.id} />
                                        <input type="hidden" name="redirectPath" value={currentPath} />
                                        <div className="space-y-1">
                                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Besetzungsart
                                          </label>
                                          <select name="type" defaultValue={casting.type} className={selectSmallClassName}>
                                            {CASTING_ORDER.map((type) => (
                                              <option key={type} value={type}>
                                                {CASTING_LABELS[type]}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Notiz
                                          </label>
                                          <Input name="notes" defaultValue={casting.notes ?? ""} maxLength={200} />
                                        </div>
                                        <DialogFooter className="sm:justify-end">
                                          <DialogClose asChild>
                                            <Button type="button" variant="ghost">
                                              Abbrechen
                                            </Button>
                                          </DialogClose>
                                          <Button type="submit" variant="outline">
                                            Änderungen speichern
                                          </Button>
                                        </DialogFooter>
                                      </form>
                                    </DialogContent>
                                  </Dialog>
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
                            </div>
                            ))
                          )}
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                );
              })
          )}
        </section>
    </div>
  );
}
