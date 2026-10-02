"use client";

import * as React from "react";
import Link from "next/link";

import { InspectionDialog } from "@/components/inventory/inspection-dialog";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { ShieldCheckIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  formatInventoryDate,
  INSPECTION_STATE_LABELS,
  INSPECTION_STATE_TONES,
  inventoryAssetPath,
  type InspectionState,
} from "@/lib/inventory/constants";

export type InspectionRow = {
  id: string;
  code: string;
  name: string;
  place: string | null;
  state: InspectionState;
  nextInspectionAt: string | null;
};

/** Fällige Prüfungen: auswählen und am Prüftag gesammelt eintragen. */
export function InspectionBoard({ rows }: { rows: InspectionRow[] }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [open, setOpen] = React.useState(false);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!rows.length) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Nichts fällig in den nächsten 30 Tagen.
      </p>
    );
  }

  const allSelected = selected.size === rows.length;
  const chosen = rows.filter((row) => selected.has(row.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() =>
              setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))
            }
            aria-label="Alle auswählen"
          />
          Alle
        </label>
        <Button
          size="sm"
          className="ml-auto"
          disabled={!selected.size}
          onClick={() => setOpen(true)}
        >
          <ShieldCheckIcon className="mr-2 h-4 w-4" />
          {selected.size ? `${selected.size} als geprüft eintragen` : "Auswählen zum Eintragen"}
        </Button>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-3 py-2">
            <Checkbox
              checked={selected.has(row.id)}
              onCheckedChange={() => toggle(row.id)}
              aria-label={`${row.code} auswählen`}
            />
            <Link href={inventoryAssetPath(row.code)} className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{row.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                <span className="font-mono">{row.code}</span>
                {row.place ? ` · ${row.place}` : ""}
              </span>
            </Link>
            <ToneBadge tone={INSPECTION_STATE_TONES[row.state]}>
              {row.nextInspectionAt && row.state === "soon"
                ? `bis ${formatInventoryDate(row.nextInspectionAt)}`
                : INSPECTION_STATE_LABELS[row.state].replace("Prüfung ", "")}
            </ToneBadge>
          </li>
        ))}
      </ul>
      <InspectionDialog
        open={open}
        onOpenChange={setOpen}
        assetIds={chosen.map((row) => row.id)}
        label={chosen.map((row) => row.code).join(", ")}
        onDone={() => setSelected(new Set())}
      />
    </div>
  );
}
