"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  bulkMoveAssetsAction,
  bulkRetireAssetsAction,
  bulkUpdateAssetsAction,
  updateAssetFieldAction,
  type BulkOutcome,
  type InlineAssetField,
} from "@/app/(members)/mitglieder/lager/actions/bulk";
import { PlacementPicker, type PlacementOptions } from "@/components/inventory/placement-picker";
import { ToneBadge } from "@/components/inventory/tone-badge";
import {
  ArchiveIcon,
  ArrowRightLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PrinterIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUS_TONES,
  CONDITION_LABELS,
  CONDITIONS,
  formatInventoryDate,
  INSPECTION_STATE_LABELS,
  INSPECTION_STATE_TONES,
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
} from "@/lib/inventory/constants";
import type { InventoryListItem, InventorySort, InventorySortKey } from "@/lib/inventory/queries";
import type { PlacementTarget } from "@/lib/inventory/service-types";
import { cn } from "@/lib/utils";

const NONE = "__none__";
const KEEP = "__keep__";

type AreaOption = { id: string; prefix: string; categories: { id: string; name: string }[] };
type Overrides = Record<
  string,
  Partial<Pick<InventoryListItem, "name" | "categoryId" | "condition">>
>;

/**
 * Bestand als kompakte Tabelle (Desktop): sortierbare Spalten, Name/Kategorie/Zustand direkt in
 * der Zelle ändern, mehrere Zeilen wählen (Umschalt-Klick für Bereiche) und gemeinsam bearbeiten.
 */
