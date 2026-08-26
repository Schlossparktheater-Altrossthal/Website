"use server";

import { authorizedFetch, type ActionResult } from "@/lib/profil/actions-helpers";

export async function saveInterestsAction(
  interests: string[],
): Promise<ActionResult<{ interests: string[] }>> {
  try {
    const response = await authorizedFetch("/api/profile/interests", {
      method: "PUT",
      body: JSON.stringify({ interests }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof data?.error === "string"
          ? data.error
          : "Interessen konnten nicht gespeichert werden.";
      return { ok: false, error };
    }

    const nextInterests = Array.isArray(data?.interests)
      ? (data.interests as unknown[])
          .map((entry) => (typeof entry === "string" ? entry : null))
          .filter((entry): entry is string => Boolean(entry?.trim()))
      : interests;

    return { ok: true, data: { interests: nextInterests } };
  } catch (error) {
    console.error("[profile][interests]", error);
    return { ok: false, error: "Netzwerkfehler: Interessen konnten nicht gespeichert werden." };
  }
}
