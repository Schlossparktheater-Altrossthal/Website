"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { TaxonPicker } from "@/components/food/taxon-picker";
import { ActionDropdownMenu } from "@/components/ui/action-dropdown-menu";
import { CheckIcon, ChevronRightIcon, TrashIcon } from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { PendingRestrictionGroup } from "@/lib/food/pending";
import type { TaxonSuggestion } from "@/lib/food/taxon-suggestions";
import { cn } from "@/lib/utils";

import {
  assignManyPendingAction,
  assignPendingAction,
  deletePendingAction,
  splitPendingAction,
  unassignManyPendingAction,
} from "./actions";

type Result = { ok: true; count: number } | { ok: false; error: string };
type Assignment = { key: string; taxonCode: string };

const SECTIONS: { category: PendingRestrictionGroup["category"]; label: string }[] = [
  { category: "sure", label: "Eindeutig" },
  { category: "split", label: "Sammeleinträge" },
  { category: "unclear", label: "Unklar" },
];

const persons = (count: number) => (count === 1 ? "1 Person" : `${count} Personen`);

/** Ziel einer Zuordnung als kompakter Chip; LMIV-Allergene hervorgehoben. */
function TaxonChip({ taxon, dashed }: { taxon: TaxonSuggestion | null; dashed?: string }) {
  if (!taxon) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground">
        {dashed ?? "?"}
      </span>
    );
  }
  return (
    <span
      title={[...taxon.path, taxon.name].join(" › ")}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        taxon.lmiv ? "bg-warning/15 text-foreground" : "bg-muted text-foreground",
      )}
    >
      <span className="truncate">{taxon.name}</span>
      {taxon.lmiv ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-warning">LMIV</span>
      ) : null}
    </span>
  );
}

/**
 * Pflegeliste ungeklärter Allergie-Texte: eindeutige Treffer mit einem Klick (auch alle auf
 * einmal), Sammeleinträge mit Vorschau der Teile, unklare über Suche im Detail – mobil als
 * Sheet, am Desktop als Panel neben der Liste. Bestätigungen lassen sich rückgängig machen.
 */
export function PendingList({ groups }: { groups: PendingRestrictionGroup[] }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [pending, startTransition] = useTransition();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PendingRestrictionGroup | null>(null);
  const selected = groups.find((group) => group.key === selectedKey) ?? null;
  const sure = groups.filter((group) => group.category === "sure" && group.match);

  const undo = (items: Assignment[]) =>
    startTransition(async () => {
      const result = await unassignManyPendingAction(items);
      if (result.ok) toast.success("Rückgängig gemacht");
      else toast.error(result.error);
    });

  const run = (
    operation: () => Promise<Result>,
    message: (count: number) => string,
    undoItems?: Assignment[],
  ) =>
    startTransition(async () => {
      const result = await operation();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(message(result.count), {
        duration: 6000,
        action: undoItems ? { label: "Rückgängig", onClick: () => undo(undoItems) } : undefined,
      });
    });

  const assign = (group: PendingRestrictionGroup, taxon: TaxonSuggestion) => {
    setSelectedKey(null);
    run(
      () => assignPendingAction(group.key, taxon.code),
      () => `„${group.text}“ → ${taxon.name}`,
      [{ key: group.key, taxonCode: taxon.code }],
    );
  };

  const split = (group: PendingRestrictionGroup) => {
    setSelectedKey(null);
    run(
      () => splitPendingAction(group.key),
      (count) => `„${group.text}“ in ${count} Einträge aufgeteilt`,
    );
  };

  const assignAllSure = () => {
    const items = sure.flatMap((group) =>
      group.match ? [{ key: group.key, taxonCode: group.match.code }] : [],
    );
    run(
      () => assignManyPendingAction(items),
      () => `${items.length} eindeutige Angaben übernommen`,
      items,
    );
  };

  if (groups.length === 0) {
    return (
      <Card>
        <p className="py-12 text-center text-sm text-muted-foreground">
          Alles zugeordnet – neue Freitexte erscheinen hier automatisch.
        </p>
      </Card>
    );
  }

  const detail = selected ? (
    <PendingDetail
      group={selected}
      disabled={pending}
      onAssign={(taxon) => assign(selected, taxon)}
      onSplit={() => split(selected)}
      onDelete={() => setDeleting(selected)}
    />
  ) : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <Card variant="plain" size="md" className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {groups.length === 1 ? "1 Angabe offen" : `${groups.length} Angaben offen`}
            </p>
            <p className="text-xs text-muted-foreground">
              {sure.length > 0
                ? `${sure.length} davon eindeutig erkannt`
                : "Keine eindeutigen Treffer – bitte einzeln zuordnen"}
            </p>
          </div>
          {sure.length > 0 ? (
            <Button size="sm" disabled={pending} onClick={assignAllSure}>
              <CheckIcon />
              Alle {sure.length} übernehmen
            </Button>
          ) : null}
        </Card>

        {SECTIONS.map(({ category, label }) => {
          const items = groups.filter((group) => group.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category} className="space-y-1.5">
              <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label} · {items.length}
              </h2>
              <Card variant="plain" className="p-1">
                <ul className="divide-y divide-border">
                  {items.map((group) => (
                    <PendingRow
                      key={group.key}
                      group={group}
                      active={group.key === selectedKey}
                      disabled={pending}
                      onOpen={() => setSelectedKey(group.key)}
                      onConfirm={() =>
                        group.category === "split"
                          ? split(group)
                          : group.match
                            ? assign(group, group.match)
                            : setSelectedKey(group.key)
                      }
                      onDelete={() => setDeleting(group)}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          );
        })}
      </div>

      {isDesktop ? (
        <aside className="hidden lg:block">
          <Card variant="plain" size="md" className="sticky top-20">
            {detail ?? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Eine Angabe wählen, um sie zuzuordnen.
              </p>
            )}
          </Card>
        </aside>
      ) : (
        <BottomSheet
          open={selected !== null}
          onOpenChange={(open) => !open && setSelectedKey(null)}
          title={selected ? `„${selected.text}“` : ""}
          description="Allergie-Angabe einem Lebensmittel oder Allergen zuordnen"
        >
          {detail}
        </BottomSheet>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Angabe löschen?"
        description={`„${deleting?.text ?? ""}“ wird bei ${persons(deleting?.count ?? 0)} entfernt. Nur für Angaben ohne Aussage wie „Keine“ oder „Nichts“.`}
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const group = deleting;
          setDeleting(null);
          setSelectedKey(null);
          if (group)
            run(
              () => deletePendingAction(group.key),
              () => `„${group.text}“ gelöscht`,
            );
        }}
      />
    </div>
  );
}

