"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CheckIcon, DownloadIcon, SearchIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { downloadPdf } from "@/lib/pdf/download";
import type { WunschlistePdfData } from "@/lib/pdf/templates/wunschliste";
import { cn } from "@/lib/utils";
import { WISH_LEVELS, wishLevelLabel, type WishLevel } from "@/lib/wishes/levels";
import type {
  WishlistArea,
  WishlistData,
  WishlistPerson,
  WishlistWish,
} from "@/lib/wishes/wishlist";

import { saveWishNoteAction, setWishAction } from "../actions/wishes";

type Mode = "areas" | "people";
type Filter = "all" | "unassigned";

const FOCUS_LABELS = { acting: "Spiel", tech: "Technik", both: "Spiel & Technik" } as const;

type Props = {
  data: WishlistData;
  manageAll: boolean;
  leadDepartmentIds: string[];
};

function isUnassigned(person: WishlistPerson) {
  return person.departments.length === 0 && person.roles.length === 0;
}

function wishOf(person: WishlistPerson, area: WishlistArea) {
  return person.wishes.find((wish) => wish.areaCode === area.code) ?? null;
}

function countLine(wishes: WishlistWish[]) {
  return WISH_LEVELS.map((entry) => {
    const count = wishes.filter((wish) => wish.level === entry.level).length;
    return count ? `${count} ${entry.label.toLowerCase()}` : null;
  })
    .filter(Boolean)
    .join(" · ");
}

function assignmentText(person: WishlistPerson) {
  return [...person.roles, ...person.departments].join(", ") || null;
}