export function AssetTable({
  items,
  areas,
  placementOptions,
  sort,
  canManage,
}: {
  items: InventoryListItem[];
  areas: AreaOption[];
  placementOptions: PlacementOptions;
  sort: InventorySort | undefined;
  canManage: boolean;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<{ items: InventoryListItem[]; overrides: Overrides }>({
    items,
    overrides: {},
  });
  // Neue Serverdaten ersetzen die vorläufigen Werte.
  if (state.items !== items) setState({ items, overrides: {} });
  const overrides = state.items === items ? state.overrides : {};
  const rows = items.map((item) => ({ ...item, ...overrides[item.id] }));

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const lastClicked = React.useRef<number | null>(null);
  const visibleSelected = rows.filter((row) => selected.has(row.id));
  const allSelected = rows.length > 0 && visibleSelected.length === rows.length;

  const areaById = React.useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const categoryName = (row: InventoryListItem) =>
    areaById.get(row.areaId)?.categories.find((category) => category.id === row.categoryId)?.name ??
    null;

  const toggleRow = (index: number, shift: boolean) => {
    const id = rows[index]!.id;
    setSelected((current) => {
      const next = new Set(current);
      const select = !current.has(id);
      if (shift && lastClicked.current !== null) {
        const [from, to] = [lastClicked.current, index].sort((a, b) => a - b);
        for (let i = from!; i <= to!; i++) {
          if (select) next.add(rows[i]!.id);
          else next.delete(rows[i]!.id);
        }
      } else if (select) next.add(id);
      else next.delete(id);
      return next;
    });
    lastClicked.current = index;
  };

  const saveField = async (row: InventoryListItem, field: InlineAssetField, value: string) => {
    const previous = state.overrides[row.id];
    setState((current) => ({
      ...current,
      overrides: {
        ...current.overrides,
        [row.id]: {
          ...current.overrides[row.id],
          [field]: field === "categoryId" ? value || null : value,
        },
      },
    }));
    const result = await updateAssetFieldAction(row.id, field, value);
    if (!result.ok) {
      toast.error(result.error);
      setState((current) => ({
        ...current,
        overrides: { ...current.overrides, [row.id]: previous ?? {} },
      }));
      return;
    }
    router.refresh();
  };

  const finishBulk = (
    result: { ok: true; message?: string; data: BulkOutcome } | { ok: false; error: string },
  ) => {
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    const skipped = result.data.skipped;
    if (skipped.length) {
      toast.warning(result.message ?? "Erledigt.", {
        description: skipped
          .slice(0, 5)
          .map((entry) => `${entry.code}: ${entry.reason}`)
          .join(" · "),
      });
    } else {
      toast.success(result.message ?? "Erledigt.");
    }
    router.refresh();
    return true;
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[64rem] table-fixed border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="sticky top-0 z-10 w-10 border-b border-border bg-muted px-3 py-2">
                <Checkbox
                  aria-label="Alle auf dieser Seite wählen"
                  checked={allSelected ? true : visibleSelected.length ? "indeterminate" : false}
                  onCheckedChange={() =>
                    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))
                  }
                  className="h-4 w-4"
                />
              </th>
              <SortHeader sortKey="code" sort={sort} className="w-20">
                Code
              </SortHeader>
              <SortHeader sortKey="name" sort={sort}>
                Name
              </SortHeader>
              <SortHeader sortKey="category" sort={sort} className="w-32">
                Kategorie
              </SortHeader>
              <th className="sticky top-0 z-10 w-44 border-b border-border bg-muted px-2 py-2 font-medium">
                Ort / Kiste
              </th>
              <th className="sticky top-0 z-10 w-18 border-b border-border bg-muted px-2 py-2 text-right font-medium">
                Menge
              </th>
              <SortHeader sortKey="condition" sort={sort} className="w-28">
                Zustand
              </SortHeader>
              <SortHeader sortKey="status" sort={sort} className="w-24">
                Status
              </SortHeader>
              <SortHeader sortKey="inspection" sort={sort} className="w-24">
                Prüfung
              </SortHeader>
              <th className="sticky top-0 z-10 w-14 border-b border-border bg-muted px-2 py-2 font-medium">
                Etikett
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isSelected = selected.has(row.id);
              const retired = row.status === "retired";
              const area = areaById.get(row.areaId);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "group [&>td]:h-9 [&>td]:border-b [&>td]:border-border [&>td]:px-2",
                    isSelected ? "bg-primary/5" : "hover:bg-muted/40",
                    retired && "text-muted-foreground",
                  )}
                >
                  <td className="!px-3">
                    <Checkbox
                      aria-label={`${row.code} wählen`}
                      checked={isSelected}
                      onClick={(event) => {
                        event.preventDefault();
                        toggleRow(index, event.shiftKey);
                      }}
                      className="h-4 w-4"
                    />
                  </td>
                  <td>
                    <Link
                      href={inventoryAssetPath(row.code)}
                      className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td className="max-w-0">
                    <InlineText
                      value={row.name}
                      label={`Name von ${row.code}`}
                      disabled={retired}
                      onSave={(value) => saveField(row, "name", value)}
                    />
                  </td>
                  <td>
                    <InlineSelect
                      value={row.categoryId ?? NONE}
                      label={`Kategorie von ${row.code}`}
                      disabled={retired}
                      display={categoryName(row) ?? row.categoryName ?? "–"}
                      muted={!row.categoryId}
                      options={[
                        { value: NONE, label: "Ohne Kategorie" },
                        ...(area?.categories ?? []).map((category) => ({
                          value: category.id,
                          label: category.name,
                        })),
                      ]}
                      onSave={(value) => saveField(row, "categoryId", value === NONE ? "" : value)}
                    />
                  </td>
                  <td
                    className="max-w-0 truncate text-muted-foreground"
                    title={row.place ?? undefined}
                  >
                    {row.place ?? <span className="text-muted-foreground/60">ohne Ort</span>}
                  </td>
                  <td className="text-right tabular-nums">
                    {row.kind === "bulk" ? `${row.quantity} ${row.unit ?? "Stk."}` : null}
                  </td>
                  <td>
                    <InlineSelect
                      value={row.condition}
                      label={`Zustand von ${row.code}`}
                      disabled={retired}
                      display={CONDITION_LABELS[row.condition]}
                      options={CONDITIONS.map((condition) => ({
                        value: condition,
                        label: CONDITION_LABELS[condition],
                      }))}
                      onSave={(value) => saveField(row, "condition", value)}
                    />
                  </td>
                  <td>
                    <span className="flex items-center gap-1">
                      {row.status === "available" ? (
                        <span className="text-muted-foreground">
                          {ASSET_STATUS_LABELS.available}
                        </span>
                      ) : (
                        <ToneBadge tone={ASSET_STATUS_TONES[row.status]}>
                          {ASSET_STATUS_LABELS[row.status]}
                        </ToneBadge>
                      )}
                      {row.openDefects > 0 && row.status !== "locked" ? (
                        <ToneBadge tone="warning">{row.openDefects}</ToneBadge>
                      ) : null}
                    </span>
                  </td>
                  <td title={INSPECTION_STATE_LABELS[row.inspection]}>
                    {row.inspection === "none" ? (
                      <span className="text-muted-foreground/60">–</span>
                    ) : (
                      <span
                        className={cn(
                          "tabular-nums",
                          INSPECTION_STATE_TONES[row.inspection] === "destructive" &&
                            "font-medium text-destructive",
                          INSPECTION_STATE_TONES[row.inspection] === "warning" && "text-warning",
                        )}
                      >
                        {row.inspection === "failed"
                          ? "nicht best."
                          : row.nextInspectionAt
                            ? formatInventoryDate(row.nextInspectionAt)
                            : "fällig"}
                      </span>
                    )}
                  </td>
                  <td>
                    {row.labelPrinted ? (
                      <span className="text-muted-foreground">ja</span>
                    ) : (
                      <span className="text-primary">fehlt</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SelectionActions
        selected={visibleSelected}
        areas={areas}
        placementOptions={placementOptions}
        canManage={canManage}
        onClear={() => setSelected(new Set())}
        onDone={finishBulk}
      />
    </>
  );
}