function PendingRow({
  group,
  active,
  disabled,
  onOpen,
  onConfirm,
  onDelete,
}: {
  group: PendingRestrictionGroup;
  active: boolean;
  disabled: boolean;
  onOpen: () => void;
  onConfirm: () => void;
  onDelete: () => void;
}) {
  const targets =
    group.category === "split" ? (
      group.partMatches.map((part) => (
        <TaxonChip key={part.text} taxon={part.match} dashed={part.text} />
      ))
    ) : group.match ? (
      <TaxonChip taxon={group.match} />
    ) : null;

  return (
    <li className={cn("flex items-center gap-1 rounded-md", active && "bg-muted/60")}>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-12 min-w-0 flex-1 flex-col items-start gap-1 rounded-md px-3 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:gap-3"
      >
        <span className="min-w-0 sm:w-56 sm:shrink-0">
          <span className="block break-words text-sm font-medium text-foreground">
            {group.text}
          </span>
          <span className="block text-xs text-muted-foreground">{persons(group.count)}</span>
        </span>
        {targets ? (
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            <span aria-hidden className="text-xs text-muted-foreground">
              →
            </span>
            {targets}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Kein sicherer Treffer</span>
        )}
      </button>
      {group.category === "unclear" ? (
        <Button size="sm" variant="ghost" onClick={onOpen} disabled={disabled}>
          Zuordnen
          <ChevronRightIcon />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          aria-label={group.category === "split" ? "Aufteilen und übernehmen" : "Übernehmen"}
          title={group.category === "split" ? "Aufteilen und übernehmen" : "Übernehmen"}
          disabled={disabled}
          onClick={onConfirm}
          className="text-success"
        >
          <CheckIcon />
        </Button>
      )}
      <ActionDropdownMenu
        className="mr-1 border-transparent bg-transparent shadow-none"
        items={[
          { label: "Anders zuordnen …", onSelect: onOpen, disabled },
          {
            label: "Löschen (keine Angabe)",
            icon: <TrashIcon />,
            variant: "destructive",
            onSelect: onDelete,
            disabled,
          },
        ]}
      />
    </li>
  );
}

function PendingDetail({
  group,
  disabled,
  onAssign,
  onSplit,
  onDelete,
}: {
  group: PendingRestrictionGroup;
  disabled: boolean;
  onAssign: (taxon: TaxonSuggestion) => void;
  onSplit: () => void;
  onDelete: () => void;
}) {
  const suggestions = [
    ...(group.match ? [group.match] : []),
    ...group.suggestions.filter((item) => item.code !== group.match?.code),
  ];
  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <p className="break-words text-base font-semibold text-foreground">„{group.text}“</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {persons(group.count)} · Die Zuordnung gilt für alle mit diesem Text und für künftige
        Eingaben.
      </p>

      {group.category === "split" ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-medium text-foreground">
            In {group.parts.length} Einträge aufteilen
          </p>
          <ul className="space-y-1">
            {group.partMatches.map((part) => (
              <li key={part.text} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 break-words">{part.text}</span>
                <TaxonChip taxon={part.match} dashed="später zuordnen" />
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Details wie Schweregrad werden in jeden Teil übernommen.
          </p>
          <Button size="sm" className="w-full" disabled={disabled} onClick={onSplit}>
            <CheckIcon />
            Aufteilen
          </Button>
        </div>
      ) : null}

      {suggestions.length > 0 && group.category !== "split" ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Vorschläge
          </p>
          <ul className="space-y-1">
            {suggestions.map((taxon) => (
              <li key={taxon.code}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onAssign(taxon)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left hover:bg-muted/50 disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      {taxon.name}
                      {taxon.lmiv ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                          LMIV
                        </span>
                      ) : null}
                    </span>
                    {taxon.path.length > 0 ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {taxon.path.join(" › ")}
                      </span>
                    ) : null}
                  </span>
                  <CheckIcon className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suchen</p>
        <TaxonPicker
          key={group.key}
          initialQuery={group.category === "split" ? "" : (group.parts[0] ?? group.text)}
          disabled={disabled}
          onPick={onAssign}
        />
      </div>

      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
      >
        Angabe ohne Aussage? Löschen
      </button>
    </div>
  );
}
