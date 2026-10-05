"use client";

import * as React from "react";

import { ChevronDownIcon } from "@/components/ui/action-icons";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AssetFormArea, ProductFormValues } from "@/lib/inventory/asset-form-values";
import {
  ASSET_KIND_HINTS,
  ASSET_KIND_LABELS,
  PRODUCT_KINDS,
  type ProductKind,
} from "@/lib/inventory/constants";
import { CategoryPicker, shortPath } from "@/components/inventory/category-picker";
import { TagInput } from "@/components/inventory/tag-input";
import {
  catalogFields,
  categoryPath,
  dimensionUnit,
  formatLength,
  parseDimensions,
  parseMeasure,
  formatMeasure,
  type FieldDef,
} from "@/lib/inventory/specs";
import { cn } from "@/lib/utils";

const NONE = "__none__";

const SHORT_KIND_LABELS: Record<ProductKind, string> = {
  unique: "Gerät / Stück",
  bulk: "Menge",
  container: "Kiste",
  set: "Set",
};

/**
 * Stammdaten eines Artikeltyps – gemeinsam für Erfassen (neuer Typ) und „Typ bearbeiten“.
 * Kompakt: Bereich und Kategorie als Auswahl, Merkmale der Kategorie zweispaltig, Seltenes
 * zum Aufklappen.
 */
