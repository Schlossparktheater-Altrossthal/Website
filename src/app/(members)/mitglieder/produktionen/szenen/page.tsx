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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ClipboardList, Clapperboard, Pencil, Plus, Trash2, Users } from "lucide-react";
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

function truncateSummary(value: string, maxLength = 100) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export default async function ProduktionsSzenenPage() {
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
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { name: "asc" }, { email: "asc" }],
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
        Die aktuell ausgewählte Produktion konnte nicht gefunden werden. Bitte wähle sie erneut im Überblick aus.
      </div>
    );
  }

  const currentPath = "/mitglieder/produktionen/szenen";
  const statusOptions = Object.values(BreakdownStatus);
  const sceneCount = show.scenes.length;
  const breakdownCount = show.scenes.reduce((acc, scene) => acc + scene.breakdownItems.length, 0);
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
      icon: <ClipboardList className="h-4 w-4" aria-hidden />,
    },
    {
      label: "Rollen",
      value: characterCount,
      icon: <Users className="h-4 w-4" aria-hidden />,
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold leading-tight text-foreground">{stat.value}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-card/80 text-muted-foreground">
                  {stat.icon}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline" aria-label="Szene anlegen">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Neue Szene anlegen</DialogTitle>
                  <DialogDescription>
                    Erfasse Orte, Zusammenfassungen und Notizen, um den Szenenplan aktuell zu halten.
                  </DialogDescription>
                </DialogHeader>
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
                  </fieldset>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Zusammenfassung</label>
                    <Textarea name="summary" rows={2} maxLength={600} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Notizen</label>
                    <Textarea name="notes" rows={2} maxLength={400} />
                  </div>
                  <DialogFooter className="pt-2 sm:justify-end">
                    <Button type="submit">Szene speichern</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <section className="space-y-6">
        {show.scenes.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Noch keine Szenen erfasst. Nutze das Plus, um den Ablaufplan zu starten.
              </p>
            </CardContent>
          </Card>
        ) : (
          show.scenes.map((scene) => {
            const assignedCharacterIds = new Set(scene.characters.map((entry) => entry.character.id));
            const availableCharacters = show.characters.filter((character) => !assignedCharacterIds.has(character.id));

            return (
              <Card key={scene.id} className="space-y-5">
                <CardHeader className="relative space-y-3">
                  <div className="space-y-1 pr-16">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="uppercase tracking-wide">Szene {scene.identifier ?? "?"}</span>
                    </div>
                    <CardTitle className="text-xl font-semibold">{scene.title ?? "(ohne Titel)"}</CardTitle>
                    {scene.summary ? (
                      <p className="text-sm text-muted-foreground">{truncateSummary(scene.summary)}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {scene.location ? <span>Ort: {scene.location}</span> : null}
                      {scene.timeOfDay ? <span>Tageszeit: {scene.timeOfDay}</span> : null}
                      {scene.durationMinutes ? <span>Dauer: {scene.durationMinutes} min</span> : null}
                    </div>
                  </div>
                  <div className="absolute right-4 top-4 flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label="Szene erweitern">
                          <Plus className="h-4 w-4" aria-hidden />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56 p-2">
                        <div className="grid gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="w-full justify-start">
                                Mitwirkende Figur hinzufügen
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Figur hinzufügen</DialogTitle>
                                <DialogDescription>Ordne eine Figur dieser Szene zu.</DialogDescription>
                              </DialogHeader>
                              <form className="grid gap-3 md:grid-cols-3" action={addSceneCharacterAction} method="post">
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
                            </DialogContent>
                          </Dialog>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="w-full justify-start">
                                Breakdown hinzufügen
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Breakdown-Eintrag hinzufügen</DialogTitle>
                                <DialogDescription>Lege Aufgaben für die Szene an und weise sie zu.</DialogDescription>
                              </DialogHeader>
                              <form className="grid gap-2 md:grid-cols-4" action={createBreakdownItemAction} method="post">
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
                            </DialogContent>
                          </Dialog>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label="Szene bearbeiten">
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl">
                        <DialogHeader>
                          <DialogTitle>Szene bearbeiten</DialogTitle>
                          <DialogDescription>Aktualisiere Titel, Orte und Notizen der Szene.</DialogDescription>
                        </DialogHeader>
                        <form
                          action={updateSceneAction}
                          method="post"
                          className="grid gap-3 rounded-md border border-border/50 bg-background/80 p-4 md:grid-cols-3"
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
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" aria-label="Szene entfernen">
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Szene löschen</DialogTitle>
                          <DialogDescription>
                            Bist du sicher, dass du diese Szene löschen möchtest? Die zugehörigen Einträge gehen verloren.
                          </DialogDescription>
                        </DialogHeader>
                        <form action={deleteSceneAction} method="post" className="flex justify-end gap-2">
                          <input type="hidden" name="sceneId" value={scene.id} />
                          <input type="hidden" name="redirectPath" value={currentPath} />
                          <DialogClose asChild>
                            <Button type="button" variant="outline">
                              Abbrechen
                            </Button>
                          </DialogClose>
                          <Button type="submit" variant="destructive">
                            Szene löschen
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                      <details className="group [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-foreground">
                          <span>Mitwirkende Figuren</span>
                          <ChevronDown className="h-4 w-4 transition duration-200 group-open:rotate-180" aria-hidden />
                        </summary>
                        <div className="mt-3 space-y-2">
                          {scene.characters.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Noch keine Figuren zugeordnet.</p>
                          ) : (
                            scene.characters.map((entry) => (
                              <div
                                key={entry.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 bg-background/80 p-3 text-sm"
                                style={{
                                  borderColor: entry.character.color ?? undefined,
                                  backgroundColor: entry.character.color ? `${entry.character.color}1A` : undefined,
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block h-3 w-3 rounded-full border border-border/80"
                                    style={{ backgroundColor: entry.character.color ?? undefined }}
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
                      </details>
                    </div>

                    <div className="space-y-3">
                      <details className="group rounded-lg border border-border/60 bg-background/70 p-4 [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-foreground">
                          <span>Breakdown-Aufgaben</span>
                          <ChevronDown className="h-4 w-4 transition duration-200 group-open:rotate-180" aria-hidden />
                        </summary>
                        <div className="mt-3 space-y-3">
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
                                      <Input
                                        type="date"
                                        name="neededBy"
                                        defaultValue={item.neededBy ? item.neededBy.toISOString().slice(0, 10) : ""}
                                      />
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
                      </details>
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
