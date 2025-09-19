import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterCastingType, BreakdownStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  createCharacterAction,
  updateCharacterAction,
  deleteCharacterAction,
  assignCharacterCastingAction,
  updateCharacterCastingAction,
  removeCharacterCastingAction,
  createSceneAction,
  updateSceneAction,
  deleteSceneAction,
  addSceneCharacterAction,
  removeSceneCharacterAction,
  createBreakdownItemAction,
  updateBreakdownItemAction,
  removeBreakdownItemAction,
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

const STATUS_LABELS: Record<BreakdownStatus, string> = {
  planned: "Geplant",
  in_progress: "In Arbeit",
  blocked: "Blockiert",
  ready: "Bereit",
  done: "Erledigt",
};

const selectSmallClassName =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function formatUserName(user: { name: string | null; email: string | null }) {
  if (user.name && user.name.trim()) return user.name;
  if (user.email) return user.email;
  return "Unbekannt";
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

  const [show, departments, users] = await Promise.all([
    prisma.show.findUnique({
      where: { id: params.showId },
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
                user: { select: { id: true, name: true, email: true } },
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
            summary: true,
            location: true,
            timeOfDay: true,
            notes: true,
            sequence: true,
            durationMinutes: true,
            slug: true,
            characters: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                isFeatured: true,
                order: true,
                character: { select: { id: true, name: true, shortName: true, color: true } },
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
                department: { select: { id: true, name: true, slug: true, color: true } },
                assignedToId: true,
                assignedTo: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, color: true } }),
    prisma.user.findMany({
      orderBy: [
        { name: "asc" },
        { email: "asc" },
      ],
      select: { id: true, name: true, email: true },
    }),
  ]);

  if (!show) {
    notFound();
  }

  const showPath = `/mitglieder/produktionen/${show.id}`;
  const statusOptions = Object.values(BreakdownStatus);

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Produktion {show.year}</p>
          <h1 className="text-2xl font-semibold">{show.title ?? `Produktion ${show.year}`}</h1>
          {show.synopsis ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{show.synopsis}</p>
          ) : null}
        </div>
        <Button asChild variant="ghost">
          <Link href="/mitglieder/produktionen">Zur Übersicht</Link>
        </Button>
      </div>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Figuren &amp; Besetzungen</h2>
          <p className="text-sm text-muted-foreground">
            Lege neue Rollen an, pflege Beschreibungen und ordne Ensemble-Mitglieder mit Primär-, Alternate- oder Cover-Funktionen zu.
          </p>
        </div>

        <div className="rounded-lg border border-border/70 bg-background/60 p-6">
          <h3 className="text-lg font-medium">Neue Rolle anlegen</h3>
          <form action={createCharacterAction} method="post" className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="showId" value={show.id} />
            <input type="hidden" name="redirectPath" value={showPath} />
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
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Notiz</label>
              <Textarea name="notes" rows={2} maxLength={500} placeholder="interne Notiz" />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Rolle speichern</Button>
            </div>
          </form>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {show.characters.map((character) => {
            const sortedCastings = [...character.castings].sort((a, b) => {
              const orderA = CASTING_ORDER.indexOf(a.type);
              const orderB = CASTING_ORDER.indexOf(b.type);
              return orderA - orderB;
            });
            return (
              <div key={character.id} className="flex flex-col gap-4 rounded-lg border border-border/70 bg-background/60 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{character.name}</h3>
                    {character.shortName ? (
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{character.shortName}</p>
                    ) : null}
                    {character.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">{character.description}</p>
                    ) : null}
                    {character.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">Notiz: {character.notes}</p>
                    ) : null}
                  </div>
                  <form action={deleteCharacterAction} method="post">
                    <input type="hidden" name="characterId" value={character.id} />
                    <input type="hidden" name="redirectPath" value={showPath} />
                    <Button type="submit" variant="ghost" size="sm">
                      Entfernen
                    </Button>
                  </form>
                </div>

                <form
                  action={updateCharacterAction}
                  method="post"
                  className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4"
                >
                  <input type="hidden" name="characterId" value={character.id} />
                  <input type="hidden" name="redirectPath" value={showPath} />
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
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Beschreibung
                      </label>
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
                  <div className="flex justify-end">
                    <Button type="submit" variant="outline" size="sm">
                      Rolle aktualisieren
                    </Button>
                  </div>
                </form>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Besetzung</h4>
                  <div className="space-y-3">
                    {sortedCastings.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Noch keine Besetzung zugeordnet.</p>
                    ) : (
                      sortedCastings.map((casting) => (
                        <div
                          key={casting.id}
                          className="rounded-md border border-border/60 bg-background/80 p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{formatUserName(casting.user)}</p>
                              <p className="text-xs text-muted-foreground">{CASTING_LABELS[casting.type]}</p>
                              {casting.notes ? (
                                <p className="text-xs text-muted-foreground">Notiz: {casting.notes}</p>
                              ) : null}
                            </div>
                            <form action={removeCharacterCastingAction} method="post">
                              <input type="hidden" name="castingId" value={casting.id} />
                              <input type="hidden" name="redirectPath" value={showPath} />
                              <Button type="submit" variant="ghost" size="sm">
                                Entfernen
                              </Button>
                            </form>
                          </div>
                          <form
                            action={updateCharacterCastingAction}
                            method="post"
                            className="mt-3 grid gap-2 md:grid-cols-3"
                          >
                            <input type="hidden" name="castingId" value={casting.id} />
                            <input type="hidden" name="redirectPath" value={showPath} />
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
                                Speichern
                              </Button>
                            </div>
                          </form>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-md border border-dashed border-border/60 bg-background/60 p-3">
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Mitglied zuordnen
                    </h5>
                    <form className="mt-2 grid gap-2 md:grid-cols-4" action={assignCharacterCastingAction} method="post">
                      <input type="hidden" name="characterId" value={character.id} />
                      <input type="hidden" name="redirectPath" value={showPath} />
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
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Szenen &amp; Breakdowns</h2>
          <p className="text-sm text-muted-foreground">
            Pflege Szeneninformationen, setze Rollenauftritte und dokumentiere Aufgaben für Gewerke mit Status und Zuständigkeiten.
          </p>
        </div>

        <div className="rounded-lg border border-border/70 bg-background/60 p-6">
          <h3 className="text-lg font-medium">Neue Szene anlegen</h3>
          <form action={createSceneAction} method="post" className="mt-4 grid gap-4 md:grid-cols-3">
            <input type="hidden" name="showId" value={show.id} />
            <input type="hidden" name="redirectPath" value={showPath} />
            <div className="space-y-1">
              <label className="text-sm font-medium">Nummer</label>
              <Input name="identifier" maxLength={40} placeholder="z.B. 1" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Titel</label>
              <Input name="title" maxLength={160} placeholder="z.B. Ankunft im Park" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ort</label>
              <Input name="location" maxLength={120} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Tageszeit</label>
              <Input name="timeOfDay" maxLength={60} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Slug</label>
              <Input name="slug" maxLength={80} placeholder="szene-1" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reihenfolge</label>
              <Input type="number" name="sequence" min={0} max={9999} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Dauer (Minuten)</label>
              <Input type="number" name="duration" min={0} max={600} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="text-sm font-medium">Zusammenfassung</label>
              <Textarea name="summary" rows={2} maxLength={600} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="text-sm font-medium">Notizen</label>
              <Textarea name="notes" rows={2} maxLength={400} />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Szene speichern</Button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          {show.scenes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Szenen erfasst.</p>
          ) : (
            show.scenes.map((scene) => {
              const assignedCharacterIds = new Set(scene.characters.map((entry) => entry.character.id));
              const availableCharacters = show.characters.filter((character) => !assignedCharacterIds.has(character.id));
              return (
                <div key={scene.id} className="flex flex-col gap-5 rounded-lg border border-border/70 bg-background/60 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Szene {scene.identifier ?? "?"}</span>
                        <span className="text-sm text-muted-foreground">#{scene.sequence ?? 0}</span>
                      </div>
                      <h3 className="text-lg font-semibold">{scene.title ?? "(ohne Titel)"}</h3>
                      {scene.summary ? (
                        <p className="mt-1 text-sm text-muted-foreground">{scene.summary}</p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {scene.location ? <span>Ort: {scene.location}</span> : null}
                        {scene.timeOfDay ? <span>Tageszeit: {scene.timeOfDay}</span> : null}
                        {scene.durationMinutes ? <span>Dauer: {scene.durationMinutes} min</span> : null}
                      </div>
                    </div>
                    <form action={deleteSceneAction} method="post">
                      <input type="hidden" name="sceneId" value={scene.id} />
                      <input type="hidden" name="redirectPath" value={showPath} />
                      <Button type="submit" variant="ghost" size="sm">
                        Entfernen
                      </Button>
                    </form>
                  </div>

                  <form
                    action={updateSceneAction}
                    method="post"
                    className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4"
                  >
                    <input type="hidden" name="sceneId" value={scene.id} />
                    <input type="hidden" name="redirectPath" value={showPath} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nummer</label>
                        <Input name="identifier" defaultValue={scene.identifier ?? ""} maxLength={40} />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Titel</label>
                        <Input name="title" defaultValue={scene.title ?? ""} maxLength={160} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Slug</label>
                        <Input name="slug" defaultValue={scene.slug ?? ""} maxLength={80} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ort</label>
                        <Input name="location" defaultValue={scene.location ?? ""} maxLength={120} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tageszeit</label>
                        <Input name="timeOfDay" defaultValue={scene.timeOfDay ?? ""} maxLength={60} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reihenfolge</label>
                        <Input
                          type="number"
                          name="sequence"
                          defaultValue={scene.sequence ?? 0}
                          min={0}
                          max={9999}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dauer (Minuten)</label>
                        <Input
                          type="number"
                          name="duration"
                          defaultValue={scene.durationMinutes ?? ""}
                          min={0}
                          max={600}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-3">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Zusammenfassung</label>
                        <Textarea name="summary" rows={2} maxLength={600} defaultValue={scene.summary ?? ""} />
                      </div>
                      <div className="space-y-1 md:col-span-3">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notizen</label>
                        <Textarea name="notes" rows={2} maxLength={400} defaultValue={scene.notes ?? ""} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" variant="outline" size="sm">
                        Szene aktualisieren
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Rolleneinsatz</h4>
                    {scene.characters.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Keine Figuren in dieser Szene.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {scene.characters.map((entry) => (
                          <form
                            key={entry.id}
                            action={removeSceneCharacterAction}
                            method="post"
                            className="flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1"
                          >
                            <input type="hidden" name="assignmentId" value={entry.id} />
                            <input type="hidden" name="redirectPath" value={showPath} />
                            <span className="text-sm font-medium">{entry.character.name}</span>
                            <Button type="submit" variant="ghost" size="sm">
                              ×
                            </Button>
                          </form>
                        ))}
                      </div>
                    )}

                    <div className="rounded-md border border-dashed border-border/60 bg-background/60 p-3">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Figur hinzufügen
                      </h5>
                      <form className="mt-2 grid gap-2 md:grid-cols-4" action={addSceneCharacterAction} method="post">
                        <input type="hidden" name="sceneId" value={scene.id} />
                        <input type="hidden" name="redirectPath" value={showPath} />
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Figur</label>
                          <select name="characterId" className={selectSmallClassName} required>
                            <option value="">Figur auswählen</option>
                            {availableCharacters.map((characterOption) => (
                              <option key={characterOption.id} value={characterOption.id}>
                                {characterOption.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Sortierung</label>
                          <Input type="number" name="order" min={0} max={9999} />
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" name="isFeatured" className="h-4 w-4 rounded border-border" />
                          <span className="text-xs text-muted-foreground">Hervorgehoben</span>
                        </div>
                        <div className="md:col-span-4 flex justify-end">
                          <Button type="submit" size="sm">
                            Figur zuordnen
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Breakdown</h4>
                    <div className="space-y-3">
                      {scene.breakdownItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Noch keine Aufgaben hinterlegt.</p>
                      ) : (
                        scene.breakdownItems.map((item) => (
                          <div key={item.id} className="rounded-md border border-border/60 bg-background/80 p-4 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-medium">{item.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.department.name} · Status: {STATUS_LABELS[item.status]}
                                </p>
                                {item.assignedTo ? (
                                  <p className="text-xs text-muted-foreground">
                                    Zuständig: {formatUserName(item.assignedTo)}
                                  </p>
                                ) : null}
                              </div>
                              <form action={removeBreakdownItemAction} method="post">
                                <input type="hidden" name="itemId" value={item.id} />
                                <input type="hidden" name="redirectPath" value={showPath} />
                                <Button type="submit" variant="ghost" size="sm">
                                  Entfernen
                                </Button>
                              </form>
                            </div>
                            {item.description ? (
                              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                            ) : null}
                            {item.note ? (
                              <p className="text-xs text-muted-foreground">Notiz: {item.note}</p>
                            ) : null}
                            {item.neededBy ? (
                              <p className="text-xs text-muted-foreground">
                                Benötigt bis: {item.neededBy.toISOString().slice(0, 10)}
                              </p>
                            ) : null}
                            <form
                              action={updateBreakdownItemAction}
                              method="post"
                              className="mt-3 grid gap-2 md:grid-cols-4"
                            >
                              <input type="hidden" name="itemId" value={item.id} />
                              <input type="hidden" name="redirectPath" value={showPath} />
                              <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Titel
                                </label>
                                <Input name="title" defaultValue={item.title} maxLength={160} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Status
                                </label>
                                <select name="status" defaultValue={item.status} className={selectSmallClassName}>
                                  {statusOptions.map((status) => (
                                    <option key={status} value={status}>
                                      {STATUS_LABELS[status]}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Benötigt bis
                                </label>
                                <Input
                                  type="date"
                                  name="neededBy"
                                  defaultValue={item.neededBy ? item.neededBy.toISOString().slice(0, 10) : ""}
                                />
                              </div>
                              <div className="space-y-1 md:col-span-4">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Beschreibung
                                </label>
                                <Textarea name="description" rows={2} maxLength={600} defaultValue={item.description ?? ""} />
                              </div>
                              <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Notiz
                                </label>
                                <Input name="note" defaultValue={item.note ?? ""} maxLength={300} />
                              </div>
                              <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Zuständig
                                </label>
                                <select
                                  name="assignedToId"
                                  defaultValue={item.assignedToId ?? ""}
                                  className={selectSmallClassName}
                                >
                                  <option value="">(keine Zuordnung)</option>
                                  {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                      {formatUserName(user)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="md:col-span-4 flex justify-end">
                                <Button type="submit" variant="outline" size="sm">
                                  Speichern
                                </Button>
                              </div>
                            </form>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="rounded-md border border-dashed border-border/60 bg-background/60 p-3">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Breakdown-Eintrag hinzufügen
                      </h5>
                      <form className="mt-2 grid gap-2 md:grid-cols-4" action={createBreakdownItemAction} method="post">
                        <input type="hidden" name="sceneId" value={scene.id} />
                        <input type="hidden" name="redirectPath" value={showPath} />
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Gewerk</label>
                          <select name="departmentId" className={selectSmallClassName} required>
                            <option value="">Gewerk auswählen</option>
                            {departments.map((departmentOption) => (
                              <option key={departmentOption.id} value={departmentOption.id}>
                                {departmentOption.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Status</label>
                          <select name="status" className={selectSmallClassName} defaultValue={BreakdownStatus.planned}>
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Benötigt bis</label>
                          <Input type="date" name="neededBy" />
                        </div>
                        <div className="space-y-1 md:col-span-4">
                          <label className="text-xs font-medium text-muted-foreground">Titel</label>
                          <Input name="title" maxLength={160} required placeholder="Aufgabe" />
                        </div>
                        <div className="space-y-1 md:col-span-4">
                          <label className="text-xs font-medium text-muted-foreground">Beschreibung</label>
                          <Textarea name="description" rows={2} maxLength={600} placeholder="Details zur Aufgabe" />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">Zuständig</label>
                          <select name="assignedToId" className={selectSmallClassName}>
                            <option value="">(optional)</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {formatUserName(user)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1 md:col-span-4">
                          <label className="text-xs font-medium text-muted-foreground">Notiz</label>
                          <Input name="note" maxLength={300} placeholder="interne Notiz" />
                        </div>
                        <div className="md:col-span-4 flex justify-end">
                          <Button type="submit" size="sm">
                            Breakdown speichern
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
