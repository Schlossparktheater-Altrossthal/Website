import {
  DEFAULT_INSPECTION_INTERVAL_MONTHS,
  type AssetKind,
  type Condition,
} from "@/lib/inventory/constants";
import type { PlacementTarget } from "@/lib/inventory/service-types";

/** Werte des Erfassungsformulars – ohne "use client", damit Seiten sie vorbelegen können. */
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
