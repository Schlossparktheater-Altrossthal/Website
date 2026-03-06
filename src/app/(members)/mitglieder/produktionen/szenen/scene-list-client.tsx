"use client";

import { useMemo, useState } from "react";
import { BreakdownStatus } from "@prisma/client";
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, FilterX, LayoutGrid, List, Pencil, Plus, Trash2 } from "lucide-react";

import { getUserDisplayName } from "@/lib/names";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

import {
  addSceneCharacterAction,
  createBreakdownItemAction,
  deleteSceneAction,
  removeBreakdownItemAction,
  removeSceneCharacterAction,
  updateBreakdownItemAction,
  updateSceneAction,
} from "../actions";

type DisplayUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name: string | null;
  email: string | null;
};

type SceneCharacter = {
  id: string;
  isFeatured: boolean;
  character: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
  };
};

type SceneBreakdownItem = {
  id: string;
  title: string;
  description: string | null;
  note: string | null;
  status: BreakdownStatus;
  neededBy: string | null;
  department: { id: string; name: string; slug: string; color: string | null } | null;
  assignedToId: string | null;
  assignedTo: DisplayUser | null;
};

type SceneData = {
  id: string;
  identifier: string | null;
  title: string | null;
  summary: string | null;
  location: string | null;
  notes: string | null;
  characters: SceneCharacter[];
  breakdownItems: SceneBreakdownItem[];
};

type Department = { id: string; name: string; slug: string; color: string | null };

type Character = { id: string; name: string; shortName: string | null; color: string | null };

type Props = {
  scenes: SceneData[];
  characters: Character[];
  departments: Department[];
  users: DisplayUser[];
  currentPath: string;
  statusOptions: BreakdownStatus[];
};

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

