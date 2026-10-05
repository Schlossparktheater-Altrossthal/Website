"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CategoryPicker, shortPath } from "@/components/inventory/category-picker";
import { TagInput } from "@/components/inventory/tag-input";
import { FilterIcon, SearchIcon, XIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FITS_PARAM,
  parseTagFilter,
  scopeFilterFields,
  SPEC_PARAM_PREFIX,
  TAG_PARAM,
} from "@/lib/inventory/spec-filters";
import {
  categoryPath,
  type CategoryNode,
  type FieldDef,
  type FieldLevel,
} from "@/lib/inventory/specs";

type FilterCatalogArea = {
  id: string;
  name: string;
  prefix: string;
  fields: FieldDef[];
  categories: (CategoryNode & FieldLevel)[];
};

const ALL = "alle";

export const ASSET_VIEWS = [
  { value: "all", label: "Alles im Bestand" },
  { value: "defects", label: "Mit Mängeln" },
  { value: "inspection", label: "Prüfung fällig" },
  { value: "checked_out", label: "Ausgegeben" },
  { value: "missing", label: "Vermisst" },
  { value: "unlabeled", label: "Ohne Etikett" },
  { value: "low", label: "Unter Mindestbestand" },
  { value: "retired", label: "Ausgemustert" },
] as const;

