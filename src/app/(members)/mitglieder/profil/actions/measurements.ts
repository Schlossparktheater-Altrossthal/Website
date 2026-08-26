"use server";

import type { MeasurementType, MeasurementUnit } from "@prisma/client";

import { authorizedFetch, type ActionResult } from "@/lib/profil/actions-helpers";

export type SaveMeasurementInput = {
  type: MeasurementType;
  value: number;
  unit: MeasurementUnit;
  note?: string | null;
};

export type SaveMeasurementResult = {
  measurement: {
    id: string;
    type: MeasurementType;
    value: number;
    unit: MeasurementUnit;
    note: string | null;
    updatedAt: string | null;
  };
};

export async function saveMeasurementAction(
  input: SaveMeasurementInput,
): Promise<ActionResult<SaveMeasurementResult>> {
  try {
    const payload: Record<string, unknown> = {
      type: input.type,
      value: input.value,
      unit: input.unit,
    };

    if (typeof input.note === "string") {
      payload.note = input.note;
    }

    const response = await authorizedFetch("/api/measurements", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof data?.error === "string" ? data.error : "Maß konnte nicht gespeichert werden.";
      return { ok: false, error };
    }

    return {
      ok: true,
      data: {
        measurement: {
          id: String(data?.id ?? ""),
          type: (data?.type as MeasurementType) ?? input.type,
          value: typeof data?.value === "number" ? data.value : input.value,
          unit: (data?.unit as MeasurementUnit) ?? input.unit,
          note: typeof data?.note === "string" ? data.note : null,
          updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null,
        },
      },
    };
  } catch (error) {
    console.error("[profile][measurement]", error);
    return { ok: false, error: "Netzwerkfehler: Maß konnte nicht gespeichert werden." };
  }
}
