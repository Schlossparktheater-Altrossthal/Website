"use server";

import { authorizedFetch, type ActionResult } from "./helpers";

export type SaveDietaryPreferenceInput = {
  style: string;
  strictness: string;
  customLabel?: string | null;
};

export type SaveDietaryPreferenceResult = {
  preference: {
    style: string;
    strictness: string;
    customLabel: string | null;
    label: string | null;
    strictnessLabel: string | null;
  };
};

export async function saveDietaryPreferenceAction(
  input: SaveDietaryPreferenceInput,
): Promise<ActionResult<SaveDietaryPreferenceResult>> {
  try {
    const response = await authorizedFetch("/api/profile/dietary", {
      method: "PUT",
      body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof data?.error === "string"
          ? data.error
          : "Ernährungsprofil konnte nicht gespeichert werden.";
      return { ok: false, error };
    }

    return {
      ok: true,
      data: {
        preference: {
          style: typeof data?.preference?.style === "string" ? data.preference.style : input.style,
          strictness:
            typeof data?.preference?.strictness === "string"
              ? data.preference.strictness
              : input.strictness,
          customLabel:
            typeof data?.preference?.customLabel === "string"
              ? data.preference.customLabel
              : data?.preference?.customLabel === null
                ? null
                : (input.customLabel ?? null),
          label:
            typeof data?.preference?.label === "string"
              ? data.preference.label
              : (data?.preference?.label ?? null),
          strictnessLabel:
            typeof data?.preference?.strictnessLabel === "string"
              ? data.preference.strictnessLabel
              : (data?.preference?.strictnessLabel ?? null),
        },
      },
    };
  } catch (error) {
    console.error("[profile][dietary]", error);
    return {
      ok: false,
      error: "Netzwerkfehler: Ernährungsprofil konnte nicht gespeichert werden.",
    };
  }
}