function SortHeader({
  sortKey,
  sort,
  className,
  children,
}: {
  sortKey: InventorySortKey;
  sort: InventorySort | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = sort?.key === sortKey;
  const params = new URLSearchParams(searchParams.toString());
  params.set("sortierung", active && sort.dir === "asc" ? `-${sortKey}` : sortKey);
  params.delete("seite");
  return (
    <th
      className={cn(
        "sticky top-0 z-10 border-b border-border bg-muted px-2 py-2 font-medium",
        className,
      )}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link
        href={`${pathname}?${params.toString()}`}
        scroll={false}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {children}
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUpIcon className="h-3 w-3" />
          ) : (
            <ChevronDownIcon className="h-3 w-3" />
          )
        ) : null}
      </Link>
    </th>
  );
}

/** Text in der Zelle: Klick oder Enter bearbeitet, Enter/Verlassen speichert, Esc verwirft. */
function InlineText({
  value,
  label,
  disabled,
  onSave,
}: {
  value: string;
  label: string;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const done = React.useRef(false);
  if (draft === null) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          done.current = false;
          setDraft(value);
        }}
        className="block w-full cursor-text truncate rounded px-1 py-0.5 text-left font-medium text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:font-normal disabled:text-muted-foreground disabled:hover:bg-transparent"
        title={value}
      >
        {value}
      </button>
    );
  }
  const commit = () => {
    if (done.current) return;
    done.current = true;
    const next = draft.trim();
    setDraft(null);
    if (next && next !== value) onSave(next);
  };
  return (
    <input
      autoFocus
      aria-label={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") {
          done.current = true;
          setDraft(null);
        }
      }}
      className="h-7 w-full rounded border border-primary bg-background px-1 text-sm outline-none"
    />
  );
}

