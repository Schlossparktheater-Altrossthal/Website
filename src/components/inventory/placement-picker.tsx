"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PlacementTarget } from "@/lib/inventory/service-types";

export type PlacementOptions = {
  locations: { id: string; code: string; path: string }[];
  containers: { id: string; code: string; name: string; path: string | null }[];
};

const NONE = "__none__";

/** Wahl des Lagerplatzes: fester Ort oder Kiste. */
export function PlacementPicker({
  value,
  onChange,
  options,
  excludeContainerId,
  allowNone = true,
}: {
  value: PlacementTarget;
  onChange: (value: PlacementTarget) => void;
  options: PlacementOptions;
  excludeContainerId?: string;
  allowNone?: boolean;
}) {
  const [mode, setMode] = React.useState<"location" | "container">(
    value.type === "container" ? "container" : "location",
  );
  const containers = options.containers.filter((container) => container.id !== excludeContainerId);
  const selected = value.type === "none" ? NONE : value.id;

  return (
    <div className="space-y-2">
      <SegmentedControl
        aria-label="Art des Lagerplatzes"
        value={mode}
        fullWidth
        onValueChange={(next) => {
          // Beim Wechsel bleibt die Auswahl leer, bis ein Ziel gewählt ist.
          setMode(next);
          onChange({ type: "none" });
        }}
        options={[
          { value: "location", label: "Lagerort" },
          { value: "container", label: "In Kiste", disabled: !containers.length },
        ]}
      />
      {mode === "location" ? (
        <Select
          value={selected}
          onValueChange={(id) =>
            onChange(id === NONE ? { type: "none" } : { type: "location", id })
          }
        >
          <SelectTrigger aria-label="Lagerort">
            <SelectValue placeholder="Lagerort wählen" />
          </SelectTrigger>
          <SelectContent>
            {allowNone ? <SelectItem value={NONE}>Noch kein Ort</SelectItem> : null}
            {options.locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.path} <span className="text-muted-foreground">({location.code})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Select
          value={selected}
          onValueChange={(id) =>
            onChange(id === NONE ? { type: "none" } : { type: "container", id })
          }
        >
          <SelectTrigger aria-label="Kiste">
            <SelectValue placeholder="Kiste wählen" />
          </SelectTrigger>
          <SelectContent>
            {allowNone ? <SelectItem value={NONE}>Keine Kiste</SelectItem> : null}
            {containers.map((container) => (
              <SelectItem key={container.id} value={container.id}>
                {container.code} {container.name}
                {container.path ? (
                  <span className="text-muted-foreground"> · {container.path}</span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
