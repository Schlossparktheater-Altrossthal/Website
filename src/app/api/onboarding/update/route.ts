import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { AllergyLevel } from "@prisma/client";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const educationCategorySchema = z.enum([
  "school_bsz",
  "school_other",
  "work",
  "university",
  "other",
]);

const preferenceSchema = z.object({
  code: z.string().min(1),
  domain: z.enum(["acting", "crew"]),
  weight: z.number(),
});

const dietarySchema = z.object({
  allergen: z.string().min(1),
  level: z.string(),
  symptoms: z.string(),
  treatment: z.string(),
  note: z.string(),
});

const payloadSchema = z.object({
  educationCategory: educationCategorySchema,
  educationSchoolName: z.string().nullable(),
  educationClassName: z.string().nullable(),
  educationWorkDescription: z.string().nullable(),
  educationUniversityName: z.string().nullable(),
  educationOtherDescription: z.string().nullable(),
  preferences: z.array(preferenceSchema),
  dietaryPreference: z.string().nullable(),
  dietaryPreferenceStrictness: z.string().nullable(),
  dietary: z.array(dietarySchema),
  notes: z.string().nullable(),
  photoConsent: z.object({
    consent: z.boolean(),
  }),
});

function normalizeNullableString(value: string | null) {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeString(value: string) {
  return value.trim();
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Daten" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const educationSchoolName = normalizeNullableString(data.educationSchoolName);
  const educationClassName = normalizeNullableString(data.educationClassName);
  const educationWorkDescription = normalizeNullableString(data.educationWorkDescription);
  const educationUniversityName = normalizeNullableString(data.educationUniversityName);
  const educationOtherDescription = normalizeNullableString(data.educationOtherDescription);
  const notes = normalizeNullableString(data.notes);
  const dietaryPreference = normalizeNullableString(data.dietaryPreference);
  const dietaryPreferenceStrictness = normalizeString(data.dietaryPreferenceStrictness);

  const preferences = data.preferences.map((preference) => ({
    code: normalizeString(preference.code),
    domain: preference.domain,
    weight: preference.weight,
  }));

  const dietaryEntries = data.dietary.map((entry) => ({
    allergen: normalizeString(entry.allergen),
    level: normalizeString(entry.level),
    symptoms: normalizeString(entry.symptoms),
    treatment: normalizeString(entry.treatment),
    note: normalizeString(entry.note),
  }));

  const uniqueDietaryEntries = (() => {
    const result: typeof dietaryEntries = [];
    const seen = new Set<string>();
    for (const entry of dietaryEntries) {
      const key = entry.allergen.toLocaleLowerCase("de-DE");
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }
    return result;
  })();

  try {
    await prisma.$transaction(async (tx) => {
      const onboardingProfile = await tx.memberOnboardingProfile.upsert({
        where: { userId },
        update: {
          educationCategory: data.educationCategory,
          educationSchoolName,
          educationClassName,
          educationWorkDescription,
          educationUniversityName,
          educationOtherDescription,
          notes,
          dietaryPreference,
          dietaryPreferenceStrictness: dietaryPreferenceStrictness,
        },
        create: {
          userId,
          focus: "both",
          educationCategory: data.educationCategory,
          educationSchoolName,
          educationClassName,
          educationWorkDescription,
          educationUniversityName,
          educationOtherDescription,
          notes,
          dietaryPreference,
          dietaryPreferenceStrictness: dietaryPreferenceStrictness,
        },
        select: { id: true },
      });

      void onboardingProfile;

      await tx.memberRolePreference.deleteMany({
        where: { userId },
      });

      if (preferences.length > 0) {
        await tx.memberRolePreference.createMany({
          data: preferences.map((preference) => ({
            userId,
            code: preference.code,
            domain: preference.domain,
            weight: preference.weight,
          })),
        });
      }

      await Promise.all(
        uniqueDietaryEntries.map((entry) =>
          tx.dietaryRestriction.upsert({
            where: {
              userId_allergen: {
                userId,
                allergen: entry.allergen,
              },
            },
            update: {
              level: entry.level as AllergyLevel,
              symptoms: entry.symptoms,
              treatment: entry.treatment,
              note: entry.note,
              isActive: true,
            },
            create: {
              userId,
              allergen: entry.allergen,
              level: entry.level as AllergyLevel,
              symptoms: entry.symptoms,
              treatment: entry.treatment,
              note: entry.note,
              isActive: true,
            },
          }),
        ),
      );

      await tx.dietaryRestriction.updateMany({
        where: {
          userId,
          allergen: {
            notIn: uniqueDietaryEntries.map((entry) => entry.allergen),
          },
        },
        data: { isActive: false },
      });

      await tx.photoConsent.upsert({
        where: { userId },
        update: {
          consentGiven: data.photoConsent.consent,
        },
        create: {
          userId,
          consentGiven: data.photoConsent.consent,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          onboardingUpdatedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Onboarding][Update] update failed", error);
    return NextResponse.json(
      { error: "Aktualisierung fehlgeschlagen" },
      { status: 500 },
    );
  }
}
