"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { bulkCreateAssetsAction } from "@/app/(members)/mitglieder/lager/actions/assets";
import { SpreadsheetGrid, type GridSelection } from "@/components/inventory/spreadsheet-grid";
import {
  AlertCircleIcon,
  CopyIcon,
  KeyboardIcon,
  LayersIcon,
  PrinterIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { AssetFormArea } from "@/lib/inventory/asset-form-values";
import {
  bulkColumns,
  duplicateRow,
  isBlankRow,
  rowFromPresets,
  validateRow,
  type BulkContext,
  type BulkPlacementOptions,
  type DraftRow,
  type Presets,
} from "@/lib/inventory/bulk-grid";
import {
  ASSET_KIND_LABELS,
  ASSET_KINDS,
  CONDITION_LABELS,
  CONDITIONS,
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
  MAX_BULK_ROWS,
} from "@/lib/inventory/constants";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lager:sammelerfassung:v1";
const COLUMNS_KEY = "lager:sammelerfassung:spalten:v1";
const NONE = "__none__";
/** Fehler, die erst nach dem ersten Speicherversuch auffallen sollen (beim Tippen stören sie). */
const LATE_ERRORS = new Set(["name", "area"]);

type Draft = { areaId: string; mixed: boolean; presets: Presets; rows: DraftRow[] };

function readStorage<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Privater Modus o. Ä. – Entwürfe gehen dann beim Neuladen verloren.
  }
}

