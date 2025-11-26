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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/members/page-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";
import { Pencil, Plus, Trash2 } from "lucide-react";

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

export default async function ProduktionsBesetzungPage() {
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
  const headerStats = [
    { label: "Rollen", value: characterCount, hint: "Angelegte Figuren" },
    { label: "Besetzungen", value: castingCount, hint: "Zuordnungen im Ensemble" },
    { label: "Mitglieder", value: users.length, hint: "Verfügbare Personen" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Besetzung"
        description="Erstelle neue Figuren, pflege Beschreibungen und organisiere die vollständige Besetzung deines Ensembles."
        breadcrumbs={breadcrumbs}
      />

      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2 text-sm">
            {headerStats.map((stat) => (
              <span
                key={stat.label}
                className="inline-flex min-w-[200px] flex-1 items-start justify-between gap-3 rounded-md border border-border/60 bg-background/80 px-3 py-2"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</span>
                <div className="text-right">
                  <p className="text-base font-semibold text-foreground">{stat.value}</p>
                  {stat.hint ? (
                    <p className="text-[11px] text-muted-foreground">{stat.hint}</p>
                  ) : null}
                </div>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/mitglieder/produktionen/szenen">Zu den Szenen</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Rolle anlegen
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

      <section className="grid gap-6 xl:grid-cols-2">
        {show.characters.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Noch keine Rollen angelegt. Nutze den Button &bdquo;Rolle anlegen&ldquo;, um die erste Figur zu erstellen.
              </p>
            </CardContent>
          </Card>
        ) : (
          show.characters.map((character) => {
            const sortedCastings = [...character.castings].sort((a, b) => {
              const orderA = CASTING_ORDER.indexOf(a.type);
              const orderB = CASTING_ORDER.indexOf(b.type);
              return orderA - orderB;
            });

            return (
              <Card key={character.id} className="space-y-5">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-semibold">{character.name}</CardTitle>
                      {character.shortName ? (
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{character.shortName}</p>
                      ) : null}
                      {character.description ? (
                        <p className="text-sm text-muted-foreground">{character.description}</p>
                      ) : null}
                      {character.notes ? (
                        <p className="text-xs text-muted-foreground">Notiz: {character.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
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
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Besetzung</h3>
                    <div className="space-y-3">
                      {sortedCastings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Noch keine Besetzung zugeordnet.</p>
                      ) : (
                        sortedCastings.map((casting) => (
                          <details
                            key={casting.id}
                            className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm shadow-sm [&_summary::-webkit-details-marker]:hidden"
                          >
                            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">{formatUserName(casting.user)}</p>
                                <p className="text-xs text-muted-foreground">{CASTING_LABELS[casting.type]}</p>
                                {casting.notes ? (
                                  <p className="text-xs text-muted-foreground">Notiz: {casting.notes}</p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Besetzung bearbeiten"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
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
                            </summary>

                            <form
                              action={updateCharacterCastingAction}
                              method="post"
                              className="mt-3 grid gap-2 border-t border-border/60 pt-3 md:grid-cols-3"
                            >
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
                              <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notiz</label>
                                <Input name="notes" defaultValue={casting.notes ?? ""} maxLength={200} />
                              </div>
                              <div className="md:col-span-3 flex justify-end">
                                <Button type="submit" variant="outline" size="sm">
                                  Änderungen speichern
                                </Button>
                              </div>
                            </form>
                          </details>
                        ))
                      )}
                    </div>

                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