/** Suche und Filter des Bestands – Zustand steht in der URL. */
export function AssetFilters({
  areas,
  locations,
  catalog,
}: {
  areas: { id: string; name: string }[];
  locations: { id: string; path: string }[];
  catalog: FilterCatalogArea[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get("q") ?? "");

  const update = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== ALL && value !== "all") params.set(key, value);
      else params.delete(key);
      // Bereichswechsel: Kategorie und Merkmal-Filter passen nicht mehr.
      if (key === "bereich") {
        params.delete("kategorie");
        for (const name of [...params.keys()]) {
          if (name.startsWith(SPEC_PARAM_PREFIX)) params.delete(name);
        }
      }
      params.delete("seite");
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (query.trim() === current) return;
    const timer = window.setTimeout(() => update("q", query.trim() || null), 300);
    return () => window.clearTimeout(timer);
  }, [query, searchParams, update]);

  const replaceParams = React.useCallback(
    (change: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      change(params);
      params.delete("seite");
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Suchen</span>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, Code, Hersteller …"
            className="pl-9"
            enterKeyHint="search"
          />
        </label>
        <Select
          value={searchParams.get("bereich") ?? ALL}
          onValueChange={(v) => update("bereich", v)}
        >
          <SelectTrigger aria-label="Bereich">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Bereiche</SelectItem>
            {areas.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={searchParams.get("ort") ?? ALL} onValueChange={(v) => update("ort", v)}>
          <SelectTrigger aria-label="Lagerort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Orte</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={searchParams.get("ansicht") ?? "all"}
          onValueChange={(v) => update("ansicht", v)}
        >
          <SelectTrigger aria-label="Ansicht">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSET_VIEWS.map((view) => (
              <SelectItem key={view.value} value={view.value}>
                {view.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MoreFilters catalog={catalog} searchParams={searchParams} replaceParams={replaceParams} />
      </div>
      <ActiveFilters catalog={catalog} searchParams={searchParams} replaceParams={replaceParams} />
    </div>
  );
}

type ParamsProps = {
  catalog: FilterCatalogArea[];
  searchParams: URLSearchParams;
  replaceParams: (change: (params: URLSearchParams) => void) => void;
};

function specEntries(params: URLSearchParams) {
  return [...params.entries()].filter(([key]) => key.startsWith(SPEC_PARAM_PREFIX));
}

function activeCount(params: URLSearchParams) {
  return (
    (params.get("kategorie") ? 1 : 0) +
    parseTagFilter(params.get(TAG_PARAM) ?? undefined).length +
    specEntries(params).length +
    (params.get(FITS_PARAM) ? 1 : 0)
  );
}

/** Kategorie, Tags, Merkmale und „passt in“ – Entwurf im Panel, übernommen mit „Anzeigen“. */
function MoreFilters({ catalog, searchParams, replaceParams }: ParamsProps) {
  const [open, setOpen] = React.useState(false);
  const [areaId, setAreaId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [tags, setTags] = React.useState<string[]>([]);
  const [specs, setSpecs] = React.useState<Record<string, string>>({});
  const [fits, setFits] = React.useState("");
  const count = activeCount(searchParams);

  const openPanel = () => {
    setAreaId(searchParams.get("bereich") ?? "");
    setCategoryId(searchParams.get("kategorie"));
    setTags(parseTagFilter(searchParams.get(TAG_PARAM) ?? undefined));
    setSpecs(
      Object.fromEntries(
        specEntries(searchParams).map(([key, value]) => [
          key.slice(SPEC_PARAM_PREFIX.length),
          value,
        ]),
      ),
    );
    setFits(searchParams.get(FITS_PARAM) ?? "");
    setOpen(true);
  };

  const fields = scopeFilterFields(catalog, areaId, categoryId);

  const apply = () => {
    replaceParams((params) => {
      if (areaId) params.set("bereich", areaId);
      else params.delete("bereich");
      if (categoryId) params.set("kategorie", categoryId);
      else params.delete("kategorie");
      if (tags.length) params.set(TAG_PARAM, tags.join(","));
      else params.delete(TAG_PARAM);
      for (const [key] of specEntries(params)) params.delete(key);
      for (const field of fields) {
        const value = specs[field.key]?.trim();
        if (value && value !== "~") params.set(`${SPEC_PARAM_PREFIX}${field.key}`, value);
      }
      if (fits.trim()) params.set(FITS_PARAM, fits.trim());
      else params.delete(FITS_PARAM);
    });
    setOpen(false);
  };

  const reset = () => {
    setCategoryId(null);
    setTags([]);
    setSpecs({});
    setFits("");
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={openPanel} className="h-10">
        <FilterIcon className="mr-2 h-4 w-4" />
        Filter
        {count ? (
          <span className="ml-2 rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </Button>
      <ResponsivePanel
        open={open}
        onOpenChange={setOpen}
        title="Filter"
        description="Kategorie, Tags, Merkmale und Größe"
        footer={
          <div className="flex gap-2">
            <Button type="button" onClick={apply} className="flex-1 sm:flex-none">
              Anzeigen
            </Button>
            <Button type="button" variant="outline" onClick={reset}>
              Zurücksetzen
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <CategoryPicker
              areas={catalog}
              value={{ areaId, categoryId }}
              noneLabel="Alle Kategorien"
              onChange={(choice) => {
                if (choice.areaId !== areaId) setSpecs({});
                setAreaId(choice.areaId);
                setCategoryId(choice.categoryId);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-tags">Tags (alle)</Label>
            <TagInput id="filter-tags" value={tags} onChange={setTags} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-fits">Passt in (L × B × H)</Label>
            <Input
              id="filter-fits"
              value={fits}
              onChange={(event) => setFits(event.target.value)}
              placeholder="z. B. 120x80x60 cm – gedreht zählt auch"
            />
          </div>
          {fields.length ? (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">Merkmale</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <SpecFilterField
                    key={field.key}
                    field={field}
                    value={specs[field.key] ?? ""}
                    onChange={(value) =>
                      setSpecs((current) => ({ ...current, [field.key]: value }))
                    }
                  />
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="text-xs text-muted-foreground">
              {areaId
                ? "Hier gibt es keine weiteren Merkmale zum Filtern."
                : "Nach Merkmalen filtern geht, sobald ein Bereich oder eine Kategorie gewählt ist."}
            </p>
          )}
        </div>
      </ResponsivePanel>
    </>
  );
}

function SpecFilterField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `filter-${field.key}`;
  const label = `${field.label}${field.unit ? ` (${field.unit})` : ""}`;
  if (field.type === "number" || field.type === "measure") {
    const [from = "", to = ""] = value.split("~");
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            value={from}
            inputMode="decimal"
            placeholder="von"
            onChange={(event) => onChange(`${event.target.value}~${to}`)}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            value={to}
            inputMode="decimal"
            placeholder="bis"
            aria-label={`${field.label} bis`}
            onChange={(event) => onChange(`${from}~${event.target.value}`)}
          />
        </div>
      </div>
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="flex min-h-10 items-center justify-between gap-3 self-end rounded-md border border-border px-3 py-2 text-sm">
        {field.label}
        <Switch
          checked={value === "ja"}
          onCheckedChange={(checked) => onChange(checked ? "ja" : "")}
          aria-label={field.label}
        />
      </label>
    );
  }
  if (field.type === "select" || field.type === "multiselect") {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? "" : next)}>
          <SelectTrigger aria-label={field.label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>egal</SelectItem>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder="enthält …"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/** Gesetzte Filter als Chips – antippen entfernt. */
function ActiveFilters({ catalog, searchParams, replaceParams }: ParamsProps) {
  const chips: { key: string; label: string; remove: (params: URLSearchParams) => void }[] = [];
  const categoryId = searchParams.get("kategorie");
  const area = catalog.find((entry) => entry.categories.some((c) => c.id === categoryId));
  if (categoryId && area) {
    chips.push({
      key: "kategorie",
      label: shortPath(categoryPath(area.categories, categoryId).map((entry) => entry.name)),
      remove: (params) => {
        params.delete("kategorie");
        for (const [key] of specEntries(params)) params.delete(key);
      },
    });
  }
  const tags = parseTagFilter(searchParams.get(TAG_PARAM) ?? undefined);
  for (const tag of tags) {
    chips.push({
      key: `tag-${tag}`,
      label: `# ${tag}`,
      remove: (params) => {
        const rest = tags.filter((entry) => entry !== tag);
        if (rest.length) params.set(TAG_PARAM, rest.join(","));
        else params.delete(TAG_PARAM);
      },
    });
  }
  const scopeArea = catalog.find((entry) => entry.id === searchParams.get("bereich"));
  const allFields = scopeArea
    ? [...scopeArea.fields, ...scopeArea.categories.flatMap((entry) => entry.fields)]
    : [];
  for (const [key, value] of specEntries(searchParams)) {
    const field = allFields.find((entry) => `${SPEC_PARAM_PREFIX}${entry.key}` === key);
    const [from = "", to = ""] = value.split("~");
    const text = value.includes("~")
      ? from && to
        ? `${from}–${to}`
        : from
          ? `ab ${from}`
          : `bis ${to}`
      : value;
    chips.push({
      key,
      label: `${field?.label ?? key.slice(SPEC_PARAM_PREFIX.length)}: ${text}${field?.unit ? ` ${field.unit}` : ""}`,
      remove: (params) => params.delete(key),
    });
  }
  const fits = searchParams.get(FITS_PARAM);
  if (fits) {
    chips.push({ key: FITS_PARAM, label: `passt in ${fits}`, remove: (p) => p.delete(FITS_PARAM) });
  }
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Aktive Filter">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => replaceParams(chip.remove)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-foreground hover:bg-primary/20"
          aria-label={`Filter ${chip.label} entfernen`}
        >
          {chip.label}
          <XIcon className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}
