"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { suggestCategoriesAction } from "@/app/(members)/mitglieder/lager/actions/assets";
import { saveCategoryAction } from "@/app/(members)/mitglieder/lager/actions/catalog";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import type { CategoryNode } from "@/lib/inventory/specs";
import { categoryPath, MAX_CATEGORY_DEPTH } from "@/lib/inventory/specs";
import { cn } from "@/lib/utils";

export type PickerArea = {
  id: string;
  name: string;
  prefix: string;
  categories: readonly CategoryNode[];
};

export type CategoryChoice = { areaId: string; categoryId: string | null };

const RECENT_KEY = "lager.kategorien.zuletzt";
const RECENT_MAX = 6;

function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberRecent(id: string) {
  try {
    const next = [id, ...readRecent().filter((entry) => entry !== id)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Privater Modus o. Ä. – dann eben ohne „Zuletzt verwendet“.
  }
}

/** Langen Pfad in der Mitte kürzen: „Licht › … › PAR“. */
export function shortPath(names: string[]): string {
  return names.length > 3 ? [names[0], "…", ...names.slice(-2)].join(" › ") : names.join(" › ");
}

function normalize(text: string) {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type Entry = {
  id: string;
  areaId: string;
  name: string;
  names: string[];
  depth: number;
};

function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? normalize(text).indexOf(normalize(query)) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-primary/20 text-foreground">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

/**
 * Auswahl von Bereich und Kategorie in einem: Die Kategorie bestimmt den Bereich. Suche über
 * den ganzen Pfad, Durchklicken der Ebenen, zuletzt verwendet, Vorschlag aus dem Typnamen und –
 * mit Katalog-Recht – neue Kategorie direkt aus der Suche (docs/Plan/lager-kategorien-plan.md).
 */
export function CategoryPicker({
  areas,
  value,
  onChange,
  lockedAreaId,
  nameHint,
  canCreate = false,
  allowNone = true,
  noneLabel = "Ohne Kategorie",
  label = "Kategorie",
  triggerClassName,
}: {
  areas: readonly PickerArea[];
  value: CategoryChoice;
  onChange: (value: CategoryChoice) => void;
  /** Bereich steht fest (z. B. beim Bearbeiten – er bestimmt den Code). */
  lockedAreaId?: string | null;
  /** Typname für Vorschläge. */
  nameHint?: string;
  canCreate?: boolean;
  allowNone?: boolean;
  /** Text für „keine Kategorie“ – im Filter „Alle Kategorien“. */
  noneLabel?: string;
  label?: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [areaFilter, setAreaFilter] = React.useState<string | null>(null);
  const [parentId, setParentId] = React.useState<string | null>(null);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [suggested, setSuggested] = React.useState<string[]>([]);
  // Frisch angelegte Kategorien, bis der Server-Refresh sie mitbringt.
  const [created, setCreated] = React.useState<(CategoryNode & { areaId: string })[]>([]);
  const [creating, setCreating] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const allAreas = React.useMemo(
    () =>
      areas.map((area) => ({
        ...area,
        categories: [
          ...area.categories,
          ...created.filter(
            (entry) =>
              entry.areaId === area.id &&
              !area.categories.some((category) => category.id === entry.id),
          ),
        ],
      })),
    [areas, created],
  );
  const visibleAreas = allAreas.filter((area) => !lockedAreaId || area.id === lockedAreaId);
  const entries = React.useMemo<Entry[]>(
    () =>
      visibleAreas.flatMap((area) =>
        area.categories.map((category) => {
          const names = categoryPath(area.categories, category.id).map((entry) => entry.name);
          return {
            id: category.id,
            areaId: area.id,
            name: category.name,
            names,
            depth: names.length,
          };
        }),
      ),
    [visibleAreas],
  );
  const byId = React.useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const areaOf = (id: string) => allAreas.find((area) => area.id === id);
  const selected = value.categoryId ? byId.get(value.categoryId) : undefined;
  const selectedArea = areaOf(value.areaId);
  const scopeAreaId = lockedAreaId ?? areaFilter;

  // Ebene, die gerade durchgeklickt wird; ohne Bereichsfilter zeigt die oberste Ebene die Bereiche.
  const current = parentId ? byId.get(parentId) : undefined;
  const levelAreaId = current?.areaId ?? scopeAreaId;
  const level = levelAreaId
    ? (areaOf(levelAreaId)?.categories ?? [])
        .filter((category) => category.parentId === (parentId ?? null))
        .map((category) => byId.get(category.id))
        .filter((entry): entry is Entry => Boolean(entry))
    : [];
  const parentOf = (id: string) =>
    allAreas.flatMap((area) => area.categories).find((category) => category.id === id)?.parentId ??
    null;
  const hasChildren = (id: string) =>
    allAreas.some((area) => area.categories.some((category) => category.parentId === id));

  const trimmed = query.trim();
  const hits = React.useMemo(() => {
    if (!trimmed) return [];
    const needle = normalize(trimmed);
    return entries
      .filter((entry) => !scopeAreaId || entry.areaId === scopeAreaId)
      .map((entry) => {
        const name = normalize(entry.name);
        const path = normalize(entry.names.join(" "));
        const score = name.startsWith(needle)
          ? 0
          : name.includes(needle)
            ? 1
            : path.includes(needle)
              ? 2
              : -1;
        return { entry, score };
      })
      .filter((hit) => hit.score >= 0)
      .sort(
        (a, b) =>
          a.score - b.score ||
          a.entry.depth - b.entry.depth ||
          a.entry.names.join().localeCompare(b.entry.names.join(), "de"),
      )
      .slice(0, 40)
      .map((hit) => hit.entry);
  }, [entries, scopeAreaId, trimmed]);
  const exact = hits.some((entry) => normalize(entry.name) === normalize(trimmed));
  const createAreaId = current?.areaId ?? scopeAreaId;
  const canCreateHere =
    canCreate && trimmed && !exact && createAreaId && (current?.depth ?? 0) < MAX_CATEGORY_DEPTH;

  const hint = nameHint?.trim() ?? "";
  React.useEffect(() => {
    if (!open || hint.length < 3) return;
    let cancelled = false;
    void suggestCategoriesAction(hint).then((result) => {
      if (!cancelled && result.ok) setSuggested(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, hint]);

  const openPicker = () => {
    setRecent(readRecent());
    setQuery("");
    setParentId(null);
    setAreaFilter(lockedAreaId ?? null);
    setSuggested([]);
    setOpen(true);
  };

  const choose = (choice: CategoryChoice) => {
    if (choice.categoryId) rememberRecent(choice.categoryId);
    onChange(choice);
    setOpen(false);
  };

  const create = async () => {
    if (!createAreaId) return;
    setCreating(true);
    const result = await saveCategoryAction(createAreaId, null, {
      name: trimmed,
      parentId: current?.id ?? null,
    });
    setCreating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`„${trimmed}“ angelegt.`);
    setCreated((list) => [
      ...list,
      { id: result.data.id, parentId: current?.id ?? null, name: trimmed, areaId: createAreaId },
    ]);
    router.refresh();
    choose({ areaId: createAreaId, categoryId: result.data.id });
  };

  const row = (entry: Entry, options: { icon?: React.ReactNode; drill?: boolean } = {}) => {
    const active = entry.id === value.categoryId;
    const area = areaOf(entry.areaId);
    const drill = options.drill && hasChildren(entry.id);
    return (
      <li key={`${options.icon ? "x" : ""}${entry.id}`} className="flex items-stretch">
        <button
          type="button"
          onClick={() =>
            drill
              ? (setParentId(entry.id), setQuery(""))
              : choose({ areaId: entry.areaId, categoryId: entry.id })
          }
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            active && "bg-primary/10",
          )}
        >
          {options.icon ?? (
            <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
              {area?.prefix}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-foreground">
              <Highlight text={entry.name} query={trimmed} />
            </span>
            {entry.names.length > 1 && !options.drill ? (
              <span className="block truncate text-xs text-muted-foreground">
                {shortPath(entry.names.slice(0, -1))}
              </span>
            ) : null}
          </span>
          {active ? <CheckIcon className="h-4 w-4 shrink-0 text-primary" /> : null}
          {drill ? <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
        </button>
      </li>
    );
  };

  const recentEntries = recent
    .map((id) => byId.get(id))
    .filter((entry): entry is Entry => Boolean(entry))
    .filter((entry) => !scopeAreaId || entry.areaId === scopeAreaId);
  const suggestedEntries = (hint.length >= 3 ? suggested : [])
    .map((id) => byId.get(id))
    .filter((entry): entry is Entry => Boolean(entry))
    .filter((entry) => !scopeAreaId || entry.areaId === scopeAreaId);

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-label={label}
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          triggerClassName,
        )}
      >
        {selectedArea ? (
          <span className="shrink-0 rounded bg-muted px-1.5 font-mono text-xs text-muted-foreground">
            {selectedArea.prefix}
          </span>
        ) : null}
        <span
          className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}
          title={selected?.names.join(" › ")}
        >
          {selected
            ? shortPath(selected.names)
            : selectedArea
              ? `${selectedArea.name} · ${noneLabel}`
              : allowNone
                ? noneLabel
                : "Kategorie wählen"}
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 rotate-90 text-muted-foreground" />
      </button>

      <ResponsivePanel
        open={open}
        onOpenChange={setOpen}
        title={label}
        description={
          lockedAreaId
            ? `Bereich ${areaOf(lockedAreaId)?.name ?? ""} – er bestimmt den Code.`
            : "Die Kategorie legt auch den Bereich fest."
        }
      >
        <div className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Kategorie suchen</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Suchen, z. B. PAR, Mikrofon, Gehrock"
              className="pl-9"
              enterKeyHint="search"
              onKeyDown={(event) => {
                if (event.key === "Enter" && hits[0]) {
                  event.preventDefault();
                  choose({ areaId: hits[0].areaId, categoryId: hits[0].id });
                }
              }}
            />
          </label>

          {!lockedAreaId && allAreas.length > 1 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bereich">
              {[{ id: null, prefix: "", name: "Alle" }, ...allAreas].map((area) => (
                <button
                  key={area.id ?? "alle"}
                  type="button"
                  aria-pressed={areaFilter === area.id}
                  onClick={() => {
                    setAreaFilter(area.id);
                    setParentId(null);
                  }}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
                    areaFilter === area.id
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {area.prefix ? <span className="font-mono">{area.prefix}</span> : null}
                  {area.name}
                </button>
              ))}
            </div>
          ) : null}

          {trimmed ? (
            <ul className="space-y-0.5" aria-label="Treffer">
              {hits.map((entry) => row(entry))}
              {!hits.length ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  Keine Kategorie passt zu „{trimmed}“.
                </li>
              ) : null}
            </ul>
          ) : (
            <div className="space-y-3">
              {!parentId && suggestedEntries.length ? (
                <section>
                  <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                    Vorschlag zu „{nameHint?.trim()}“
                  </h3>
                  <ul className="space-y-0.5">
                    {suggestedEntries.map((entry) =>
                      row(entry, {
                        icon: <SparklesIcon className="h-4 w-4 shrink-0 text-primary" />,
                      }),
                    )}
                  </ul>
                </section>
              ) : null}
              {!parentId && recentEntries.length ? (
                <section>
                  <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                    Zuletzt verwendet
                  </h3>
                  <ul className="space-y-0.5">
                    {recentEntries.map((entry) =>
                      row(entry, {
                        icon: <ClockIcon className="h-4 w-4 shrink-0 text-muted-foreground" />,
                      }),
                    )}
                  </ul>
                </section>
              ) : null}

              <section>
                {current ? (
                  <div className="flex items-center gap-1 pb-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setParentId(parentOf(current.id))}
                    >
                      <ChevronLeftIcon className="mr-1 h-4 w-4" />
                      Zurück
                    </Button>
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {shortPath(current.names)}
                    </span>
                  </div>
                ) : levelAreaId ? (
                  <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                    Alle Kategorien in {areaOf(levelAreaId)?.name}
                  </h3>
                ) : null}

                {!levelAreaId ? (
                  <ul className="space-y-0.5" aria-label="Bereiche">
                    {visibleAreas.map((area) => (
                      <li key={area.id}>
                        <button
                          type="button"
                          onClick={() => setAreaFilter(area.id)}
                          className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/70"
                        >
                          <span className="w-6 font-mono text-xs text-muted-foreground">
                            {area.prefix}
                          </span>
                          <span className="flex-1 font-medium text-foreground">{area.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {area.categories.length}
                          </span>
                          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-0.5" aria-label="Kategorien">
                    {current ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => choose({ areaId: current.areaId, categoryId: current.id })}
                          className="flex min-h-11 w-full items-center gap-3 rounded-md border border-dashed border-border px-3 py-2 text-left text-sm hover:bg-muted/70"
                        >
                          <CheckIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            „{current.name}“ selbst wählen
                          </span>
                        </button>
                      </li>
                    ) : null}
                    {level.map((entry) => row(entry, { drill: true }))}
                    {allowNone && !current ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => choose({ areaId: levelAreaId, categoryId: null })}
                          className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/70"
                        >
                          <span className="w-6" />
                          {noneLabel}
                        </button>
                      </li>
                    ) : null}
                  </ul>
                )}
              </section>
            </div>
          )}

          {canCreateHere ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              disabled={creating}
              onClick={create}
            >
              <PlusIcon className="mr-2 h-4 w-4" />„{trimmed}“ anlegen{" "}
              {current ? `unter ${current.name}` : `in ${areaOf(createAreaId!)?.name}`}
            </Button>
          ) : canCreate && trimmed && !hits.length && !createAreaId ? (
            <p className="text-xs text-muted-foreground">
              Zum Anlegen erst einen Bereich oder eine Oberkategorie wählen.
            </p>
          ) : null}
        </div>
      </ResponsivePanel>
    </>
  );
}
