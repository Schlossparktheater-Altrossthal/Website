"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { DataPortalChart } from "./data-portal-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DATA_SOURCE_LABELS,
  FIELD_GROUP_LABELS,
  FILTER_OPERATOR_LABELS,
  OPERATORS_BY_TYPE,
  type DataSource,
  type FieldGroup,
  type FieldType,
  type FilterOperator,
} from "@/lib/datenportal/fields";

type PortalField = { key: string; label: string; group: FieldGroup; type: FieldType };
export type PortalShow = {
  id: string;
  label: string;
  canExport: boolean;
  fields: Partial<Record<DataSource, PortalField[]>>;
};

type FilterState = { field: string; op: FilterOperator; value: string };
type ResultCell = string | number | boolean | null;
type QueryResult = {
  columns: PortalField[];
  rows: Record<string, ResultCell>[];
  total: number;
  truncated: boolean;
};

type Preset = {
  label: string;
  source: DataSource;
  columns: string[];
  filters: FilterState[];
  groupBy?: string;
};

const PRESETS: Preset[] = [
  {
    label: "Teilnehmerliste",
    source: "participants",
    columns: ["name", "roles", "function", "status"],
    filters: [],
  },
  {
    label: "Allergien",
    source: "allergies",
    columns: ["name", "allergen", "level", "symptoms", "treatment"],
    filters: [],
  },
  {
    label: "Schüler:innen nach Schule",
    source: "participants",
    columns: ["name", "school", "schoolClass", "age"],
    filters: [{ field: "educationCategory", op: "equals", value: "Schule" }],
  },
  {
    label: "Anzahl je Schule",
    source: "participants",
    columns: [],
    filters: [],
    groupBy: "school",
  },
  {
    label: "Allergene im Überblick",
    source: "allergies",
    columns: [],
    filters: [],
    groupBy: "allergen",
  },
  {
    label: "Fotoerlaubnisse",
    source: "participants",
    columns: ["name", "photoConsent", "age"],
    filters: [],
  },
];

function formatCell(value: ResultCell, type: FieldType): string {
  if (value === null || value === "") return "";
  if (typeof value === "boolean") return value ? "ja" : "nein";
  if (type === "date" && typeof value === "string") {
    return new Date(value).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  }
  return String(value);
}

const selectClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function DataPortalClient({ shows }: { shows: PortalShow[] }) {
  const [showId, setShowId] = useState(shows[0].id);
  const show = shows.find((entry) => entry.id === showId) ?? shows[0];
  const sources = Object.keys(show.fields) as DataSource[];
  const [source, setSource] = useState<DataSource>(sources[0]);
  const activeSource = show.fields[source] ? source : sources[0];
  const fields = useMemo(() => show.fields[activeSource] ?? [], [show, activeSource]);
  const [columns, setColumns] = useState<string[]>(["name"]);
  const [filters, setFilters] = useState<FilterState[]>([]);
  const [groupBy, setGroupBy] = useState("");
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fieldKeys = new Set(fields.map((field) => field.key));
  const activeColumns = columns.filter((key) => fieldKeys.has(key));
  const activeGroupBy = fieldKeys.has(groupBy) ? groupBy : "";
  const activeFilters = filters.filter((filter) => fieldKeys.has(filter.field));

  function applyPreset(preset: Preset) {
    if (!show.fields[preset.source]) return;
    const keys = new Set((show.fields[preset.source] ?? []).map((field) => field.key));
    setSource(preset.source);
    setColumns(preset.columns.filter((key) => keys.has(key)));
    setFilters(preset.filters.filter((filter) => keys.has(filter.field)));
    setGroupBy(preset.groupBy && keys.has(preset.groupBy) ? preset.groupBy : "");
    setResult(null);
  }

  function buildBody(format: "json" | "csv" | "xlsx" | "pdf") {
    return JSON.stringify({
      source: activeSource,
      showId,
      columns: activeGroupBy ? [] : activeColumns,
      groupBy: activeGroupBy || undefined,
      filters: activeFilters.map((filter) => ({
        field: filter.field,
        op: filter.op,
        value: filter.value || undefined,
      })),
      includeInactive,
      format,
    });
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/datenportal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildBody("json"),
      });
      if (!response.ok) {
        setResult(null);
        setError("Abfrage nicht möglich (fehlende Berechtigung oder ungültige Filter).");
        return;
      }
      setResult((await response.json()) as QueryResult);
    } finally {
      setBusy(false);
    }
  }

  async function exportFile(format: "csv" | "xlsx" | "pdf") {
    setBusy(true);
    try {
      const response = await fetch("/api/datenportal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildBody(format),
      });
      if (!response.ok) {
        setError("Export nicht möglich.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `datenportal-${activeSource}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  function toggleColumn(key: string) {
    setColumns((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );
  }

  const resultGrouped = result?.columns.some((column) => column.key === "count") ?? false;

  const grouped = (Object.keys(FIELD_GROUP_LABELS) as FieldGroup[])
    .map((group) => ({ group, items: fields.filter((field) => field.group === group) }))
    .filter((entry) => entry.items.length > 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Abfrage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {PRESETS.filter((preset) => show.fields[preset.source]).map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Produktion</span>
              <select
                className={`${selectClass} w-full`}
                value={showId}
                onChange={(event) => {
                  setShowId(event.target.value);
                  setResult(null);
                }}
              >
                {shows.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Datenquelle</span>
              <select
                className={`${selectClass} w-full`}
                value={activeSource}
                onChange={(event) => {
                  setSource(event.target.value as DataSource);
                  setResult(null);
                }}
              >
                {sources.map((entry) => (
                  <option key={entry} value={entry}>
                    {DATA_SOURCE_LABELS[entry]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">
              Gruppieren nach (zeigt Anzahl je Wert als Diagramm)
            </span>
            <select
              className={`${selectClass} w-full sm:w-80`}
              value={activeGroupBy}
              onChange={(event) => {
                setGroupBy(event.target.value);
                setResult(null);
              }}
            >
              <option value="">Keine – Einzelzeilen</option>
              {fields
                .filter((field) => field.type !== "date")
                .map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
            </select>
          </label>

          <div className={cn("space-y-2", activeGroupBy && "hidden")}>
            <p className="text-sm font-medium">Spalten</p>
            {grouped.map(({ group, items }) => (
              <div key={group} className="space-y-1">
                <p className="text-xs text-muted-foreground">{FIELD_GROUP_LABELS[group]}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {items.map((field) => (
                    <label key={field.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={activeColumns.includes(field.key)}
                        onChange={() => toggleColumn(field.key)}
                      />
                      {field.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Filter (alle müssen zutreffen)</p>
            {activeFilters.map((filter, index) => {
              const field = fields.find((entry) => entry.key === filter.field) ?? fields[0];
              const operators = OPERATORS_BY_TYPE[field.type];
              const needsValue = filter.op !== "isEmpty" && filter.op !== "notEmpty";
              const update = (patch: Partial<FilterState>) =>
                setFilters(
                  activeFilters.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
                );
              return (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <select
                    className={selectClass}
                    value={filter.field}
                    onChange={(event) => {
                      const next =
                        fields.find((entry) => entry.key === event.target.value) ?? field;
                      update({ field: next.key, op: OPERATORS_BY_TYPE[next.type][0], value: "" });
                    }}
                  >
                    {fields.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectClass}
                    value={filter.op}
                    onChange={(event) => update({ op: event.target.value as FilterOperator })}
                  >
                    {operators.map((op) => (
                      <option key={op} value={op}>
                        {FILTER_OPERATOR_LABELS[op]}
                      </option>
                    ))}
                  </select>
                  {field.type === "boolean" ? (
                    <select
                      className={selectClass}
                      value={filter.value || "true"}
                      onChange={(event) => update({ value: event.target.value })}
                    >
                      <option value="true">ja</option>
                      <option value="false">nein</option>
                    </select>
                  ) : needsValue ? (
                    <Input
                      className="w-56"
                      type={
                        field.type === "date" ? "date" : field.type === "number" ? "number" : "text"
                      }
                      value={filter.value}
                      onChange={(event) => update({ value: event.target.value })}
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(activeFilters.filter((_, i) => i !== index))}
                  >
                    Entfernen
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setFilters([
                  ...activeFilters,
                  { field: fields[0].key, op: OPERATORS_BY_TYPE[fields[0].type][0], value: "" },
                ])
              }
            >
              Filter hinzufügen
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Ausgetretene und deaktivierte Personen einbeziehen
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={run}
              disabled={busy || (activeColumns.length === 0 && !activeGroupBy)}
            >
              Auswerten
            </Button>
            {show.canExport ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => exportFile("xlsx")}
                  disabled={busy || (activeColumns.length === 0 && !activeGroupBy)}
                >
                  Excel exportieren
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => exportFile("csv")}
                  disabled={busy || (activeColumns.length === 0 && !activeGroupBy)}
                >
                  CSV exportieren
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => exportFile("pdf")}
                  disabled={busy || (activeColumns.length === 0 && !activeGroupBy)}
                >
                  PDF exportieren
                </Button>
              </>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {result.total} {result.total === 1 ? "Ergebnis" : "Ergebnisse"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resultGrouped ? (
              <div className="mb-4 space-y-2">
                <div className="flex gap-2">
                  {(["bar", "pie"] as const).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant={chartType === type ? "default" : "outline"}
                      onClick={() => setChartType(type)}
                    >
                      {type === "bar" ? "Balken" : "Kreis"}
                    </Button>
                  ))}
                </div>
                <DataPortalChart
                  type={chartType}
                  data={result.rows.map((row) => ({
                    name: String(row.group ?? ""),
                    value: Number(row.count ?? 0),
                  }))}
                />
              </div>
            ) : null}
            {result.truncated ? (
              <p className="mb-2 text-sm text-warning">
                Anzeige gekürzt, der Export enthält alle Zeilen.
              </p>
            ) : null}
            <div className={cn("overflow-x-auto", !resultGrouped && "hidden md:block")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((column) => (
                      <TableHead key={column.key}>{column.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, index) => (
                    <TableRow key={index}>
                      {result.columns.map((column) => (
                        <TableCell key={column.key}>
                          {formatCell(row[column.key], column.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className={cn("space-y-3 md:hidden", resultGrouped && "hidden")}>
              {result.rows.map((row, index) => (
                <li key={index} className="rounded-lg border border-border/70 p-3">
                  <dl className="space-y-1 text-sm">
                    {result.columns.map((column, columnIndex) => (
                      <div key={column.key} className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{column.label}</dt>
                        <dd
                          className={cn(
                            "break-words text-right",
                            columnIndex === 0 && "font-medium",
                          )}
                        >
                          {formatCell(row[column.key], column.type) || "–"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
