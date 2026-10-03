import {
  DEFAULT_INSPECTION_INTERVAL_MONTHS,
  type AssetKind,
  type Condition,
} from "@/lib/inventory/constants";
import type { PlacementTarget } from "@/lib/inventory/service-types";
import type { CategoryNode, FieldDef } from "@/lib/inventory/specs";

/** Werte des Erfassungsformulars – ohne "use client", damit Seiten sie vorbelegen können. */
export type AssetFormArea = {
  id: string;
  name: string;
  prefix: string;
  inspectionDefault: boolean;
  fields: FieldDef[];
  categories: (CategoryNode & { fields: FieldDef[] })[];
};

export type AssetFormValues = {
  areaId: string;
  categoryId: string | null;
  kind: AssetKind;
  name: string;
  manufacturer: string;
  model: string;
  label: string;
  count: string;
  serialNumber: string;
  description: string;
  publicNote: string;
  internalNote: string;
  specs: Record<string, string | boolean>;
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
    label: "",
    count: "1",
    serialNumber: "",
    description: "",
    publicNote: "",
    internalNote: "",
    specs: {},
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
