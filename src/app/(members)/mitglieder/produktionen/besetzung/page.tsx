import Link from "next/link";
import { CharacterCastingType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { getUserDisplayName } from "@/lib/names";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionWorkspaceHeader } from "@/components/production/workspace-header";
import { ProductionWorkspaceEmptyState } from "@/components/production/workspace-empty-state";

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
      <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
        Du hast keinen Zugriff auf die Produktionsplanung.
      </div>
    );
  }

  const activeProduction = await getActiveProduction(session.user?.id);
  const headerActions = (
    <Button asChild variant="outline" size="sm">
      <Link href="/mitglieder/produktionen">Zur Übersicht</Link>
    </Button>
  );

  if (!activeProduction) {
    return (
      <div className="space-y-10">
        <ProductionWorkspaceHeader
          title="Rollen &amp; Besetzungen"
          description="Erstelle neue Figuren, pflege Beschreibungen und ordne Ensemble-Mitglieder als Primär-, Alternate- oder Cover-Besetzung zu."
          activeWorkspace="casting"
          production={null}
          actions={headerActions}
        />
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle in der Produktionsübersicht eine aktive Produktion aus, um Rollen und Besetzungen zu bearbeiten."
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
        Die aktuell ausgewählte Produktion konnte nicht gefunden werden. Bitte wähle sie erneut in der Übersicht aus.
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

  const summaryActions = (
    <Button asChild size="sm" variant="outline">
      <Link href="/mitglieder/produktionen/szenen">Szenen &amp; Breakdowns</Link>
    </Button>
  );

  return (
    <div className="space-y-10">
      <ProductionWorkspaceHeader
        title="Rollen &amp; Besetzungen"
        description="Erstelle neue Figuren, pflege Beschreibungen und ordne Ensemble-Mitglieder als Primär-, Alternate- oder Cover-Besetzung zu."
        activeWorkspace="casting"
        production={activeProduction}
        stats={headerStats}
        actions={headerActions}
        summaryActions={summaryActions}
      />

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">Neue Rolle anlegen</CardTitle>
          <p className="text-sm text-muted-foreground">Füge Figuren hinzu und definiere Reihenfolge, Farbe sowie optionale Notizen.</p>
        </CardHeader>
        <CardContent>
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
            <div>
              <Button type="submit">Rolle speichern</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        {show.characters.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">Noch keine Rollen angelegt. Lege eine neue Rolle über das Formular oben an.</p>
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
                    <form action={deleteCharacterAction} method="post">
                      <input type="hidden" name="characterId" value={character.id} />
                      <input type="hidden" name="redirectPath" value={currentPath} />
                      <Button type="submit" variant="ghost" size="sm">
                        Entfernen
                      </Button>
                    </form>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <details className="group rounded-lg border border-border/60 bg-background/70 p-4 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                      <span>Rolle bearbeiten</span>
                      <span className="text-xs text-muted-foreground group-open:hidden">Öffnen</span>
                      <span className="hidden text-xs text-muted-foreground group-open:inline">Schließen</span>
                    </summary>
                    <form
                      action={updateCharacterAction}
                      method="post"
                      className="mt-4 grid gap-3 rounded-md border border-border/50 bg-background/80 p-4 md:grid-cols-2"
                    >
                      <input type="hidden" name="characterId" value={character.id} />
                      <input type="hidden" name="redirectPath" value={currentPath} />
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
                      <div className="md:col-span-2 flex justify-end">
                        <Button type="submit" variant="outline" size="sm">
                          Rolle aktualisieren
                        </Button>
                      </div>
                    </form>
                  </details>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Besetzung</h3>
                    <div className="space-y-3">
                      {sortedCastings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Noch keine Besetzung zugeordnet.</p>
                      ) : (
                        sortedCastings.map((casting) => (
                          <div
                            key={casting.id}
                            className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">{formatUserName(casting.user)}</p>
                                <p className="text-xs text-muted-foreground">{CASTING_LABELS[casting.type]}</p>
                                {casting.notes ? (
                                  <p className="text-xs text-muted-foreground">Notiz: {casting.notes}</p>
                                ) : null}
                              </div>
                              <form action={removeCharacterCastingAction} method="post">
                                <input type="hidden" name="castingId" value={casting.id} />
                                <input type="hidden" name="redirectPath" value={currentPath} />
                                <Button type="submit" variant="ghost" size="sm">
                                  Entfernen
                                </Button>
                              </form>
                            </div>

                            <details className="group mt-3 rounded-md border border-border/50 bg-background/70 p-3 [&_summary::-webkit-details-marker]:hidden">
                              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <span>Besetzung anpassen</span>
                                <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
                                <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
                              </summary>
                              <form
                                action={updateCharacterCastingAction}
                                method="post"
                                className="mt-3 grid gap-2 md:grid-cols-3"
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
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded-lg border border-dashed border-border/70 bg-background/50 p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Mitglied zuordnen
                      </h4>
                      <form className="mt-3 grid gap-2 md:grid-cols-4" action={assignCharacterCastingAction} method="post">
                        <input type="hidden" name="characterId" value={character.id} />
                        <input type="hidden" name="redirectPath" value={currentPath} />
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Mitglied</label>
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
                          <label className="text-xs font-medium text-muted-foreground">Besetzungsart</label>
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
                          <label className="text-xs font-medium text-muted-foreground">Notiz</label>
                          <Input name="notes" maxLength={200} placeholder="optional" />
                        </div>
                        <div className="md:col-span-4 flex justify-end">
                          <Button type="submit" size="sm">
                            Mitglied besetzen
                          </Button>
                        </div>
                      </form>
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