export function ProductFields({
  values,
  onChange,
  areas,
  mode,
  nameRef,
  canCreateCategory = false,
}: {
  values: ProductFormValues;
  onChange: (values: ProductFormValues) => void;
  areas: AssetFormArea[];
  mode: "create" | "edit";
  nameRef?: React.Ref<HTMLInputElement>;
  /** Darf neue Kategorien direkt aus der Auswahl anlegen (Katalog-Recht). */
  canCreateCategory?: boolean;
}) {
  const area = areas.find((entry) => entry.id === values.areaId);
  const fields = catalogFields(area, values.categoryId);
  const [moreOpen, setMoreOpen] = React.useState(Boolean(values.description || values.publicNote));
  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    onChange({ ...values, [key]: value });
  const bulk = values.kind === "bulk";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Kategorie</Label>
        <CategoryPicker
          areas={areas}
          value={{ areaId: values.areaId, categoryId: values.categoryId }}
          lockedAreaId={mode === "edit" ? values.areaId : null}
          nameHint={values.name}
          canCreate={canCreateCategory}
          onChange={({ areaId, categoryId }) => {
            const next = areas.find((entry) => entry.id === areaId);
            const areaChanged = areaId !== values.areaId;
            onChange({
              ...values,
              areaId,
              categoryId,
              ...(areaChanged
                ? {
                    specs: {},
                    inspectionRequired:
                      values.kind === "unique" ? (next?.inspectionDefault ?? false) : false,
                  }
                : {}),
            });
          }}
        />
        {mode === "edit" ? (
          <p className="text-xs text-muted-foreground">
            Der Bereich ({area?.name}) bestimmt die Codes und bleibt fest.
          </p>
        ) : null}
      </div>

      {mode === "create" ? (
        <div className="space-y-1.5">
          <SegmentedControl
            aria-label="Art"
            value={values.kind}
            onValueChange={(kind: ProductKind) =>
              // Prüfpflicht betrifft Geräte – Kisten und Mengenartikel standardmäßig nicht.
              onChange({
                ...values,
                kind,
                inspectionRequired: kind === "unique" ? (area?.inspectionDefault ?? false) : false,
              })
            }
            fullWidth
            options={PRODUCT_KINDS.map((kind) => ({
              value: kind,
              label: SHORT_KIND_LABELS[kind],
              ariaLabel: ASSET_KIND_LABELS[kind],
            }))}
          />
          <p className="text-xs text-muted-foreground">{ASSET_KIND_HINTS[values.kind]}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <div className="space-y-1.5 sm:col-span-6">
          <Label htmlFor="product-name">Name</Label>
          <Input
            id="product-name"
            ref={nameRef}
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder={
              values.kind === "container"
                ? "z. B. Kabelkiste"
                : area?.prefix === "K"
                  ? "z. B. Gehrock dunkelblau"
                  : "z. B. Profilscheinwerfer 750 W"
            }
            required
            autoComplete="off"
          />
        </div>
        {!bulk ? (
          <>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="product-manufacturer">Hersteller</Label>
              <Input
                id="product-manufacturer"
                value={values.manufacturer}
                onChange={(event) => set("manufacturer", event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="product-model">Modell</Label>
              <Input
                id="product-model"
                value={values.model}
                onChange={(event) => set("model", event.target.value)}
                autoComplete="off"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="product-unit">Einheit</Label>
              <Input
                id="product-unit"
                value={values.unit}
                onChange={(event) => set("unit", event.target.value)}
                placeholder="Stk., m, Rollen"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="product-min">Mindestbestand</Label>
              <Input
                id="product-min"
                type="number"
                inputMode="numeric"
                min={0}
                value={values.minQuantity}
                onChange={(event) => set("minQuantity", event.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {fields.length ? (
        <fieldset className="space-y-3 rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Merkmale{" "}
            {values.categoryId
              ? `· ${shortPath(categoryPath(area?.categories ?? [], values.categoryId).map((entry) => entry.name))}`
              : area
                ? `· ${area.name}`
                : ""}
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <SpecField
                key={field.key}
                field={field}
                value={values.specs[field.key]}
                onChange={(value) => set("specs", { ...values.specs, [field.key]: value })}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="product-tags">Tags</Label>
        <TagInput value={values.tags} onChange={(tags) => set("tags", tags)} />
        <p className="text-xs text-muted-foreground">
          Für Querliegendes wie Epoche, Farbe oder Anschluss – mit Komma oder Enter trennen.
        </p>
      </div>

      {!bulk && values.kind !== "set" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <label htmlFor="product-inspection" className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Prüfpflichtig</span>
            <span className="block text-xs text-muted-foreground">Elektroprüfung nach DGUV V3</span>
          </label>
          <div className="flex items-center gap-2">
            {values.inspectionRequired ? (
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                alle
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  className="h-9 w-16"
                  value={values.inspectionIntervalMonths}
                  onChange={(event) => set("inspectionIntervalMonths", event.target.value)}
                  aria-label="Prüfintervall in Monaten"
                />
                Monate
              </label>
            ) : null}
            <Switch
              id="product-inspection"
              checked={values.inspectionRequired}
              onCheckedChange={(checked) => set("inspectionRequired", checked)}
              aria-label="Prüfpflichtig"
            />
          </div>
        </div>
      ) : null}

      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronDownIcon
            className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")}
          />
          Beschreibung und Hinweis
        </CollapsibleTrigger>
        <CollapsibleContent className="grid grid-cols-1 gap-4 pt-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="product-description">Beschreibung</Label>
            <Textarea
              id="product-description"
              rows={3}
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-public-note">Öffentlicher Hinweis</Label>
            <Textarea
              id="product-public-note"
              rows={3}
              value={values.publicNote}
              onChange={(event) => set("publicNote", event.target.value)}
              placeholder="Sieht jede Person, die das Etikett scannt"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function SpecField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const id = `spec-${field.key}`;
  const label = `${field.label}${field.unit ? ` (${field.unit})` : ""}${field.required ? " *" : ""}`;
  if (field.type === "boolean") {
    return (
      <label className="flex min-h-10 items-center justify-between gap-3 self-end rounded-md border border-border px-3 py-2">
        <span className="text-sm text-foreground">{label}</span>
        <Switch checked={value === true} onCheckedChange={onChange} aria-label={field.label} />
      </label>
    );
  }
  if (field.type === "multiselect") {
    const chosen = new Set(
      (typeof value === "string" ? value : "")
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
    return (
      <div className="space-y-1.5 sm:col-span-2">
        <span className="text-sm leading-none font-medium">{label}</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={field.label}>
          {field.options.map((option) => {
            const on = chosen.has(option);
            return (
              <button
                key={option}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(chosen);
                  if (on) next.delete(option);
                  else next.add(option);
                  onChange(field.options.filter((entry) => next.has(entry)).join("; "));
                }}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-medium",
                  on
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (field.type === "date") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }
  if (field.type === "dimensions" || field.type === "measure") {
    const text = typeof value === "string" ? value : "";
    let hint: string | null = null;
    let invalid = false;
    if (text.trim()) {
      if (field.type === "dimensions") {
        const dims = parseDimensions(text, field.unit);
        invalid = !dims;
        hint = dims
          ? `L ${formatLength(dims.l, field.unit)} · B ${formatLength(dims.w, field.unit)}${
              dims.h !== null ? ` · H ${formatLength(dims.h, field.unit)}` : ""
            } ${dimensionUnit(field.unit)}`
          : "Bitte als L × B × H eingeben, z. B. 120x80x40";
      } else {
        const base = parseMeasure(text, field.unit);
        invalid = base === null;
        hint =
          base === null
            ? `Zahl in ${field.unit ?? "der Einheit"}`
            : `= ${formatMeasure(base, field.unit)}`;
      }
    }
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>
          {field.label}
          {field.type === "dimensions"
            ? ` (L × B × H, ${field.unit ?? "cm"})`
            : field.unit
              ? ` (${field.unit})`
              : ""}
          {field.required ? " *" : ""}
        </Label>
        <Input
          id={id}
          value={text}
          placeholder={
            field.placeholder ?? (field.type === "dimensions" ? "z. B. 120x80x40" : undefined)
          }
          inputMode={field.type === "measure" ? "decimal" : "text"}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {hint ? (
          <p
            id={`${id}-hint`}
            className={cn("text-xs", invalid ? "text-destructive" : "text-muted-foreground")}
          >
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <Select
          value={typeof value === "string" && value ? value : NONE}
          onValueChange={(next) => onChange(next === NONE ? "" : next)}
        >
          <SelectTrigger aria-label={field.label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>–</SelectItem>
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
        value={typeof value === "string" ? value : ""}
        placeholder={field.placeholder ?? undefined}
        inputMode={field.type === "number" ? "decimal" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
