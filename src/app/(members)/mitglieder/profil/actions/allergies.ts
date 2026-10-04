"use server";

import type { AllergyLevel, RestrictionKind } from "@prisma/client";

import { authorizedFetch, type ActionResult } from "@/lib/profil/actions-helpers";

export type UpsertAllergyInput = {
  allergen: string;
  level: AllergyLevel;
  /** Fehlt die Art, gilt „Allergie" – so bleiben ältere Aufrufer gültig. */
  kind?: RestrictionKind;
  tracesOk?: boolean | null;
  diagnosed?: boolean;
  symptoms?: string | null;
  treatment?: string | null;
  note?: string | null;
};

export type UpsertAllergyResult = {
  allergy: {
    id: string;
    allergen: string;
    kind: RestrictionKind;
    level: AllergyLevel;
    tracesOk: boolean | null;
    diagnosed: boolean;
    symptoms: string | null;
    treatment: string | null;
    note: string | null;
    updatedAt: string | null;
    taxonCode: string | null;
  };
};

export async function upsertAllergyAction(
  input: UpsertAllergyInput,
): Promise<ActionResult<UpsertAllergyResult>> {
  try {
    const response = await authorizedFetch("/api/allergies", {
      method: "POST",
      body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof data?.error === "string" ? data.error : "Allergie konnte nicht gespeichert werden.";
      return { ok: false, error };
    }

    return {
      ok: true,
      data: {
        allergy: {
          id: String(data?.id ?? ""),
          allergen: typeof data?.allergen === "string" ? data.allergen : input.allergen,
          kind: (data?.kind as RestrictionKind) ?? input.kind ?? "ALLERGY",
          level: (data?.level as AllergyLevel) ?? input.level,
          tracesOk: typeof data?.tracesOk === "boolean" ? data.tracesOk : null,
          diagnosed:
            typeof data?.diagnosed === "boolean" ? data.diagnosed : (input.diagnosed ?? false),
          symptoms: typeof data?.symptoms === "string" ? data.symptoms : null,
          treatment: typeof data?.treatment === "string" ? data.treatment : null,
          note: typeof data?.note === "string" ? data.note : null,
          updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null,
          taxonCode: typeof data?.taxonCode === "string" ? data.taxonCode : null,
        },
      },
    };
  } catch (error) {
    console.error("[profile][allergy]", error);
    return { ok: false, error: "Netzwerkfehler: Allergie konnte nicht gespeichert werden." };
  }
}

export async function deleteAllergyAction(
  allergen: string,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const response = await authorizedFetch(
      `/api/allergies?allergen=${encodeURIComponent(allergen)}`,
      {
        method: "DELETE",
      },
    );

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof data?.error === "string" ? data.error : "Allergie konnte nicht gelöscht werden.";
      return { ok: false, error };
    }

    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error("[profile][allergy-delete]", error);
    return { ok: false, error: "Netzwerkfehler: Allergie konnte nicht gelöscht werden." };
  }
}