function InlineSelect({
  value,
  label,
  display,
  options,
  disabled,
  muted,
  onSave,
}: {
  value: string;
  label: string;
  display: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  muted?: boolean;
  onSave: (value: string) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => next !== value && onSave(next)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-7 w-full gap-1 border-transparent bg-transparent px-1 shadow-none hover:border-border hover:bg-muted disabled:opacity-100 [&>svg]:opacity-0 group-hover:[&>svg]:opacity-60",
          muted && "text-muted-foreground",
        )}
      >
        <SelectValue>{display}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SelectionActions({
  selected,
  areas,
  placementOptions,
  canManage,
  onClear,
  onDone,
}: {
  selected: InventoryListItem[];
  areas: AreaOption[];
  placementOptions: PlacementOptions;
  canManage: boolean;
  onClear: () => void;
  onDone: (
    result: { ok: true; message?: string; data: BulkOutcome } | { ok: false; error: string },
  ) => boolean;
}) {
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [target, setTarget] = React.useState<PlacementTarget>({ type: "none" });
  const [retireOpen, setRetireOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const ids = selected.map((item) => item.id);
  const areaIds = new Set(selected.map((item) => item.areaId));
  // Kategorien gibt es je Bereich – gemeinsam setzen nur bei einem Bereich.
  const sharedArea = areaIds.size === 1 ? areas.find((area) => areaIds.has(area.id)) : undefined;

  const run = async (
    action: () => Promise<
      { ok: true; message?: string; data: BulkOutcome } | { ok: false; error: string }
    >,
  ) => {
    setBusy(true);
    try {
      return onDone(await action());
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BulkActionBar count={selected.length} noun={["Objekt", "Objekte"]} onClear={onClear}>
        <Button size="sm" variant="outline" onClick={() => setMoveOpen(true)} disabled={busy}>
          <ArrowRightLeftIcon className="mr-2 h-4 w-4" />
          Umlagern
        </Button>
        <Select
          value={KEEP}
          disabled={busy || !sharedArea}
          onValueChange={(value) =>
            run(() => bulkUpdateAssetsAction(ids, { categoryId: value === NONE ? null : value }))
          }
        >
          <SelectTrigger
            className="h-8 w-40"
            aria-label="Kategorie setzen"
            title={sharedArea ? undefined : "Nur bei Objekten aus einem Bereich"}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={KEEP} disabled>
              Kategorie setzen
            </SelectItem>
            <SelectItem value={NONE}>Ohne Kategorie</SelectItem>
            {(sharedArea?.categories ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={KEEP}
          disabled={busy}
          onValueChange={(value) => run(() => bulkUpdateAssetsAction(ids, { condition: value }))}
        >
          <SelectTrigger className="h-8 w-36" aria-label="Zustand setzen">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={KEEP} disabled>
              Zustand setzen
            </SelectItem>
            {CONDITIONS.map((condition) => (
              <SelectItem key={condition} value={condition}>
                {CONDITION_LABELS[condition]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button asChild size="sm" variant="outline">
          <Link
            href={`${INVENTORY_BASE_PATH}/etiketten?codes=${encodeURIComponent(selected.map((item) => item.code).join(","))}`}
          >
            <PrinterIcon className="mr-2 h-4 w-4" />
            Etiketten
          </Link>
        </Button>
        {canManage ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setRetireOpen(true)}
            disabled={busy}
          >
            <ArchiveIcon className="mr-2 h-4 w-4" />
            Ausmustern
          </Button>
        ) : null}
      </BulkActionBar>

      <ModalFormDialog
        title={`${selected.length} ${selected.length === 1 ? "Objekt" : "Objekte"} umlagern`}
        description="Mengenartikel werden übersprungen – ihr Bestand wird auf der Objektseite umgelagert."
        open={moveOpen}
        onOpenChange={setMoveOpen}
        footer={
          <AsyncButton
            isLoading={busy}
            disabled={target.type === "none"}
            onClick={async () => {
              if (target.type === "none") return;
              const ok = await run(() => bulkMoveAssetsAction(ids, target));
              if (ok) setMoveOpen(false);
            }}
          >
            Umlagern
          </AsyncButton>
        }
      >
        <PlacementPicker
          value={target}
          onChange={setTarget}
          options={placementOptions}
          allowNone={false}
        />
      </ModalFormDialog>

      <ConfirmDialog
        title={`${selected.length} ${selected.length === 1 ? "Objekt" : "Objekte"} ausmustern?`}
        description="Ort, Kiste und Bestand werden frei. Ausgemusterte Objekte bleiben zur Ansicht erhalten und lassen sich einzeln wieder aufnehmen."
        confirmLabel="Ausmustern"
        cancelLabel="Abbrechen"
        variant="destructive"
        open={retireOpen}
        onOpenChange={setRetireOpen}
        onCancel={() => setRetireOpen(false)}
        onConfirm={async () => {
          setRetireOpen(false);
          const ok = await run(() => bulkRetireAssetsAction(ids));
          if (ok) onClear();
        }}
      />
    </>
  );
}
