"use server";

import type { AllergyLevel } from "@prisma/client";

import { authorizedFetch, type ActionResult } from "@/lib/profil/actions-helpers";

export type UpsertAllergyInput = {
  allergen: string;
  level: AllergyLevel;
  symptoms?: string | null;
  treatment?: string | null;
  note?: string | null;
};

export type UpsertAllergyResult = {
  allergy: {
    id: string;
    allergen: string;
    level: AllergyLevel;
    symptoms: string | null;
    treatment: string | null;
    note: string | null;
    updatedAt: string | null;
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
          level: (data?.level as AllergyLevel) ?? input.level,
          symptoms: typeof data?.symptoms === "string" ? data.symptoms : null,
          treatment: typeof data?.treatment === "string" ? data.treatment : null,
          note: typeof data?.note === "string" ? data.note : null,
          updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null,
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
