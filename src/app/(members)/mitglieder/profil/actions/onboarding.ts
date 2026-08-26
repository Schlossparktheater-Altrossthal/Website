"use server";

import type { OnboardingFocus } from "@prisma/client";

import { authorizedFetch, type ActionResult } from "@/lib/profil/actions-helpers";

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

export type StartOnboardingResult = {
  onboarding: {
    show: {
      id: string;
      title: string | null;
      year: number | null;
      periodLabel: string | null;
      status: string;
    };
    whatsappLink: string | null;
    whatsappLinkVisitedAt: string | null;
  };
};

export type SaveRolePreferencesInput = {
  code: string;
  domain: "acting" | "crew";
  weight: number;
};

export type SaveRolePreferencesResult = {
  preferences: SaveRolePreferencesInput[];
  focus: OnboardingFocus | null;
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
      const error =
        typeof data?.error === "string"
          ? data.error
          : "Onboarding-Angaben konnten nicht gespeichert werden.";
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
          backgroundClass:
            typeof onboarding.backgroundClass === "string" ? onboarding.backgroundClass : null,
          notes: typeof onboarding.notes === "string" ? onboarding.notes : null,
          memberSinceYear:
            typeof onboarding.memberSinceYear === "number" &&
            Number.isFinite(onboarding.memberSinceYear)
              ? onboarding.memberSinceYear
              : onboarding.memberSinceYear === null
                ? null
                : (input.memberSinceYear ?? null),
          updatedAt: typeof onboarding.updatedAt === "string" ? onboarding.updatedAt : null,
        },
      },
    };
  } catch (error) {
    console.error("[profile][onboarding]", error);
    return {
      ok: false,
      error: "Netzwerkfehler: Onboarding-Angaben konnten nicht gespeichert werden.",
    };
  }
}

export async function startOnboardingAction(
  showId: string,
): Promise<ActionResult<StartOnboardingResult>> {
  try {
    const response = await authorizedFetch("/api/profile/onboarding/show", {
      method: "PUT",
      body: JSON.stringify({ showId }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error =
        typeof data?.error === "string"
          ? data.error
          : "Onboarding konnte nicht aktualisiert werden.";
      return { ok: false, error };
    }

    const onboarding = data?.onboarding;
    if (!onboarding || typeof onboarding !== "object") {
      return { ok: false, error: "Antwort des Servers war ungültig." };
    }

    const show = onboarding.show;
    if (!show || typeof show !== "object") {
      return { ok: false, error: "Antwort des Servers war ungültig." };
    }

    return {
      ok: true,
      data: {
        onboarding: {
          show: {
            id: typeof show.id === "string" ? show.id : showId,
            title: typeof show.title === "string" ? show.title : null,
            year: typeof show.year === "number" ? show.year : null,
            periodLabel: typeof show.periodLabel === "string" ? show.periodLabel : null,
            status: typeof show.status === "string" ? show.status : "draft",
          },
          whatsappLink:
            typeof onboarding.whatsappLink === "string" ? onboarding.whatsappLink : null,
          whatsappLinkVisitedAt:
            typeof onboarding.whatsappLinkVisitedAt === "string"
              ? onboarding.whatsappLinkVisitedAt
              : null,
        },
      },
    };
  } catch (error) {
    console.error("[profile][onboarding.show]", error);
    return { ok: false, error: "Netzwerkfehler: Onboarding konnte nicht aktualisiert werden." };
  }
}

export async function saveRolePreferencesAction(
  preferences: SaveRolePreferencesInput[],
): Promise<ActionResult<SaveRolePreferencesResult>> {
  try {
    const payload = {
      preferences: preferences.map((pref) => ({
        code: pref.code,
        domain: pref.domain,
        weight: pref.weight,
      })),
    };

    const response = await authorizedFetch("/api/profile/onboarding/preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error =
        typeof data?.error === "string"
          ? data.error
          : "Präferenzen konnten nicht gespeichert werden.";
      return { ok: false, error };
    }

    const rawPreferences = Array.isArray(data?.preferences) ? (data.preferences as unknown[]) : [];
    const normalized = rawPreferences
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const candidate = entry as {
          code?: unknown;
          domain?: unknown;
          weight?: unknown;
        };

        const code = typeof candidate.code === "string" ? candidate.code.trim() : "";
        if (!code) {
          return null;
        }

        const domain = candidate.domain;
        if (domain !== "acting" && domain !== "crew") {
          return null;
        }

        const numericWeight =
          typeof candidate.weight === "number" && Number.isFinite(candidate.weight)
            ? candidate.weight
            : 0;

        const normalizedEntry: SaveRolePreferencesInput = {
          code,
          domain,
          weight: numericWeight,
        };

        return normalizedEntry;
      })
      .filter((entry): entry is SaveRolePreferencesInput => Boolean(entry));

    const focusValue =
      typeof data?.focus === "string" && ["acting", "tech", "both"].includes(data.focus)
        ? (data.focus as OnboardingFocus)
        : null;

    return { ok: true, data: { preferences: normalized, focus: focusValue } };
  } catch (error) {
    console.error("[profile][onboarding.preferences]", error);
    return { ok: false, error: "Netzwerkfehler: Präferenzen konnten nicht gespeichert werden." };
  }
}
