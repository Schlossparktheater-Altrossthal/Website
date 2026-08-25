import { NextRequest, NextResponse } from "next/server";
import { AllergyLevel } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);

function sanitizeFilename(name: string | undefined | null) {
  if (!name) return "einverstaendnis.pdf";
  const trimmed = name.trim();
  if (!trimmed) return "einverstaendnis.pdf";
  return trimmed.replace(/[^\w. -]+/g, "_");
}

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
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const formData = await request.formData();
  const rawPayload = formData.get("data");
  const documentFile = formData.get("document");

  if (typeof rawPayload !== "string") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

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
  const dietaryPreferenceStrictness = normalizeString(data.dietaryPreferenceStrictness ?? "");

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

  let documentBuffer: Uint8Array<ArrayBuffer> | null = null;
  let documentMime: string | null = null;
  let documentName: string | null = null;
  let documentSize: number | null = null;

  if (documentFile instanceof File && documentFile.size > 0) {
    if (documentFile.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Dokument darf maximal 8 MB groß sein" }, { status: 400 });
    }
    const type = documentFile.type?.toLowerCase() ?? "";
    if (type && !ALLOWED_DOCUMENT_TYPES.has(type)) {
      return NextResponse.json(
        { error: "Bitte nutze PDF oder Bilddateien (JPG/PNG)" },
        { status: 400 },
      );
    }
    const arrayBuffer = await documentFile.arrayBuffer();
    documentBuffer = new Uint8Array(arrayBuffer);
    documentMime = type || null;
    documentName = sanitizeFilename(documentFile.name);
    documentSize = documentBuffer.length;
  }

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
          ...(documentBuffer
            ? {
                documentData: documentBuffer,
                documentMime,
                documentName,
                documentSize,
                documentUploadedAt: new Date(),
              }
            : {}),
        },
        create: {
          userId,
          consentGiven: data.photoConsent.consent,
          ...(documentBuffer
            ? {
                documentData: documentBuffer,
                documentMime,
                documentName,
                documentSize,
                documentUploadedAt: new Date(),
              }
            : {}),
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
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}