export function WishlistView({ data, manageAll, leadDepartmentIds }: Props) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("areas");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [personId, setPersonId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const canEdit = React.useCallback(
    (area: WishlistArea) =>
      manageAll ||
      (area.domain === "crew" && area.departmentIds.some((id) => leadDepartmentIds.includes(id))),
    [manageAll, leadDepartmentIds],
  );

  const unassignedCount = data.people.filter(isUnassigned).length;
  const withWishes = data.people.filter((person) => person.wishes.length > 0).length;
  const people = data.people.filter((person) => {
    if (filter === "unassigned" && !isUnassigned(person)) return false;
    const needle = query.trim().toLowerCase();
    return !needle || person.name.toLowerCase().includes(needle);
  });
  const selected = data.people.find((person) => person.id === personId) ?? null;
  const missed = data.people.filter((person) => data.fulfillment.missedIds.includes(person.id));

  const exportPdf = async (layout: WunschlistePdfData["layout"]) => {
    setExporting(true);
    try {
      const payload: WunschlistePdfData = {
        generatedAt: new Date().toISOString(),
        production: data.showTitle,
        layout,
        areas: data.areas.map((area) => ({
          title: area.title,
          shortTitle: area.shortTitle,
          domain: area.domain,
        })),
        people: people.map((person) => ({
          name: person.name,
          tag: person.isReturning ? null : person.onboardingDone ? "neu" : null,
          assignment: assignmentText(person),
          wishes: data.areas.map((area) => {
            const wish = wishOf(person, area);
            return wish
              ? { level: wish.level, assigned: wish.assigned, entered: Boolean(wish.enteredBy) }
              : null;
          }),
        })),
      };
      await downloadPdf("wunschliste", payload, "wunschliste.pdf");
    } catch (error) {
      toast.error("PDF konnte nicht erstellt werden", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SegmentedControl
          aria-label="Gruppierung"
          size="md"
          fullWidth
          className="sm:w-auto"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "areas", label: "Nach Bereich" },
            { value: "people", label: "Nach Person" },
          ]}
        />
        <SegmentedControl
          aria-label="Filter"
          size="md"
          fullWidth
          className="sm:w-auto"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: `Alle ${data.people.length}` },
            { value: "unassigned", label: `Ohne Zuteilung ${unassignedCount}` },
          ]}
        />
        <div className="flex flex-1 items-center gap-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Person suchen</span>
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Person suchen"
              className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            />
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0"
                disabled={exporting}
              >
                <DownloadIcon className="h-4 w-4" aria-hidden />
                PDF
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => void exportPdf("list")}>
                Liste je Bereich
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportPdf("matrix")}>
                Matrix Person × Bereich
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
        <p>
          <span className="font-medium">{withWishes}</span> von {data.people.length} Personen haben
          Wünsche angegeben
          {data.fulfillment.assigned > 0 ? (
            <>
              {" · "}
              <span className="font-medium">{data.fulfillment.fulfilled}</span> von{" "}
              {data.fulfillment.assigned} Zugeteilten haben einen Top-Wunsch bekommen
            </>
          ) : null}
        </p>
        {missed.length ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Ohne Top-Wunsch:{" "}
            {missed.map((person, index) => (
              <React.Fragment key={person.id}>
                {index > 0 ? ", " : ""}
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => setPersonId(person.id)}
                >
                  {person.name}
                </button>
              </React.Fragment>
            ))}
          </p>
        ) : null}
      </div>

      {mode === "areas" ? (
        <AreasView areas={data.areas} people={people} onOpen={setPersonId} />
      ) : (
        <PeopleView areas={data.areas} people={people} onOpen={setPersonId} />
      )}

      <BottomSheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setPersonId(null)}
        title={selected?.name ?? ""}
        description="Wünsche ansehen und nachtragen"
      >
        {selected ? (
          <PersonWishPanel
            key={selected.id}
            showId={data.showId}
            person={selected}
            areas={data.areas}
            canEdit={canEdit}
            onSaved={() => router.refresh()}
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}

function AreasView({
  areas,
  people,
  onOpen,
}: {
  areas: WishlistArea[];
  people: WishlistPerson[];
  onOpen: (id: string) => void;
}) {
  if (!people.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Keine Person passt.</p>;
  }
  return (
    <div className="space-y-6">
      {(["acting", "crew"] as const).map((domain) => {
        const groupAreas = areas.filter((area) => area.domain === domain);
        const empty = groupAreas.filter((area) => !people.some((person) => wishOf(person, area)));
        return (
          <section
            key={domain}
            className="space-y-3"
            aria-label={domain === "acting" ? "Schauspiel" : "Gewerke"}
          >
            <h2 className="text-sm font-semibold text-muted-foreground">
              {domain === "acting" ? "Schauspiel" : "Gewerke"}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groupAreas
                .filter((area) => !empty.includes(area))
                .map((area) => {
                  const entries = people
                    .map((person) => ({ person, wish: wishOf(person, area) }))
                    .filter((entry): entry is { person: WishlistPerson; wish: WishlistWish } =>
                      Boolean(entry.wish),
                    );
                  return (
                    <article
                      key={area.code}
                      className="min-w-0 rounded-lg border border-border bg-card p-3"
                    >
                      <header className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                          {area.color ? (
                            <span
                              aria-hidden
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: area.color }}
                            />
                          ) : null}
                          <span className="truncate">{area.title}</span>
                        </h3>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {entries.length}
                        </span>
                      </header>
                      <p className="mb-2 text-xs text-muted-foreground">
                        {countLine(entries.map((entry) => entry.wish))}
                      </p>
                      <div className="space-y-2">
                        {WISH_LEVELS.map(({ level, label }) => {
                          const atLevel = entries
                            .filter((entry) => entry.wish.level === level)
                            .sort((a, b) => b.wish.weight - a.wish.weight);
                          if (!atLevel.length) return null;
                          return (
                            <div key={level}>
                              <p className="text-[11px] font-medium uppercase text-muted-foreground">
                                {label}
                              </p>
                              <ul className="mt-1 flex flex-wrap gap-1.5">
                                {atLevel.map(({ person, wish }) => (
                                  <li key={person.id}>
                                    <PersonChip person={person} wish={wish} onOpen={onOpen} />
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
            </div>
            {empty.length ? (
              <p className="text-xs text-muted-foreground">
                Ohne Wünsche: {empty.map((area) => area.title).join(", ")}
              </p>
            ) : null}
          </section>
        );
      })}
      <NoWishes people={people} onOpen={onOpen} />
    </div>
  );
}

function NoWishes({ people, onOpen }: { people: WishlistPerson[]; onOpen: (id: string) => void }) {
  const without = people.filter((person) => person.wishes.length === 0);
  if (!without.length) return null;
  return (
    <section className="space-y-2" aria-label="Ohne Wünsche">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Ohne Wünsche ({without.length})
      </h2>
      <ul className="flex flex-wrap gap-1.5">
        {without.map((person) => (
          <li key={person.id}>
            <PersonChip person={person} wish={null} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PersonChip({
  person,
  wish,
  onOpen,
}: {
  person: WishlistPerson;
  wish: WishlistWish | null;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(person.id)}
      title={wish?.enteredBy ? `Nachgetragen von ${wish.enteredBy}` : undefined}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        wish?.assigned ? "border-success/40 bg-success/10" : "border-border bg-background",
        wish?.enteredBy && "border-dashed",
      )}
    >
      <UserAvatar
        userId={person.id}
        name={person.name}
        email={person.email}
        avatarSource={person.avatarSource}
        avatarUpdatedAt={person.avatarUpdatedAt}
        size={22}
      />
      <span className="max-w-[10rem] truncate">{person.name}</span>
      {wish?.assigned ? (
        <CheckIcon className="h-3 w-3 text-success" aria-label="zugeteilt" />
      ) : null}
    </button>
  );
}

function PeopleView({
  areas,
  people,
  onOpen,
}: {
  areas: WishlistArea[];
  people: WishlistPerson[];
  onOpen: (id: string) => void;
}) {
  if (!people.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Keine Person passt.</p>;
  }
  const areaByCode = new Map(areas.map((area) => [area.code, area]));
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {people.map((person) => (
        <li key={person.id}>
          <button
            type="button"
            onClick={() => onOpen(person.id)}
            className="flex min-h-14 w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <UserAvatar
              userId={person.id}
              name={person.name}
              email={person.email}
              avatarSource={person.avatarSource}
              avatarUpdatedAt={person.avatarUpdatedAt}
              size={36}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-sm font-medium">{person.name}</span>
                {person.focus ? (
                  <Badge variant="outline" size="sm">
                    {FOCUS_LABELS[person.focus]}
                  </Badge>
                ) : null}
                {person.onboardingDone && !person.isReturning ? (
                  <Badge variant="outline" size="sm">
                    neu
                  </Badge>
                ) : null}
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {assignmentText(person) ?? "Nicht zugeteilt"}
                </span>
              </span>
              <span className="mt-1.5 flex flex-wrap gap-1.5">
                {person.wishes.map((wish) => {
                  const area = areaByCode.get(wish.areaCode);
                  if (!area) return null;
                  return (
                    <span
                      key={wish.areaCode}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                        wish.assigned
                          ? "border-success/40 bg-success/10 text-success"
                          : wish.level >= 3
                            ? "border-primary/40 bg-primary/5 text-foreground"
                            : "border-border text-muted-foreground",
                        wish.enteredBy && "border-dashed",
                      )}
                    >
                      {area.domain === "acting" ? `Rolle ${area.shortTitle}` : area.title}
                      <span className="text-muted-foreground">· {wishLevelLabel(wish.level)}</span>
                      {wish.assigned ? (
                        <CheckIcon className="h-3 w-3" aria-label="zugeteilt" />
                      ) : null}
                    </span>
                  );
                })}
                {person.wishes.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {person.onboardingDone ? "Keine Wünsche angegeben" : "Onboarding noch offen"}
                  </span>
                ) : null}
              </span>
              {person.interests.length ? (
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  Interessen: {person.interests.join(", ")}
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PersonWishPanel({
  showId,
  person,
  areas,
  canEdit,
  onSaved,
}: {
  showId: string;
  person: WishlistPerson;
  areas: WishlistArea[];
  canEdit: (area: WishlistArea) => boolean;
  onSaved: () => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState(person.note?.text ?? "");
  const anyEditable = areas.some(canEdit);

  const run = async (
    key: string,
    action: () => Promise<{ ok: boolean; error?: string; message?: string }>,
  ) => {
    setBusy(key);
    const result = await action();
    setBusy(null);
    if (!result.ok) {
      toast.error("Speichern fehlgeschlagen", { description: result.error });
      return;
    }
    toast.success(result.message ?? "Gespeichert");
    onSaved();
  };

  const setLevel = (area: WishlistArea, level: WishLevel | null) =>
    run(area.code, () =>
      setWishAction({
        showId,
        userId: person.id,
        code: area.code,
        weight: level ? (WISH_LEVELS.find((entry) => entry.level === level)?.weight ?? 40) : null,
      }),
    );

  return (
    <div className="space-y-5">
      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Zugeteilt:</dt>
          <dd className="min-w-0 break-words">{assignmentText(person) ?? "noch nichts"}</dd>
        </div>
        {person.interests.length ? (
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Interessen:</dt>
            <dd className="min-w-0 break-words">{person.interests.join(", ")}</dd>
          </div>
        ) : null}
      </dl>
      {person.onboardingNote ? (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
          <span className="font-medium">Hinweis aus dem Onboarding: </span>
          {person.onboardingNote}
        </p>
      ) : null}

      {(["acting", "crew"] as const).map((domain) => (
        <section key={domain} className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {domain === "acting" ? "Schauspiel" : "Gewerke"}
          </h3>
          <ul className="space-y-2">
            {areas
              .filter((area) => area.domain === domain)
              .map((area) => {
                const wish = wishOf(person, area);
                const selfEntered = Boolean(wish && !wish.enteredBy);
                const editable = canEdit(area) && !selfEntered;
                return (
                  <li key={area.code} className="rounded-md border border-border px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{area.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {wish
                          ? `${wishLevelLabel(wish.level)}${wish.assigned ? " · zugeteilt" : ""}`
                          : "kein Wunsch"}
                      </span>
                    </div>
                    {wish?.enteredBy ? (
                      <p className="text-xs text-muted-foreground">
                        Nachgetragen von {wish.enteredBy}
                      </p>
                    ) : selfEntered ? (
                      <p className="text-xs text-muted-foreground">Selbst angegeben</p>
                    ) : null}
                    {editable ? (
                      <div
                        className="mt-2 flex flex-wrap gap-1.5"
                        role="group"
                        aria-label={`Stufe für ${area.title}`}
                      >
                        {[...WISH_LEVELS].reverse().map((entry) => (
                          <Button
                            key={entry.level}
                            type="button"
                            size="xs"
                            variant={wish?.level === entry.level ? "primary" : "outline"}
                            disabled={busy !== null}
                            aria-pressed={wish?.level === entry.level}
                            onClick={() => setLevel(area, entry.level)}
                          >
                            {entry.label}
                          </Button>
                        ))}
                        {wish ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            disabled={busy !== null}
                            onClick={() => setLevel(area, null)}
                          >
                            Entfernen
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      {anyEditable ? (
        <section className="space-y-2">
          <label
            htmlFor={`wish-note-${person.id}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Interne Notiz (für {person.name} nicht sichtbar)
          </label>
          <Textarea
            id={`wish-note-${person.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="z. B. im Gespräch: lieber eine kleinere Rolle"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {person.note?.by ? `Zuletzt von ${person.note.by}` : ""}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null || note.trim() === (person.note?.text ?? "")}
              onClick={() =>
                run("note", () => saveWishNoteAction({ showId, userId: person.id, text: note }))
              }
            >
              Notiz speichern
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
