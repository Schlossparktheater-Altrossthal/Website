"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createAssetAction,
  updateAssetAction,
} from "@/app/(members)/mitglieder/lager/actions/assets";
import { PlacementPicker, type PlacementOptions } from "@/components/inventory/placement-picker";
import {
  CameraIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  PlusIcon,
  PrinterIcon,
  CloseIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
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
import {
  ASSET_KIND_HINTS,
  ASSET_KIND_LABELS,
  attributeFieldsFor,
  CONDITION_LABELS,
  CONDITIONS,
  DEFAULT_INSPECTION_INTERVAL_MONTHS,
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
  type AssetKind,
  type Condition,
} from "@/lib/inventory/constants";
import { resizeImageFile } from "@/lib/inventory/photo-client";
import type { PlacementTarget } from "@/lib/inventory/service-types";
import { cn } from "@/lib/utils";

export type AssetFormArea = {
  id: string;
  name: string;
  prefix: string;
  inspectionDefault: boolean;
  categories: { id: string; name: string }[];
};

export type AssetFormValues = {
  areaId: string;
  categoryId: string | null;
  kind: AssetKind;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  description: string;
  publicNote: string;
  internalNote: string;
  attributes: Record<string, string>;
  condition: Condition;
  unit: string;
  minQuantity: string;
  quantity: string;
  placement: PlacementTarget;
  inspectionRequired: boolean;
  inspectionIntervalMonths: string;
  nextInspectionAt: string;
  acquisitionCost: string;
  purchaseDate: string;
  supplier: string;
  ownership: string;
};

export function emptyAssetValues(area: AssetFormArea | undefined): AssetFormValues {
  return {
    areaId: area?.id ?? "",
    categoryId: null,
    kind: "unique",
    name: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    description: "",
    publicNote: "",
    internalNote: "",
    attributes: {},
    condition: "good",
    unit: "Stk.",
    minQuantity: "",
    quantity: "1",
    placement: { type: "none" },
    inspectionRequired: area?.inspectionDefault ?? false,
    inspectionIntervalMonths: String(DEFAULT_INSPECTION_INTERVAL_MONTHS),
    nextInspectionAt: "",
    acquisitionCost: "",
    purchaseDate: "",
    supplier: "",
    ownership: "",
  };
}

const NO_CATEGORY = "__none__";

function toPayload(values: AssetFormValues) {
  const number = (value: string) => (value.trim() === "" ? null : Number(value));
  return {
    ...values,
    minQuantity: number(values.minQuantity),
    quantity: number(values.quantity),
    inspectionIntervalMonths: number(values.inspectionIntervalMonths),
    acquisitionCost: number(values.acquisitionCost.replace(",", ".")),
    nextInspectionAt: values.nextInspectionAt || null,
    purchaseDate: values.purchaseDate || null,
  };
}

/**
 * Erfassen und Bearbeiten. Mobil zuerst: Foto, Bereich, Name und Ort stehen oben; alles
 * Weitere klappt auf. Nach dem Speichern geht es mit denselben Vorgaben direkt weiter.
 */
export function AssetForm({
  mode,
  assetId,
  assetCode,
  initialValues,
  areas,
  placementOptions,
  canManage,
}: {
  mode: "create" | "edit";
  assetId?: string;
  assetCode?: string;
  initialValues: AssetFormValues;
  areas: AssetFormArea[];
  placementOptions: PlacementOptions;
  canManage: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState(initialValues);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [created, setCreated] = React.useState<string[]>([]);
  const [moreOpen, setMoreOpen] = React.useState(mode === "edit");
  const nameRef = React.useRef<HTMLInputElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const area = areas.find((entry) => entry.id === values.areaId);
  const attributeFields = area ? attributeFieldsFor(area.prefix) : [];

  React.useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const set = <K extends keyof AssetFormValues>(key: K, value: AssetFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const chooseArea = (areaId: string) => {
    const next = areas.find((entry) => entry.id === areaId);
    setValues((current) => ({
      ...current,
      areaId,
      categoryId: null,
      attributes: {},
      inspectionRequired: next?.inspectionDefault ?? current.inspectionRequired,
    }));
  };

  const onPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setPhoto(await resizeImageFile(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Foto konnte nicht gelesen werden.");
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("asset", JSON.stringify(toPayload(values)));
    if (photo) formData.set("photo", photo);
    try {
      if (mode === "create") {
        const result = await createAssetAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Angelegt.");
        setCreated((current) => [result.data.code, ...current]);
        // Für die nächste Erfassung bleiben Bereich, Kategorie, Art und Ort stehen.
        setValues((current) => ({
          ...emptyAssetValues(area),
          areaId: current.areaId,
          categoryId: current.categoryId,
          kind: current.kind,
          placement: current.placement,
          unit: current.unit,
          inspectionRequired: current.inspectionRequired,
          inspectionIntervalMonths: current.inspectionIntervalMonths,
        }));
        setPhoto(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
        nameRef.current?.focus();
        router.refresh();
      } else if (assetId) {
        const result = await updateAssetAction(assetId, formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Gespeichert.");
        router.push(inventoryAssetPath(assetCode ?? ""));
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      {mode === "create" && created.length ? (
        <div className="space-y-3 rounded-xl border border-success/30 bg-success/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircleIcon className="h-4 w-4 text-success" />
            {created.length === 1
              ? `${created[0]} angelegt – gleich das nächste?`
              : `${created.length} Objekte in dieser Runde erfasst.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={inventoryAssetPath(created[0]!)}>Zuletzt erfasstes ansehen</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                href={`${INVENTORY_BASE_PATH}/etiketten?codes=${encodeURIComponent(created.join(","))}`}
              >
                <PrinterIcon className="mr-2 h-4 w-4" />
                Etiketten für {created.length === 1 ? "dieses" : `diese ${created.length}`}
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        {mode === "create" ? (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={onPhoto}
              aria-label="Foto aufnehmen"
            />
            {photoPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- lokale Vorschau */}
                <img
                  src={photoPreview}
                  alt="Vorschau"
                  className="aspect-[4/3] w-full rounded-lg border border-border object-cover sm:max-w-xs"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="subtle"
                  className="absolute top-2 right-2 sm:right-auto sm:left-[calc(20rem-2.75rem)]"
                  onClick={() => setPhoto(null)}
                  aria-label="Foto entfernen"
                >
                  <CloseIcon />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-28 w-full items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/40 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:max-w-xs"
              >
                <CameraIcon className="h-6 w-6" />
                Foto aufnehmen
              </button>
            )}
          </div>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">Bereich</legend>
          <div className="flex flex-wrap gap-2">
            {areas.map((entry) => (
              <button
                key={entry.id}
                type="button"
                disabled={mode === "edit"}
                onClick={() => chooseArea(entry.id)}
                aria-pressed={values.areaId === entry.id}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed",
                  values.areaId === entry.id
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                  mode === "edit" && values.areaId !== entry.id && "opacity-50",
                )}
              >
                <span className="font-mono text-xs">{entry.prefix}</span>
                {entry.name}
              </button>
            ))}
          </div>
        </fieldset>

        {mode === "create" ? (
          <div className="space-y-2">
            <SegmentedControl
              aria-label="Art"
              value={values.kind}
              onValueChange={(kind) => set("kind", kind)}
              fullWidth
              options={(Object.keys(ASSET_KIND_LABELS) as AssetKind[]).map((kind) => ({
                value: kind,
                label: kind === "container" ? "Kiste" : kind === "bulk" ? "Menge" : "Einzelstück",
                ariaLabel: ASSET_KIND_LABELS[kind],
              }))}
            />
            <p className="text-xs text-muted-foreground">{ASSET_KIND_HINTS[values.kind]}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              ref={nameRef}
              value={values.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder={
                values.kind === "container"
                  ? "z. B. Kabelkiste 1"
                  : area?.prefix === "K"
                    ? "z. B. Gehrock dunkelblau"
                    : "z. B. LED-Scheinwerfer PAR 64"
              }
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <Select
              value={values.categoryId ?? NO_CATEGORY}
              onValueChange={(id) => set("categoryId", id === NO_CATEGORY ? null : id)}
            >
              <SelectTrigger aria-label="Kategorie">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>Ohne Kategorie</SelectItem>
                {(area?.categories ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Zustand</Label>
            <Select
              value={values.condition}
              onValueChange={(condition) => set("condition", condition as Condition)}
            >
              <SelectTrigger aria-label="Zustand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((condition) => (
                  <SelectItem key={condition} value={condition}>
                    {CONDITION_LABELS[condition]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === "create" ? (
          <div className="space-y-1.5">
            <Label>Wo liegt es?</Label>
            <PlacementPicker
              value={values.placement}
              onChange={(placement) => set("placement", placement)}
              options={placementOptions}
            />
            {values.kind === "bulk" ? (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="asset-quantity">Menge dort</Label>
                  <Input
                    id="asset-quantity"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={values.quantity}
                    onChange={(event) => set("quantity", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="asset-unit">Einheit</Label>
                  <Input
                    id="asset-unit"
                    value={values.unit}
                    onChange={(event) => set("unit", event.target.value)}
                    placeholder="Stk., m, Rollen"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {attributeFields.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {attributeFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`attr-${field.key}`}>{field.label}</Label>
                <Input
                  id={`attr-${field.key}`}
                  value={values.attributes[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    set("attributes", { ...values.attributes, [field.key]: event.target.value })
                  }
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 text-left">
            <span>
              <span className="block text-sm font-semibold text-foreground">Weitere Angaben</span>
              <span className="block text-xs text-muted-foreground">
                Hersteller, Beschreibung, Hinweise, Prüfung{canManage ? ", Anschaffung" : ""}
              </span>
            </span>
            <ChevronDownIcon
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                moreOpen && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 border-t border-border p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <TextField
                id="manufacturer"
                label="Hersteller"
                value={values.manufacturer}
                onChange={(value) => set("manufacturer", value)}
              />
              <TextField
                id="model"
                label="Modell"
                value={values.model}
                onChange={(value) => set("model", value)}
              />
              <TextField
                id="serial"
                label="Seriennummer"
                value={values.serialNumber}
                onChange={(value) => set("serialNumber", value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-description">Beschreibung</Label>
              <Textarea
                id="asset-description"
                rows={3}
                value={values.description}
                onChange={(event) => set("description", event.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="asset-public-note">Öffentlicher Hinweis</Label>
                <Textarea
                  id="asset-public-note"
                  rows={2}
                  value={values.publicNote}
                  onChange={(event) => set("publicNote", event.target.value)}
                  placeholder="Sieht jede Person, die das Etikett scannt"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asset-internal-note">Interne Notiz</Label>
                <Textarea
                  id="asset-internal-note"
                  rows={2}
                  value={values.internalNote}
                  onChange={(event) => set("internalNote", event.target.value)}
                  placeholder="Nur für Mitglieder mit Lagerzugriff"
                />
              </div>
            </div>
            {values.kind === "bulk" ? (
              <div className="grid grid-cols-2 gap-4">
                {mode === "edit" ? (
                  <TextField
                    id="unit"
                    label="Einheit"
                    value={values.unit}
                    onChange={(value) => set("unit", value)}
                  />
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="asset-min">Mindestbestand</Label>
                  <Input
                    id="asset-min"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={values.minQuantity}
                    onChange={(event) => set("minQuantity", event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-3 rounded-lg border border-border p-3">
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    Prüfpflichtig (Elektroprüfung)
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Ortsveränderliche Geräte nach DGUV V3
                  </span>
                </span>
                <Switch
                  checked={values.inspectionRequired}
                  onCheckedChange={(checked) => set("inspectionRequired", checked)}
                  aria-label="Prüfpflichtig"
                />
              </label>
              {values.inspectionRequired ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="asset-interval">Intervall (Monate)</Label>
                    <Input
                      id="asset-interval"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={120}
                      value={values.inspectionIntervalMonths}
                      onChange={(event) => set("inspectionIntervalMonths", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="asset-next">Nächste Prüfung</Label>
                    <Input
                      id="asset-next"
                      type="date"
                      value={values.nextInspectionAt}
                      onChange={(event) => set("nextInspectionAt", event.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {canManage ? (
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-border p-3 sm:grid-cols-2">
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Anschaffung – nur für Personen sichtbar, die das Lager verwalten.
                </p>
                <TextField
                  id="cost"
                  label="Anschaffungspreis (€)"
                  value={values.acquisitionCost}
                  inputMode="decimal"
                  onChange={(value) => set("acquisitionCost", value)}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="asset-purchase">Kaufdatum</Label>
                  <Input
                    id="asset-purchase"
                    type="date"
                    value={values.purchaseDate}
                    onChange={(event) => set("purchaseDate", event.target.value)}
                  />
                </div>
                <TextField
                  id="supplier"
                  label="Händler"
                  value={values.supplier}
                  onChange={(value) => set("supplier", value)}
                />
                <TextField
                  id="ownership"
                  label="Eigentum"
                  value={values.ownership}
                  placeholder="z. B. Leihgabe von …"
                  onChange={(value) => set("ownership", value)}
                />
              </div>
            ) : null}
          </CollapsibleContent>
        </section>
      </Collapsible>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap gap-2 bg-background/95 px-1 py-3 backdrop-blur">
        <Button
          type="submit"
          size="lg"
          disabled={saving || !values.areaId}
          className="flex-1 sm:flex-none"
        >
          {mode === "create" ? (
            <>
              <PlusIcon className="mr-2 h-4 w-4" />
              {saving ? "Speichert …" : "Speichern & nächstes"}
            </>
          ) : saving ? (
            "Speichert …"
          ) : (
            "Speichern"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() =>
            mode === "create" && created.length ? router.push(INVENTORY_BASE_PATH) : router.back()
          }
        >
          {mode === "create" && created.length ? "Fertig" : "Abbrechen"}
        </Button>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`asset-${id}`}>{label}</Label>
      <Input
        id={`asset-${id}`}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