function formatIsoDate(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

type SceneFilter = "all" | "with-roles" | "without-roles" | "with-breakdowns" | "without-breakdowns";
type SceneSort = "asc" | "desc";

function parseSceneIdentifier(value: string | null): number[] {
  if (!value) return [Number.POSITIVE_INFINITY];
  return value
    .split(".")
    .map((segment) => Number.parseInt(segment, 10))
    .filter((segment) => !Number.isNaN(segment));
}

function compareSceneIdentifiers(a: string | null, b: string | null): number {
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

export function SceneListClient({
  scenes,
  characters,
  departments,
  users,
  currentPath,
  statusOptions,
}: Props) {
  const [viewMode, setViewMode] = useState<"list" | "tiles">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [sceneFilter, setSceneFilter] = useState<SceneFilter>("all");
  const [sceneSort, setSceneSort] = useState<SceneSort>("asc");
  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.name.localeCompare(b.name, "de")),
    [characters],
  );
  const filteredScenes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const matchesSearch = (scene: SceneData) => {
      if (!normalizedSearch) return true;
      return [
        scene.identifier,
        scene.title,
        scene.summary,
        scene.location,
        scene.notes,
        ...scene.characters.map((entry) => entry.character.name),
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
    };

    const matchesFilter = (scene: SceneData) => {
      switch (sceneFilter) {
        case "with-roles":
          return scene.characters.length > 0;
        case "without-roles":
          return scene.characters.length === 0;
        case "with-breakdowns":
          return scene.breakdownItems.length > 0;
        case "without-breakdowns":
          return scene.breakdownItems.length === 0;
        default:
          return true;
      }
    };

    const results = scenes.filter((scene) => matchesSearch(scene) && matchesFilter(scene));
    results.sort((a, b) => compareSceneIdentifiers(a.identifier, b.identifier));
    if (sceneSort === "desc") {
      results.reverse();
    }
    return results;
  }, [sceneFilter, sceneSort, scenes, searchTerm]);

  const hasFilters = searchTerm.trim().length > 0 || sceneFilter !== "all" || sceneSort !== "asc";

  const clearFilters = () => {
    setSearchTerm("");
    setSceneFilter("all");
    setSceneSort("asc");
  };

  const listClassName = viewMode === "tiles" ? "grid gap-6 lg:grid-cols-2" : "space-y-6";
  const detailLayoutClassName = viewMode === "tiles" ? "grid gap-4" : "grid gap-4 lg:grid-cols-2";

  return (
    <>
      <div className="rounded-2xl border border-border/70 bg-card/60 p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_auto] lg:items-end">
          <div className="space-y-1">
            <label className="sr-only" htmlFor="scene-search">
              Suche
            </label>
            <Input
              id="scene-search"
              placeholder="Szenen oder Orte suchen"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="sr-only" htmlFor="scene-filter">
              Filter
            </label>
            <select
              id="scene-filter"
              className={selectSmallClassName}
              value={sceneFilter}
              onChange={(event) => setSceneFilter(event.target.value as SceneFilter)}
            >
              <option value="all">Alle Szenen</option>
              <option value="with-roles">Mit Figuren</option>
              <option value="without-roles">Ohne Figuren</option>
              <option value="with-breakdowns">Mit Breakdowns</option>
              <option value="without-breakdowns">Ohne Breakdowns</option>
            </select>
          </div>
          <div className="flex items-center gap-2 justify-self-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={sceneSort === "asc" ? "Nummern A bis Z sortieren" : "Nummern Z bis A sortieren"}
              onClick={() => setSceneSort((prev) => (prev === "asc" ? "desc" : "asc"))}
            >
              {sceneSort === "asc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
            </Button>
            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Filter und Suche entfernen"
                onClick={clearFilters}
              >
                <FilterX className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
            <Button
              type="button"
              variant={viewMode === "list" ? "secondary" : "outline"}
              size="icon"
              aria-label="Listenansicht"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "tiles" ? "secondary" : "outline"}
              size="icon"
              aria-label="Kachelansicht"
              onClick={() => setViewMode("tiles")}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <section className={listClassName}>
        {scenes.length === 0 ? (
          <Card className="lg:col-span-2">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Noch keine Szenen erfasst. Nutze das Plus, um den Ablaufplan zu starten.
              </p>
            </CardContent>
          </Card>
        ) : filteredScenes.length === 0 ? (
          <Card className="lg:col-span-2">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Keine Szenen erfüllen aktuell die ausgewählten Filter oder Suchbegriffe.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredScenes.map((scene) => {
            const assignedCharacterIds = new Set(scene.characters.map((entry) => entry.character.id));
            const availableCharacters = sortedCharacters.filter(
              (character) => !assignedCharacterIds.has(character.id),
            );
            const sortedSceneCharacters = [...scene.characters].sort((a, b) =>
              a.character.name.localeCompare(b.character.name, "de"),
            );

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
                              <form
                                className="grid gap-3 md:grid-cols-3"
                                action={addSceneCharacterAction}
                                method="post"
                              >
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
                                  <DialogClose asChild>
                                    <Button type="submit" size="sm">
                                      Figur zuordnen
                                    </Button>
                                  </DialogClose>
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
                              <form
                                className="grid gap-2 md:grid-cols-4"
                                action={createBreakdownItemAction}
                                method="post"
                              >
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
                                  <select
                                    name="status"
                                    className={selectSmallClassName}
                                    defaultValue={BreakdownStatus.planned}
                                  >
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
                                  <DialogClose asChild>
                                    <Button type="submit" size="sm">
                                      Breakdown speichern
                                    </Button>
                                  </DialogClose>
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
                            <Input name="identifier" defaultValue={scene.identifier ?? ""} maxLength={40} required />
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Titel</label>
                            <Input name="title" defaultValue={scene.title ?? ""} maxLength={160} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ort</label>
                            <Input name="location" defaultValue={scene.location ?? ""} maxLength={120} />
                          </div>
                          <div className="space-y-1 md:col-span-3">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Zusammenfassung
                            </label>
                            <Textarea name="summary" rows={2} maxLength={600} defaultValue={scene.summary ?? ""} />
                          </div>
                          <div className="space-y-1 md:col-span-3">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notizen</label>
                            <Textarea name="notes" rows={2} maxLength={400} defaultValue={scene.notes ?? ""} />
                          </div>
                          <div className="md:col-span-3 flex justify-end">
                            <DialogClose asChild>
                              <Button type="submit" variant="outline" size="sm">
                                Szene aktualisieren
                              </Button>
                            </DialogClose>
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
                          <DialogClose asChild>
                            <Button type="submit" variant="destructive">
                              Szene löschen
                            </Button>
                          </DialogClose>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className={detailLayoutClassName}>
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
                            sortedSceneCharacters.map((entry) => (
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
                                  <Button type="submit" variant="ghost" size="icon" aria-label="Rolle entfernen">
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
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
                                      {item.neededBy ? <span>Fällig: {formatIsoDate(item.neededBy)}</span> : null}
                                    </div>
                                    {item.description ? (
                                      <p className="text-xs text-muted-foreground">{item.description}</p>
                                    ) : null}
                                    {item.note ? <p className="text-xs text-muted-foreground">Notiz: {item.note}</p> : null}
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
                                      <select
                                        name="departmentId"
                                        defaultValue={item.department?.id ?? ""}
                                        className={selectSmallClassName}
                                      >
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
                                      <Input type="date" name="neededBy" defaultValue={formatIsoDate(item.neededBy)} />
                                    </div>
                                    <div className="space-y-1 md:col-span-4">
                                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Beschreibung</label>
                                      <Textarea
                                        name="description"
                                        rows={2}
                                        maxLength={600}
                                        defaultValue={item.description ?? ""}
                                      />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notiz</label>
                                      <Input name="note" defaultValue={item.note ?? ""} maxLength={300} />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Zuständig</label>
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
    </>
  );
}
