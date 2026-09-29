"use server";

import { authorizedFetch, type ActionResult } from "@/lib/profil/actions-helpers";

export type UpsertAversionInput = {
  label: string;
  note?: string | null;
};

export type UpsertAversionResult = {
  aversion: {
    id: string;
    label: string;
    note: string | null;
    updatedAt: string | null;
  };
};

export async function upsertAversionAction(
  input: UpsertAversionInput,
): Promise<ActionResult<UpsertAversionResult>> {
  try {
    const response = await authorizedFetch("/api/aversions", {
      method: "POST",
      body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof data?.error === "string"
          ? data.error
          : "Besonderheit konnte nicht gespeichert werden.";
      return { ok: false, error };
    }

    return {
      ok: true,
      data: {
        aversion: {
          id: String(data?.id ?? ""),
          label: typeof data?.label === "string" ? data.label : input.label,
          note: typeof data?.note === "string" ? data.note : null,
          updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null,
        },
      },
    };
  } catch (error) {
    console.error("[profile][aversion]", error);
    return { ok: false, error: "Netzwerkfehler: Besonderheit konnte nicht gespeichert werden." };
  }
}

export async function deleteAversionAction(
  label: string,
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const response = await authorizedFetch(`/api/aversions?label=${encodeURIComponent(label)}`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof data?.error === "string" ? data.error : "Besonderheit konnte nicht entfernt werden.";
      return { ok: false, error };
    }

    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error("[profile][aversion-delete]", error);
    return { ok: false, error: "Netzwerkfehler: Besonderheit konnte nicht entfernt werden." };
  }
}
