import type { Prisma } from "@prisma/client";

export const PROFILE_SNAPSHOT_VERSION = 1;

export type ProfileSnapshotInput = {
  dietaryPreference: string | null;
  dietaryPreferenceStrictness: string | null;
  dietary: ReadonlyArray<{
    allergen: string;
    level: string;
    symptoms?: string | null;
    treatment?: string | null;
    note?: string | null;
  }>;
  preferences: ReadonlyArray<{ code: string; domain: string; weight: number }>;
  photoConsent: boolean | null;
  education?: {
    category: string | null;
    schoolName?: string | null;
    className?: string | null;
    workDescription?: string | null;
    universityName?: string | null;
    otherDescription?: string | null;
  };
  notes?: string | null;
};

/**
 * Hält fest, welche Angaben für eine Produktion bestätigt wurden. Das Profil selbst wird
 * beim nächsten Onboarding überschrieben, der Snapshot bleibt als Nachweis erhalten.
 */
export function buildProfileSnapshot(
  input: ProfileSnapshotInput,
  now: Date = new Date(),
): Prisma.InputJsonObject {
  return {
    version: PROFILE_SNAPSHOT_VERSION,
    confirmedAt: now.toISOString(),
    dietaryPreference: input.dietaryPreference,
    dietaryPreferenceStrictness: input.dietaryPreferenceStrictness,
    dietary: input.dietary.map((entry) => ({
      allergen: entry.allergen,
      level: entry.level,
      symptoms: entry.symptoms ?? null,
      treatment: entry.treatment ?? null,
      note: entry.note ?? null,
    })),
    preferences: input.preferences
      .filter((preference) => preference.weight > 0)
      .map((preference) => ({
        code: preference.code,
        domain: preference.domain,
        weight: preference.weight,
      })),
    photoConsent: input.photoConsent,
    education: input.education
      ? {
          category: input.education.category,
          schoolName: input.education.schoolName ?? null,
          className: input.education.className ?? null,
          workDescription: input.education.workDescription ?? null,
          universityName: input.education.universityName ?? null,
          otherDescription: input.education.otherDescription ?? null,
        }
      : null,
    notes: input.notes ?? null,
  };
}
