"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SearchIcon } from "@/components/ui/action-icons";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}: {
  areas: { id: string; name: string }[];
  locations: { id: string; path: string }[];
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

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
    </div>
  );
}
