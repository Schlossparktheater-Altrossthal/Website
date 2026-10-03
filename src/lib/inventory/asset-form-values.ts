import {
  DEFAULT_INSPECTION_INTERVAL_MONTHS,
  type AssetKind,
  type Condition,
} from "@/lib/inventory/constants";
import type { PlacementTarget } from "@/lib/inventory/service-types";
import type { CategoryNode, FieldDef, Specs } from "@/lib/inventory/specs";

/**
 * Formularwerte für Artikeltyp und Exemplar – ohne "use client", damit Seiten sie vorbelegen
 * können. Zahlen bleiben Text, bis abgeschickt wird.
 */

export type AssetFormArea = {
  id: string;
  name: string;
  prefix: string;
  inspectionDefault: boolean;
  fields: FieldDef[];
  categories: (CategoryNode & { fields: FieldDef[] })[];
};

export type SpecFormValues = Record<string, string | boolean>;

export type ProductFormValues = {
  areaId: string;
  categoryId: string | null;
  kind: AssetKind;
  name: string;
  manufacturer: string;
  model: string;
  description: string;
  publicNote: string;
  specs: SpecFormValues;
  unit: string;
  minQuantity: string;
  inspectionRequired: boolean;
  inspectionIntervalMonths: string;
};

export type ExemplarFormValues = {
  label: string;
  serialNumber: string;
  internalNote: string;
  condition: Condition;
  nextInspectionAt: string;
  acquisitionCost: string;
  purchaseDate: string;
  supplier: string;
  ownership: string;
};

export type CaptureFormValues = ExemplarFormValues & {
  count: string;
  quantity: string;
  placement: PlacementTarget;
};

export function emptyProductValues(area: AssetFormArea | undefined): ProductFormValues {
  return {
    areaId: area?.id ?? "",
    categoryId: null,
    kind: "unique",
    name: "",
    manufacturer: "",
    model: "",
    description: "",
    publicNote: "",
    specs: {},
    unit: "Stk.",
    minQuantity: "",
    inspectionRequired: area?.inspectionDefault ?? false,
    inspectionIntervalMonths: String(DEFAULT_INSPECTION_INTERVAL_MONTHS),
  };
}

export function emptyExemplarValues(): ExemplarFormValues {
  return {
    label: "",
    serialNumber: "",
    internalNote: "",
    condition: "good",
    nextInspectionAt: "",
    acquisitionCost: "",
    purchaseDate: "",
    supplier: "",
    ownership: "",
  };
}

export function emptyCaptureValues(placement: PlacementTarget): CaptureFormValues {
  return { ...emptyExemplarValues(), count: "1", quantity: "", placement };
}

export function specsToFormValues(specs: Specs): SpecFormValues {
  return Object.fromEntries(
    Object.entries(specs).map(([key, value]) => [
      key,
      typeof value === "boolean" ? value : String(value),
    ]),
  );
}

const number = (value: string) => {
  const trimmed = value.trim().replace(",", ".");
  return trimmed === "" ? null : Number(trimmed);
};

export function productPayload(values: ProductFormValues) {
  return {
    ...values,
    minQuantity: number(values.minQuantity),
    inspectionIntervalMonths: number(values.inspectionIntervalMonths),
  };
}

export function exemplarPayload(values: ExemplarFormValues) {
  return {
    ...values,
    acquisitionCost: number(values.acquisitionCost),
    nextInspectionAt: values.nextInspectionAt || null,
    purchaseDate: values.purchaseDate || null,
  };
}

export function capturePayload(values: CaptureFormValues) {
  return {
    ...exemplarPayload(values),
    count: number(values.count) ?? 1,
    quantity: number(values.quantity),
    placement: values.placement,
  };
}
