"use client";

import { useMemo, useState } from "react";
import { CharacterCastingType } from "@prisma/client";
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, Eye, FilterX, Pencil, Plus, Trash2, UserRoundCheck } from "lucide-react";

import { getRolePreferenceTitle } from "@/lib/onboarding/role-preferences";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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

import {
  assignCharacterCastingAction,
  deleteCharacterAction,
  removeCharacterCastingAction,
  updateCharacterAction,
} from "../actions";
import {
  CASTING_ORDER,
  ROLE_PREFERENCE_OPTIONS,
  type Character,
  type CharacterCasting,
  type DisplayUser,
  formatUserName,
  getCastingLabel,
  getCastingOrderIndex,
  resolveRoleSizeLabel,
  selectSmallClassName,
} from "./casting-utils";

type Props = {
  characters: Character[];
  users: DisplayUser[];
  currentPath: string;
};

type RoleSizeFilterValue = "all" | "none" | (typeof ROLE_PREFERENCE_OPTIONS)[number]["code"];

type SortDirection = "asc" | "desc";

function CastingAssignments({ castings, currentPath }: { castings: CharacterCasting[]; currentPath: string }) {
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

function AssignCastingDialog({ characterId, users, currentPath }: { characterId: string; users: DisplayUser[]; currentPath: string }) {
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
            <select name="type" className={selectSmallClassName} defaultValue={CharacterCastingType.primary}>
              {CASTING_ORDER.map((type) => (
                <option key={type} value={type}>
                  {getCastingLabel(type)}
                </option>
              ))}
            </select>
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

function UpdateCharacterDialog({ character, currentPath }: { character: Character; currentPath: string }) {
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

function CharacterDetailsDialog({ character }: { character: Character }) {
  if (!character.description) {
    return null;
  }

  const roleSizeLabel = resolveRoleSizeLabel(character.rolePreferenceCode);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Details anzeigen">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{character.name}</DialogTitle>
          <DialogDescription>Zusätzliche Details zur Rolle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs text-muted-foreground">
          {roleSizeLabel ? (
            <div className="space-y-1">
              <p className="font-semibold uppercase tracking-wide text-foreground/80">Rollengröße</p>
              <p>{roleSizeLabel}</p>
            </div>
          ) : null}
          <div className="space-y-1">
            <p className="font-semibold uppercase tracking-wide text-foreground/80">Beschreibung</p>
            <p>{character.description}</p>
          </div>
          {character.notes ? (
            <div className="space-y-1">
              <p className="font-semibold uppercase tracking-wide text-foreground/80">Notiz</p>
              <p>{character.notes}</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CharacterCard({ character, users, currentPath }: { character: Character; users: DisplayUser[]; currentPath: string }) {
  const hasCastings = character.castings.length > 0;
  const sortedCastings = [...character.castings].sort(
    (a, b) => getCastingOrderIndex(a.type) - getCastingOrderIndex(b.type),
  );
  const infoItems = [character.shortName, character.notes].filter((value): value is string => Boolean(value));

  return (
    <Card
      id={`role-${character.id}`}
      key={character.id}
      className={cn(
        "min-w-0 w-full overflow-hidden border border-border/70",
        !hasCastings && "border-destructive/60",
      )}
    >
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="mt-1 h-10 w-1.5 rounded-full"
              style={{ backgroundColor: character.color ?? "#8b5cf6" }}
              aria-hidden
            />
            <div className="min-w-0 space-y-2 pt-10">
              <CardTitle className="break-words text-lg font-semibold">{character.name}</CardTitle>
              {infoItems.length > 0 ? (
                <p className="text-xs text-muted-foreground">{infoItems.join(", ")}</p>
              ) : null}
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 grid-rows-2 gap-1">
            <div className="col-start-1 row-start-1">
              <AssignCastingDialog characterId={character.id} users={users} currentPath={currentPath} />
            </div>
            <div className="col-start-2 row-start-1">{character.description ? <CharacterDetailsDialog character={character} /> : null}</div>
            <div className="col-start-1 row-start-2">
              <UpdateCharacterDialog character={character} currentPath={currentPath} />
            </div>
            <div className="col-start-2 row-start-2">
              <form action={deleteCharacterAction} method="post">
                <input type="hidden" name="characterId" value={character.id} />
                <input type="hidden" name="redirectPath" value={currentPath} />
                <Button type="submit" variant="ghost" size="icon" className="h-9 w-9" aria-label="Rolle entfernen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {hasCastings ? null : (
            <span className="rounded-full bg-destructive/10 px-2 py-1 text-destructive">Nicht besetzt</span>
          )}
        </div>
        <details className="group rounded-lg border border-border/60 bg-muted/40">
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
            <CastingAssignments castings={sortedCastings} currentPath={currentPath} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export function CastingListClient({ characters, users, currentPath }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [castingType, setCastingType] = useState<"all" | CharacterCastingType>("all");
  const [roleSizeFilter, setRoleSizeFilter] = useState<RoleSizeFilterValue>("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filteredCharacters = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const matchesRoleSize = (character: Character) => {
      if (roleSizeFilter === "all") return true;
      if (roleSizeFilter === "none") return !character.rolePreferenceCode;
      return character.rolePreferenceCode === roleSizeFilter;
    };

    const matchesCastingType = (character: Character) =>
      castingType === "all" ? true : character.castings.some((casting) => casting.type === castingType);

    const matchesSearch = (character: Character) => {
      if (!normalizedSearch) return true;
      return [
        character.name,
        character.shortName,
        character.rolePreferenceCode ? getRolePreferenceTitle(character.rolePreferenceCode) : null,
        character.description,
        character.notes,
        ...character.castings.map((casting) => formatUserName(casting.user)),
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
    };

    return characters
      .filter((character) => matchesSearch(character) && matchesCastingType(character) && matchesRoleSize(character))
      .sort((a, b) => {
        const aHasRole = Boolean(a.rolePreferenceCode);
        const bHasRole = Boolean(b.rolePreferenceCode);

        if (aHasRole !== bHasRole) {
          return aHasRole ? -1 : 1;
        }

        const aLabel = a.rolePreferenceCode ? getRolePreferenceTitle(a.rolePreferenceCode) : "";
        const bLabel = b.rolePreferenceCode ? getRolePreferenceTitle(b.rolePreferenceCode) : "";

        const comparison = aLabel.localeCompare(bLabel, "de");
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [characters, castingType, roleSizeFilter, searchTerm, sortDirection]);

  const unassignedCharacters = filteredCharacters.filter((character) => character.castings.length === 0);
  const hasFilters =
    searchTerm.trim().length > 0 || castingType !== "all" || roleSizeFilter !== "all" || sortDirection !== "asc";

  const clearFilters = () => {
    setSearchTerm("");
    setCastingType("all");
    setRoleSizeFilter("all");
    setSortDirection("asc");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-card/60 p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-center">
          <div className="space-y-1">
            <label className="sr-only" htmlFor="casting-search">
              Suche
            </label>
            <Input
              id="casting-search"
              name="q"
              placeholder="Nach Rollen oder Personen suchen"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="sr-only" htmlFor="casting-type">
              Besetzungsart
            </label>
            <select
              id="casting-type"
              name="castingType"
              className={selectSmallClassName}
              value={castingType}
              onChange={(event) => setCastingType(event.target.value as "all" | CharacterCastingType)}
            >
              <option value="all">Alle Besetzungen</option>
              {CASTING_ORDER.map((type) => (
                <option key={type} value={type}>
                  {getCastingLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="sr-only" htmlFor="role-size">
              Rollengröße
            </label>
            <select
              id="role-size"
              name="roleSize"
              className={selectSmallClassName}
              value={roleSizeFilter}
              onChange={(event) => setRoleSizeFilter(event.target.value as RoleSizeFilterValue)}
            >
              <option value="all">Alle Rollengrößen</option>
              <option value="none">Keine Rollengröße</option>
              {ROLE_PREFERENCE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={sortDirection === "asc" ? "Rollengröße A bis Z sortieren" : "Rollengröße Z bis A sortieren"}
              onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
            >
              {sortDirection === "asc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
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
          </div>
        </div>
      </div>

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
        {characters.length === 0 ? (
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
              <CharacterCard key={character.id} character={character} users={users} currentPath={currentPath} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
