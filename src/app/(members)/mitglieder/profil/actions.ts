"use server";

import { cookies } from "next/headers";

import type { AllergyLevel, MeasurementType, MeasurementUnit, OnboardingFocus } from "@prisma/client";

const BASE_URL = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function authorizedFetch(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const headers = new Headers(init.headers ?? {});
  headers.set("accept", "application/json");

  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const body = init.body;
  if (body && !(body instanceof FormData)) {
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  return fetch(`${BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });
}

export type UpdateProfileBasicsResult = {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string;
    roles: string[];
    avatarSource: string | null;
    avatarUpdatedAt: string | null;
    dateOfBirth: string | null;
  };
};

export async function updateProfileBasicsAction(formData: FormData): Promise<ActionResult<UpdateProfileBasicsResult>> {
  try {
    const response = await authorizedFetch("/api/profile", {
      method: "PUT",
      body: formData,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = typeof data?.error === "string" ? data.error : "Profil konnte nicht aktualisiert werden.";
      return { ok: false, error };
    }

    const user = data?.user;
    if (!user || typeof user !== "object") {
      return { ok: false, error: "Antwort des Servers war ungültig." };
    }

    return {
      ok: true,
      data: {
        user: {
          id: String(user.id ?? ""),
          firstName: typeof user.firstName === "string" ? user.firstName : null,
          lastName: typeof user.lastName === "string" ? user.lastName : null,
          name: typeof user.name === "string" ? user.name : null,
          email: typeof user.email === "string" ? user.email : "",
          roles: Array.isArray(user.roles)
            ? (user.roles as unknown[])
                .map((role) =>
                  typeof role === "string"
                    ? role
                    : role && typeof role === "object" && typeof (role as { role?: unknown }).role === "string"
                      ? (role as { role: string }).role
                      : null,
                )
                .filter((role): role is string => Boolean(role))
            : [],
          avatarSource:
            typeof user.avatarSource === "string" && user.avatarSource.trim() ? user.avatarSource : null,
          avatarUpdatedAt:
            typeof user.avatarUpdatedAt === "string" && user.avatarUpdatedAt.trim() ? user.avatarUpdatedAt : null,
          dateOfBirth:
            typeof user.dateOfBirth === "string" && user.dateOfBirth.trim() ? user.dateOfBirth : null,
        },
      },
    };
  } catch (error) {
    console.error("[profile][basics]", error);
    return { ok: false, error: "Netzwerkfehler: Profil konnte nicht aktualisiert werden." };
  }
}

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
      const error = typeof data?.error === "string" ? data.error : "Ernährungsprofil konnte nicht gespeichert werden.";
      return { ok: false, error };
    }

    return {
      ok: true,
      data: {
        preference: {
          style: typeof data?.preference?.style === "string" ? data.preference.style : input.style,
          strictness:
            typeof data?.preference?.strictness === "string" ? data.preference.strictness : input.strictness,
          customLabel:
            typeof data?.preference?.customLabel === "string"
              ? data.preference.customLabel
              : data?.preference?.customLabel === null
                ? null
                : input.customLabel ?? null,
          label:
            typeof data?.preference?.label === "string" ? data.preference.label : data?.preference?.label ?? null,
          strictnessLabel:
            typeof data?.preference?.strictnessLabel === "string"
              ? data.preference.strictnessLabel
              : data?.preference?.strictnessLabel ?? null,
        },
      },
    };
  } catch (error) {
    console.error("[profile][dietary]", error);
    return { ok: false, error: "Netzwerkfehler: Ernährungsprofil konnte nicht gespeichert werden." };
  }
}

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

export async function upsertAllergyAction(input: UpsertAllergyInput): Promise<ActionResult<UpsertAllergyResult>> {
  try {
    const response = await authorizedFetch("/api/allergies", {
      method: "POST",
      body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = typeof data?.error === "string" ? data.error : "Allergie konnte nicht gespeichert werden.";
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

export async function deleteAllergyAction(allergen: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const response = await authorizedFetch(`/api/allergies?allergen=${encodeURIComponent(allergen)}`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = typeof data?.error === "string" ? data.error : "Allergie konnte nicht gelöscht werden.";
      return { ok: false, error };
    }

    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error("[profile][allergy-delete]", error);
    return { ok: false, error: "Netzwerkfehler: Allergie konnte nicht gelöscht werden." };
  }
}

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
    const response = await authorizedFetch("/api/measurements", {
      method: "POST",
      body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = typeof data?.error === "string" ? data.error : "Maß konnte nicht gespeichert werden.";
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

export async function saveInterestsAction(interests: string[]): Promise<ActionResult<{ interests: string[] }>> {
  try {
    const response = await authorizedFetch("/api/profile/interests", {
      method: "PUT",
      body: JSON.stringify({ interests }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = typeof data?.error === "string" ? data.error : "Interessen konnten nicht gespeichert werden.";
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

export type SaveOnboardingInput = {
  focus: OnboardingFocus;
  background: string;
  backgroundClass?: string | null;
  notes?: string | null;
  memberSinceYear?: number | null;
};

export type SaveOnboardingResult = {
  onboarding: {
    focus: OnboardingFocus;
    background: string | null;
    backgroundClass: string | null;
    notes: string | null;
    memberSinceYear: number | null;
    updatedAt: string | null;
  };
};

export async function saveOnboardingAction(
  input: SaveOnboardingInput,
): Promise<ActionResult<SaveOnboardingResult>> {
  try {
    const response = await authorizedFetch("/api/profile/onboarding", {
      method: "PUT",
      body: JSON.stringify(input),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = typeof data?.error === "string" ? data.error : "Onboarding-Angaben konnten nicht gespeichert werden.";
      return { ok: false, error };
    }

    const onboarding = data?.onboarding;
    if (!onboarding || typeof onboarding !== "object") {
      return { ok: false, error: "Antwort des Servers war ungültig." };
    }

    return {
      ok: true,
      data: {
        onboarding: {
          focus: (onboarding.focus as OnboardingFocus) ?? input.focus,
          background: typeof onboarding.background === "string" ? onboarding.background : null,
          backgroundClass: typeof onboarding.backgroundClass === "string" ? onboarding.backgroundClass : null,
          notes: typeof onboarding.notes === "string" ? onboarding.notes : null,
          memberSinceYear:
            typeof onboarding.memberSinceYear === "number" && Number.isFinite(onboarding.memberSinceYear)
              ? onboarding.memberSinceYear
              : onboarding.memberSinceYear === null
                ? null
                : input.memberSinceYear ?? null,
          updatedAt: typeof onboarding.updatedAt === "string" ? onboarding.updatedAt : null,
        },
      },
    };
  } catch (error) {
    console.error("[profile][onboarding]", error);
    return { ok: false, error: "Netzwerkfehler: Onboarding-Angaben konnten nicht gespeichert werden." };
  }
}