let idCounter = 0;
const newId = () => `r${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/**
 * Sammelerfassung am Desktop: viele Objekte als Tabelle eintragen und in einem Rutsch anlegen.
 * Zeilen sind Entwürfe im Browser, Codes gibt es erst beim Speichern.
 */
export function BulkCapture({
  areas,
  placement,
  canManage,
}: {
  areas: AssetFormArea[];
  placement: BulkPlacementOptions;
  canManage: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<Draft>(() => ({
    areaId: areas[0]?.id ?? "",
    mixed: false,
    presets: {},
    rows: [],
  }));
  const [loaded, setLoaded] = React.useState(false);
  const [hidden, setHidden] = React.useState<Record<string, string[]>>({});
  const [showAllErrors, setShowAllErrors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [selection, setSelection] = React.useState<GridSelection>({
    rowStart: 0,
    rowEnd: 0,
    colStart: 0,
    colEnd: 0,
  });
  const [copies, setCopies] = React.useState("5");
  const gridRef = React.useRef<{ focusCell: (row: number, col: number) => void }>(null);

  // Entwürfe erst nach dem Mounten lesen – der Server kennt den Browserspeicher nicht.
  React.useEffect(() => {
    const stored = readStorage<Draft>(STORAGE_KEY);
    if (stored && Array.isArray(stored.rows)) {
      setDraft({
        ...stored,
        areaId: areas.some((area) => area.id === stored.areaId)
          ? stored.areaId
          : (areas[0]?.id ?? ""),
      });
    }
    setHidden(readStorage<Record<string, string[]>>(COLUMNS_KEY) ?? {});
    setLoaded(true);
  }, [areas]);

  React.useEffect(() => {
    if (loaded) writeStorage(STORAGE_KEY, draft);
  }, [draft, loaded]);

  const { areaId, mixed, presets, rows } = draft;
  const area = areas.find((entry) => entry.id === areaId);
  const ctx: BulkContext = React.useMemo(
    () => ({ areas, placement, canManage, mixed, areaId }),
    [areas, placement, canManage, mixed, areaId],
  );

  const allColumns = React.useMemo(() => bulkColumns(ctx), [ctx]);
  const columnsKey = mixed ? "mixed" : (area?.prefix ?? "");
  const hiddenKeys = hidden[columnsKey];
  const columns = allColumns.filter((column) =>
    !column.hideable ? true : hiddenKeys ? !hiddenKeys.includes(column.key) : column.defaultVisible,
  );

  const toggleColumn = (key: string, visible: boolean) => {
    const current =
      hiddenKeys ??
      allColumns.filter((column) => column.hideable && !column.defaultVisible).map((c) => c.key);
    const next = {
      ...hidden,
      [columnsKey]: visible ? current.filter((entry) => entry !== key) : [...current, key],
    };
    setHidden(next);
    writeStorage(COLUMNS_KEY, next);
  };

  const effectivePresets: Presets = React.useMemo(
    () => (mixed ? { area: presets.area ?? areaId, ...presets } : presets),
    [mixed, presets, areaId],
  );
  const newRow = React.useCallback(
    () => rowFromPresets(newId(), effectivePresets),
    [effectivePresets],
  );

  const setRows = (next: DraftRow[]) => setDraft((current) => ({ ...current, rows: next }));
  const setPreset = (key: keyof Presets, value: string) =>
    setDraft((current) => ({
      ...current,
      presets: {
        ...current.presets,
        [key]: value === NONE ? undefined : value,
        // Kategorien gehören zum Bereich.
        ...(key === "area" ? { category: undefined } : {}),
      },
    }));

  const pending = rows.filter((row) => !row.savedCode && !isBlankRow(row, effectivePresets));
  const validations = React.useMemo(
    () => new Map(rows.map((row) => [row.id, validateRow(row, ctx)])),
    [rows, ctx],
  );
  const errors = React.useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    for (const row of rows) {
      if (row.savedCode || isBlankRow(row, effectivePresets)) continue;
      const rowErrors = Object.fromEntries(
        Object.entries(validations.get(row.id)?.errors ?? {}).filter(
          ([key]) => showAllErrors || !LATE_ERRORS.has(key),
        ),
      );
      if (Object.keys(rowErrors).length) map.set(row.id, rowErrors);
    }
    return map;
  }, [rows, validations, showAllErrors, effectivePresets]);
  const invalidCount = pending.filter((row) => validations.get(row.id)?.input === null).length;
  const savedCodes = rows.flatMap(
    (row) => row.savedCodes ?? (row.savedCode ? [row.savedCode] : []),
  );

  const jumpToFirstError = () => {
    setShowAllErrors(true);
    const index = rows.findIndex(
      (row) =>
        !row.savedCode && !isBlankRow(row, effectivePresets) && !validations.get(row.id)?.input,
    );
    if (index < 0) return;
    const rowErrors = validations.get(rows[index]!.id)?.errors ?? {};
    const col = Math.max(
      0,
      columns.findIndex((column) => column.key in rowErrors),
    );
    gridRef.current?.focusCell(index, col);
  };

  const save = async () => {
    if (saving) return;
    setShowAllErrors(true);
    const valid = pending.filter((row) => validations.get(row.id)?.input);
    if (!valid.length) {
      toast.error(pending.length ? "Keine Zeile ist vollständig." : "Noch nichts eingetragen.");
      if (pending.length) jumpToFirstError();
      return;
    }
    setSaving(true);
    try {
      const results = new Map<string, { codes?: string[]; error?: string }>();
      for (let start = 0; start < valid.length; start += MAX_BULK_ROWS) {
        const chunk = valid.slice(start, start + MAX_BULK_ROWS);
        const response = await bulkCreateAssetsAction(
          chunk.map((row) => validations.get(row.id)!.input),
        );
        if (!response.ok) {
          toast.error(response.error);
          break;
        }
        for (const result of response.data.results) {
          const row = chunk[result.index]!;
          results.set(row.id, result.ok ? { codes: result.codes } : { error: result.error });
        }
      }
      setDraft((current) => ({
        ...current,
        rows: current.rows.map((row) => {
          const result = results.get(row.id);
          if (!result) return row;
          return result.codes
            ? {
                ...row,
                savedCode: result.codes[0],
                savedCodes: result.codes,
                serverError: undefined,
              }
            : { ...row, serverError: result.error };
        }),
      }));
      const created = [...results.values()].reduce(
        (sum, result) => sum + (result.codes?.length ?? 0),
        0,
      );
      const failed = results.size - created;
      if (created) {
        toast.success(
          `${created} ${created === 1 ? "Objekt" : "Objekte"} angelegt` +
            (failed || invalidCount ? ` – ${failed + invalidCount} Zeilen noch offen.` : "."),
        );
        router.refresh();
      } else if (failed) {
        toast.error("Keine Zeile konnte angelegt werden.");
      }
    } finally {
      setSaving(false);
    }
  };

  const duplicate = () => {
    const count = Math.min(200, Math.max(1, Number(copies) || 0));
    const index = selection.rowStart;
    const source = rows[index];
    if (!source) {
      toast.error("Erst eine Zeile wählen.");
      return;
    }
    const clones = Array.from({ length: count }, () => duplicateRow(source, newId()));
    setRows([...rows.slice(0, index + 1), ...clones, ...rows.slice(index + 1)]);
    toast.success(`${count}× dupliziert.`);
  };

  const removeSelectedRows = () => {
    const end = Math.min(selection.rowEnd, rows.length - 1);
    if (selection.rowStart > end) return;
    setRows([...rows.slice(0, selection.rowStart), ...rows.slice(end + 1)]);
  };

  const finishRound = () => {
    setRows(rows.filter((row) => !row.savedCode && !isBlankRow(row, effectivePresets)));
    setShowAllErrors(false);
  };

  const presetCategories = areas.find(
    (entry) => entry.id === (mixed ? (effectivePresets.area ?? areaId) : areaId),
  )?.categories;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Bereich</Label>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Bereich">
            {areas.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={!mixed && entry.id === areaId}
                disabled={mixed}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    areaId: entry.id,
                    presets: { ...current.presets, category: undefined },
                  }))
                }
                className={cn(
                  "h-8 rounded-md border px-2.5 text-sm font-medium transition-colors disabled:opacity-40",
                  !mixed && entry.id === areaId
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                title={entry.name}
              >
                <span className="mr-1 font-mono text-xs">{entry.prefix}</span>
                {entry.name}
              </button>
            ))}
          </div>
        </div>
        <label className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
          <Switch
            checked={mixed}
            onCheckedChange={(checked) => setDraft((current) => ({ ...current, mixed: checked }))}
          />
          Gemischt (Bereich je Zeile)
        </label>

        <div className="hidden h-8 w-px bg-border xl:block" />

        <div className="flex flex-wrap items-end gap-2">
          <span className="pb-1.5 text-xs font-medium text-muted-foreground">Vorgaben</span>
          {mixed ? (
            <PresetSelect
              label="Bereich"
              value={effectivePresets.area}
              onChange={(value) => setPreset("area", value)}
              options={areas.map((entry) => ({ value: entry.id, label: entry.name }))}
              allowNone={false}
            />
          ) : null}
          <PresetSelect
            label="Kategorie"
            value={presets.category}
            onChange={(value) => setPreset("category", value)}
            options={(presetCategories ?? []).map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
          <PresetSelect
            label="Art"
            value={presets.kind}
            onChange={(value) => setPreset("kind", value)}
            options={ASSET_KINDS.map((kind) => ({ value: kind, label: ASSET_KIND_LABELS[kind] }))}
            noneLabel={ASSET_KIND_LABELS.unique}
          />
          <PresetSelect
            label="Zustand"
            value={presets.condition}
            onChange={(value) => setPreset("condition", value)}
            options={CONDITIONS.map((condition) => ({
              value: condition,
              label: CONDITION_LABELS[condition],
            }))}
            noneLabel={CONDITION_LABELS.good}
          />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ort / Kiste</Label>
            <Select
              value={presets.placement ?? NONE}
              onValueChange={(value) => setPreset("placement", value)}
            >
              <SelectTrigger className="h-8 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Noch kein Ort</SelectItem>
                {placement.locations.length ? (
                  <SelectGroup>
                    <SelectLabel>Lagerorte</SelectLabel>
                    {placement.locations.map((location) => (
                      <SelectItem key={location.id} value={`location:${location.id}`}>
                        {location.code} · {location.path}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
                {placement.containers.length ? (
                  <SelectGroup>
                    <SelectLabel>Kisten</SelectLabel>
                    {placement.containers.map((container) => (
                      <SelectItem key={container.id} value={`container:${container.id}`}>
                        {container.code} · {container.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{pending.length}</span>{" "}
          {pending.length === 1 ? "Entwurf" : "Entwürfe"}
          {invalidCount ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={jumpToFirstError}
                className="inline-flex items-center gap-1 font-medium text-destructive hover:underline"
              >
                <AlertCircleIcon className="h-3.5 w-3.5" />
                {invalidCount} unvollständig
              </button>
            </>
          ) : null}
          {savedCodes.length ? ` · ${savedCodes.length} angelegt` : null}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={!rows[selection.rowStart]}>
                <CopyIcon className="mr-2 h-4 w-4" />
                Duplizieren
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-2" align="end">
              <p className="text-sm">
                Zeile {selection.rowStart + 1} mehrfach einfügen – z. B. für gleiche Scheinwerfer,
                jeder bekommt einen eigenen Code.
              </p>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  duplicate();
                }}
              >
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={copies}
                  onChange={(event) => setCopies(event.target.value)}
                  className="h-8 w-20"
                  aria-label="Anzahl Kopien"
                />
                <Button type="submit" size="sm">
                  ×{Math.max(1, Number(copies) || 1)} einfügen
                </Button>
              </form>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={removeSelectedRows}
            disabled={selection.rowStart >= rows.length}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            {selection.rowEnd > selection.rowStart ? "Zeilen löschen" : "Zeile löschen"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <LayersIcon className="mr-2 h-4 w-4" />
                Spalten
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allColumns
                .filter((column) => column.hideable)
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={columns.includes(column)}
                    onCheckedChange={(checked) => toggleColumn(column.key, checked)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <AsyncButton
            size="sm"
            onClick={save}
            isLoading={saving}
            loadingText="Lege an …"
            disabled={!pending.length}
          >
            {pending.length ? `${pending.length - invalidCount} anlegen` : "Anlegen"}
            <kbd className="ml-2 hidden rounded bg-primary-foreground/20 px-1 text-[10px] xl:inline">
              Strg+↵
            </kbd>
          </AsyncButton>
        </div>
      </div>

      {savedCodes.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">
            {savedCodes.length} {savedCodes.length === 1 ? "Objekt" : "Objekte"} angelegt
          </span>
          <span className="text-muted-foreground">
            ({savedCodes[0]}
            {savedCodes.length > 1 ? ` … ${savedCodes[savedCodes.length - 1]}` : ""})
          </span>
          <div className="ml-auto flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link
                href={`${INVENTORY_BASE_PATH}/etiketten?codes=${encodeURIComponent(savedCodes.join(","))}`}
              >
                <PrinterIcon className="mr-2 h-4 w-4" />
                Etiketten drucken
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={finishRound}>
              Angelegte ausblenden
            </Button>
          </div>
        </div>
      ) : null}

      {loaded ? (
        <SpreadsheetGrid
          gridRef={gridRef}
          columns={columns}
          rows={rows}
          onRowsChange={setRows}
          newRow={newRow}
          errors={errors}
          onSelectionChange={setSelection}
          onSubmit={save}
          className="max-h-[calc(100dvh-22rem)] min-h-64"
          renderRowHeader={(row, index) =>
            row?.savedCode ? (
              <Link
                href={inventoryAssetPath(row.savedCode)}
                className="font-mono text-success hover:underline"
                onMouseDown={(event) => event.stopPropagation()}
                target="_blank"
              >
                {row.savedCode}
                {row.savedCodes && row.savedCodes.length > 1
                  ? ` +${row.savedCodes.length - 1}`
                  : ""}
              </Link>
            ) : row ? (
              <span className="flex items-center gap-1">
                {row.serverError || errors.has(row.id) ? (
                  <AlertCircleIcon className="h-3 w-3 shrink-0 text-destructive" />
                ) : null}
                {index + 1}
              </span>
            ) : (
              <span className="text-muted-foreground/60">+</span>
            )
          }
        />
      ) : (
        <Skeleton className="h-64 w-full rounded-lg" />
      )}

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <KeyboardIcon className="h-3.5 w-3.5" />
        <span>Tippen oder Enter bearbeitet</span>
        <span>Enter/Tab übernimmt und springt weiter</span>
        <span>Strg+D füllt nach unten</span>
        <span>Strg+V fügt aus Excel ein</span>
        <span>Entf leert</span>
        <span>Strg+Z rückgängig</span>
        <span>Ort auch per Code oder Hand-Scanner</span>
      </p>
    </div>
  );
}

function PresetSelect({
  label,
  value,
  onChange,
  options,
  noneLabel = "–",
  allowNone = true,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  noneLabel?: string;
  allowNone?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value ?? NONE} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowNone ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
