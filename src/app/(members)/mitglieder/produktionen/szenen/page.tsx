import Link from "next/link";
import { BreakdownStatus } from "@prisma/client";

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
  createSceneAction,
  updateSceneAction,
  deleteSceneAction,
  addSceneCharacterAction,
  removeSceneCharacterAction,
  createBreakdownItemAction,
  updateBreakdownItemAction,
  removeBreakdownItemAction,
} from "../actions";

const STATUS_LABELS: Record<BreakdownStatus, string> = {
  planned: "Geplant",
  in_progress: "In Arbeit",
  blocked: "Blockiert",
  ready: "Bereit",
  done: "Erledigt",
};

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
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

export default async function ProduktionsSzenenPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.produktionen");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
        Du hast keinen Zugriff auf die Produktionsplanung.
      </div>
    );
  }

  const activeProduction = await getActiveProduction();
  const headerActions = (
    <Button asChild variant="outline" size="sm">
      <Link href="/mitglieder/produktionen">Zur Übersicht</Link>
    </Button>
  );

  if (!activeProduction) {
    return (
      <div className="space-y-10">
        <ProductionWorkspaceHeader
          title="Szenen &amp; Breakdowns"
          description="Plane Szenenabläufe, pflege Orte und Zeiten und behalte Aufgaben je Gewerk inklusive Status und Zuständigkeit im Blick."
          activeWorkspace="scenes"
          production={null}
          actions={headerActions}
        />
        <ProductionWorkspaceEmptyState
          title="Keine aktive Produktion ausgewählt"
          description="Wähle in der Produktionsübersicht eine aktive Produktion aus, um Szenen und Breakdowns zu verwalten."
        />
      </div>
    );
  }

  const [users, departments, show] = await Promise.all([
    prisma.user.findMany({
      orderBy: [
        { name: "asc" },
        { email: "asc" },
      ],
      select: { id: true, firstName: true, lastName: true, name: true, email: true },
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
          orderBy: { order: "asc" },
          select: { id: true, name: true, shortName: true, color: true },
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
                assignedTo: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
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

  const currentPath = "/mitglieder/produktionen/szenen";
  const statusOptions = Object.values(BreakdownStatus);
  const sceneCount = show.scenes.length;
  const breakdownCount = show.scenes.reduce((acc, scene) => acc + scene.breakdownItems.length, 0);
  const characterCount = show.characters.length;
  const headerStats = [
    { label: "Szenen", value: sceneCount, hint: "Erfasste Abläufe" },
    { label: "Breakdowns", value: breakdownCount, hint: "Aufgaben über alle Gewerke" },
    { label: "Rollen", value: characterCount, hint: "Verfügbare Figuren" },
  ];

  const summaryActions = (
    <>
      <Button asChild size="sm" variant="outline">
        <Link href="/mitglieder/produktionen/besetzung">Rollen &amp; Besetzungen</Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/mitglieder/produktionen/gewerke">Gewerke &amp; Teams</Link>
      </Button>
    </>
  );

  return (
    <div className="space-y-10">
      <ProductionWorkspaceHeader
        title="Szenen &amp; Breakdowns"
        description="Plane Szenenabläufe, pflege Orte und Zeiten und behalte Aufgaben je Gewerk inklusive Status und Zuständigkeit im Blick."
        activeWorkspace="scenes"
        production={activeProduction}
        stats={headerStats}
        actions={headerActions}
        summaryActions={summaryActions}
      />

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg font-semibold">Neue Szene anlegen</CardTitle>
          <p className="text-sm text-muted-foreground">Erfasse Orte, Tageszeiten, Reihenfolgen und Notizen, um den Szenenplan aktuell zu halten.</p>
        </CardHeader>
        <CardContent>
          <form action={createSceneAction} method="post" className="grid gap-6">
            <input type="hidden" name="showId" value={show.id} />
            <input type="hidden" name="redirectPath" value={currentPath} />
            <fieldset className="grid gap-3 rounded-lg border border-border/60 bg-background/70 p-4 md:grid-cols-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Basisdaten
              </legend>
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
            </fieldset>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Reihenfolge</label>
                <Input type="number" name="sequence" min={0} max={9999} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Dauer (Minuten)</label>
                <Input type="number" name="duration" min={0} max={600} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Zusammenfassung</label>
              <Textarea name="summary" rows={2} maxLength={600} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notizen</label>
              <Textarea name="notes" rows={2} maxLength={400} />
            </div>
            <div>
              <Button type="submit">Szene speichern</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-6">
        {show.scenes.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">Noch keine Szenen erfasst. Lege eine Szene über das Formular oben an.</p>
            </CardContent>
          </Card>
        ) : (
          show.scenes.map((scene) => {
            const assignedCharacterIds = new Set(scene.characters.map((entry) => entry.character.id));
            const availableCharacters = show.characters.filter((character) => !assignedCharacterIds.has(character.id));

            return (
              <Card key={scene.id} className="space-y-5">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="uppercase tracking-wide">Szene {scene.identifier ?? "?"}</span>
                        <span>#{scene.sequence ?? 0}</span>
                      </div>
                      <CardTitle className="text-xl font-semibold">{scene.title ?? "(ohne Titel)"}</CardTitle>
                      {scene.summary ? (
                        <p className="text-sm text-muted-foreground">{scene.summary}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {scene.location ? <span>Ort: {scene.location}</span> : null}
                        {scene.timeOfDay ? <span>Tageszeit: {scene.timeOfDay}</span> : null}
                        {scene.durationMinutes ? <span>Dauer: {scene.durationMinutes} min</span> : null}
                      </div>
                    </div>
                    <form action={deleteSceneAction} method="post">
                      <input type="hidden" name="sceneId" value={scene.id} />
                      <input type="hidden" name="redirectPath" value={currentPath} />
                      <Button type="submit" variant="ghost" size="sm">
                        Entfernen
                      </Button>
                    </form>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <details className="group rounded-lg border border-border/60 bg-background/70 p-4 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                      <span>Szene bearbeiten</span>
                      <span className="text-xs text-muted-foreground group-open:hidden">Öffnen</span>
                      <span className="hidden text-xs text-muted-foreground group-open:inline">Schließen</span>
                    </summary>
                    <form
                      action={updateSceneAction}
                      method="post"
                      className="mt-4 grid gap-3 rounded-md border border-border/50 bg-background/80 p-4 md:grid-cols-3"
                    >
                      <input type="hidden" name="sceneId" value={scene.id} />
                      <input type="hidden" name="redirectPath" value={currentPath} />
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
                        <Input type="number" name="sequence" defaultValue={scene.sequence ?? 0} min={0} max={9999} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dauer (Minuten)</label>
                        <Input type="number" name="duration" defaultValue={scene.durationMinutes ?? 0} min={0} max={600} />
                      </div>
                      <div className="space-y-1 md:col-span-3">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Zusammenfassung</label>
                        <Textarea name="summary" rows={2} maxLength={600} defaultValue={scene.summary ?? ""} />
                      </div>
                      <div className="space-y-1 md:col-span-3">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notizen</label>
                        <Textarea name="notes" rows={2} maxLength={400} defaultValue={scene.notes ?? ""} />
                      </div>
                      <div className="md:col-span-3 flex justify-end">
                        <Button type="submit" variant="outline" size="sm">
                          Szene aktualisieren
                        </Button>
                      </div>
                    </form>
                  </details>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                      <h3 className="text-sm font-semibold">Mitwirkende Figuren</h3>
                      <div className="mt-3 space-y-2">
                        {scene.characters.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Noch keine Figuren zugeordnet.</p>
                        ) : (
                          scene.characters.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 bg-background/80 p-3 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-3 w-3 rounded-full border border-border/80"
                                  style={{ backgroundColor: entry.character.color ?? "#7c3aed" }}
                                />
                                <div>
                                  <p className="font-medium">{entry.character.name}</p>
                                  {entry.character.shortName ? (
                                    <p className="text-xs text-muted-foreground">{entry.character.shortName}</p>
                                  ) : null}
                                  {entry.isFeatured ? (
                                    <p className="text-xs text-muted-foreground">Hervorgehoben</p>
                                  ) : null}
                                </div>
                              </div>
                              <form action={removeSceneCharacterAction} method="post">
                                <input type="hidden" name="assignmentId" value={entry.id} />
                                <input type="hidden" name="redirectPath" value={currentPath} />
                                <Button type="submit" variant="ghost" size="sm">
                                  Entfernen
                                </Button>
                              </form>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-4 rounded-md border border-dashed border-border/60 bg-background/50 p-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Figur hinzufügen</h4>
                        <form className="mt-3 grid gap-3 md:grid-cols-3" action={addSceneCharacterAction} method="post">
                          <input type="hidden" name="sceneId" value={scene.id} />
                          <input type="hidden" name="redirectPath" value={currentPath} />
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-medium text-muted-foreground">Figur</label>
                            <select name="characterId" className={selectClassName} required>
                              <option value="">Figur auswählen</option>
                              {availableCharacters.map((character) => (
                                <option key={character.id} value={character.id}>
                                  {character.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Hervorgehoben?</label>
                            <select name="isFeatured" className={selectClassName} defaultValue="false">
                              <option value="false">Standard</option>
                              <option value="true">Hervorgehoben</option>
                            </select>
                          </div>
                          <div className="md:col-span-3 flex justify-end">
                            <Button type="submit" size="sm">
                              Figur zuordnen
                            </Button>
                          </div>
                        </form>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Breakdown-Aufgaben</h3>
                      <div className="space-y-3">
                        {scene.breakdownItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Noch keine Aufgaben hinterlegt.</p>
                        ) : (
                          scene.breakdownItems.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm shadow-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="font-semibold">{item.title}</p>
                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <span>{STATUS_LABELS[item.status]}</span>
                                    {item.department ? <span>{item.department.name}</span> : null}
                                    {item.assignedTo ? (
                                      <span>Zuständig: {formatUserName(item.assignedTo)}</span>
                                    ) : null}
                                    {item.neededBy ? (
                                      <span>Fällig: {item.neededBy.toISOString().slice(0, 10)}</span>
                                    ) : null}
                                  </div>
                                  {item.description ? (
                                    <p className="text-xs text-muted-foreground">{item.description}</p>
                                  ) : null}
                                  {item.note ? (
                                    <p className="text-xs text-muted-foreground">Notiz: {item.note}</p>
                                  ) : null}
                                </div>
                                <form action={removeBreakdownItemAction} method="post">
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <input type="hidden" name="redirectPath" value={currentPath} />
                                  <Button type="submit" variant="ghost" size="sm">
                                    Entfernen
                                  </Button>
                                </form>
                              </div>

                              <details className="group mt-3 rounded-md border border-border/50 bg-background/70 p-3 [&_summary::-webkit-details-marker]:hidden">
                                <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  <span>Aufgabe aktualisieren</span>
                                  <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
                                  <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
                                </summary>
                                <form
                                  action={updateBreakdownItemAction}
                                  method="post"
                                  className="mt-3 grid gap-2 md:grid-cols-4"
                                >
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <input type="hidden" name="redirectPath" value={currentPath} />
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gewerk</label>
                                    <select name="departmentId" defaultValue={item.department?.id ?? ""} className={selectSmallClassName}>
                                      <option value="">Gewerk wählen</option>
                                      {departments.map((departmentOption) => (
                                        <option key={departmentOption.id} value={departmentOption.id}>
                                          {departmentOption.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</label>
                                    <select name="status" defaultValue={item.status} className={selectSmallClassName}>
                                      {statusOptions.map((status) => (
                                        <option key={status} value={status}>
                                          {STATUS_LABELS[status]}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Benötigt bis</label>
                                    <Input type="date" name="neededBy" defaultValue={item.neededBy ? item.neededBy.toISOString().slice(0, 10) : ""} />
                                  </div>
                                  <div className="space-y-1 md:col-span-4">
                                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beschreibung</label>
                                    <Textarea name="description" rows={2} maxLength={600} defaultValue={item.description ?? ""} />
                                  </div>
                                  <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notiz</label>
                                    <Input name="note" defaultValue={item.note ?? ""} maxLength={300} />
                                  </div>
                                  <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Zuständig</label>
                                    <select name="assignedToId" defaultValue={item.assignedToId ?? ""} className={selectSmallClassName}>
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
                          Breakdown-Eintrag hinzufügen
                        </h4>
                        <form className="mt-3 grid gap-2 md:grid-cols-4" action={createBreakdownItemAction} method="post">
                          <input type="hidden" name="sceneId" value={scene.id} />
                          <input type="hidden" name="redirectPath" value={currentPath} />
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
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
