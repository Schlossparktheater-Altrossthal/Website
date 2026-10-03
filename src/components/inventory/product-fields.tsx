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
import { ASSET_KIND_HINTS, ASSET_KIND_LABELS, type AssetKind } from "@/lib/inventory/constants";
import { catalogFields, categoryPath, type FieldDef } from "@/lib/inventory/specs";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export function categoryOptions(area: AssetFormArea | undefined) {
  const categories = area?.categories ?? [];
  return categories
    .map((category) => ({
      id: category.id,
      label: categoryPath(categories, category.id)
        .map((entry) => entry.name)
        .join(" › "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}

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
}: {
  values: ProductFormValues;
  onChange: (values: ProductFormValues) => void;
  areas: AssetFormArea[];
  mode: "create" | "edit";
  nameRef?: React.Ref<HTMLInputElement>;
}) {
  const area = areas.find((entry) => entry.id === values.areaId);
  const fields = catalogFields(area, values.categoryId);
  const options = categoryOptions(area);
  const [moreOpen, setMoreOpen] = React.useState(Boolean(values.description || values.publicNote));
  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    onChange({ ...values, [key]: value });
  const bulk = values.kind === "bulk";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Bereich</Label>
          <Select
            value={values.areaId}
            disabled={mode === "edit"}
            onValueChange={(areaId) => {
              const next = areas.find((entry) => entry.id === areaId);
              onChange({
                ...values,
                areaId,
                categoryId: null,
                specs: {},
                inspectionRequired:
                  values.kind === "unique" ? (next?.inspectionDefault ?? false) : false,
              });
            }}
          >
            <SelectTrigger aria-label="Bereich">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {areas.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.prefix} · {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Kategorie</Label>
          <Select
            value={values.categoryId ?? NONE}
            onValueChange={(id) => set("categoryId", id === NONE ? null : id)}
          >
            <SelectTrigger aria-label="Kategorie">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Ohne Kategorie</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {mode === "create" ? (
        <div className="space-y-1.5">
          <SegmentedControl
            aria-label="Art"
            value={values.kind}
            onValueChange={(kind: AssetKind) =>
              // Prüfpflicht betrifft Geräte – Kisten und Mengenartikel standardmäßig nicht.
              onChange({
                ...values,
                kind,
                inspectionRequired: kind === "unique" ? (area?.inspectionDefault ?? false) : false,
              })
            }
            fullWidth
            options={(Object.keys(ASSET_KIND_LABELS) as AssetKind[]).map((kind) => ({
              value: kind,
              label: kind === "container" ? "Kiste" : kind === "bulk" ? "Menge" : "Gerät / Stück",
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
              ? `· ${options.find((option) => option.id === values.categoryId)?.label ?? ""}`
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

      {!bulk ? (
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
