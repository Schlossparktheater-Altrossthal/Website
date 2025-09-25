import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isInviteUsable } from "@/lib/member-invites";
import { sortRoles, ROLES, type Role } from "@/lib/roles";
import { hashPassword } from "@/lib/password";
import { combineNameParts } from "@/lib/names";
import { MAX_INTERESTS_PER_USER } from "@/data/profile";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
]);

const CURRENT_YEAR = new Date().getFullYear();

const genderOptionLabels = {
  female: "Weiblich",
  male: "Männlich",
  diverse: "Divers",
  no_answer: "Keine Angabe",
  custom: "Selbst beschrieben",
} as const;

type GenderOption = keyof typeof genderOptionLabels;

const dietaryStyleLabels = {
  none: "Allesesser:in",
  omnivore: "Allesesser:in",
  vegetarian: "Vegetarisch",
  vegan: "Vegan",
  pescetarian: "Pescetarisch",
  flexitarian: "Flexitarisch",
  halal: "Halal",
  kosher: "Koscher",
  custom: "Individueller Stil",
} as const;

type DietaryStyleOption = keyof typeof dietaryStyleLabels;

const dietaryStrictnessLabels = {
  strict: "Strikt – keine Ausnahmen",
  flexible: "Flexibel – kleine Ausnahmen sind möglich",
  situational: "Situationsabhängig / nach Rücksprache",
} as const;

type DietaryStrictnessOption = keyof typeof dietaryStrictnessLabels;

const preferenceSchema = z.object({
  code: z.string().min(1),
  domain: z.enum(["acting", "crew"]),
  weight: z.number().int().min(0).max(100),
});

const dietarySchema = z.object({
  allergen: z.string().min(2),
  level: z.enum(["MILD", "MODERATE", "SEVERE", "LETHAL"]),
  symptoms: z.string().optional().nullable(),
  treatment: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

const genderSchema = z
  .object({
    option: z.enum(["female", "male", "diverse", "no_answer", "custom"]),
    custom: z.string().max(120).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.option === "custom") {
      const custom = value.custom?.trim() ?? "";
      if (!custom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["custom"],
          message: "Bitte beschreibe dein Geschlecht.",
        });
      }
    }
  });

const dietaryPreferenceSchema = z
  .object({
    style: z.enum(["none", "omnivore", "vegetarian", "vegan", "pescetarian", "flexitarian", "halal", "kosher", "custom"]),
    custom: z.string().max(120).optional().nullable(),
    strictness: z.enum(["strict", "flexible", "situational"]),
  })
  .superRefine((value, ctx) => {
    if (value.style === "custom") {
      const custom = value.custom?.trim() ?? "";
      if (!custom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["custom"],
          message: "Bitte beschreibe deinen Ernährungsstil.",
        });
      }
    }
  });

const payloadSchema = z.object({
  sessionToken: z.string().min(16),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  background: z.string().min(2),
  backgroundClass: z.string().max(120).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: genderSchema,
  memberSinceYear: z.number().int().min(1900).max(CURRENT_YEAR).optional().nullable(),
  focus: z.enum(["acting", "tech", "both"]),
  preferences: z.array(preferenceSchema),
  interests: z.array(z.string().min(1)).max(MAX_INTERESTS_PER_USER),
  dietaryPreference: dietaryPreferenceSchema,
  photoConsent: z
    .object({
      consent: z.boolean(),
      skipDocument: z.boolean().optional(),
    })
    .optional()
    .default({ consent: true }),
  dietary: z.array(dietarySchema).optional().default([]),
});

function sanitizeFilename(name: string | undefined | null) {
  if (!name) return "einverstaendnis.pdf";
  const trimmed = name.trim();
  if (!trimmed) return "einverstaendnis.pdf";
  return trimmed.replace(/[^\w. -]+/g, "_");
}

function calculateAge(date: Date | null | undefined) {
  if (!date) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeString(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase();
}

function requiresBszClass(value: string) {
  if (!value) return false;
  const normalized = normalizeForMatch(value);
  if (!normalized.includes("bsz")) return false;
  return ["altrossthal", "altrothal", "canaletto"].some((keyword) => normalized.includes(keyword));
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Erwartet multipart/form-data" }, { status: 400 });
  }

  const formData = await request.formData();
  const rawPayload = formData.get("payload");
  const documentFile = formData.get("document");

  if (typeof rawPayload !== "string") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(rawPayload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ungültige Eingabe";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const email = normalizeEmail(payload.email);
  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();
  const fullName = combineNameParts(firstName, lastName) ?? null;
  const background = payload.background.trim();
  const backgroundClass = normalizeString(payload.backgroundClass);
  const requiresBackgroundClass = requiresBszClass(background);
  if (requiresBackgroundClass && !backgroundClass) {
    return NextResponse.json({ error: "Bitte gib deine Klasse am BSZ an." }, { status: 400 });
  }
  const notes = normalizeString(payload.notes);
  const focus = payload.focus;
  const password = payload.password;
  const preferences = payload.preferences.filter((pref) => pref.weight > 0);
  const interests = Array.from(
    new Set(payload.interests.map((interest) => interest.trim()).filter((interest) => interest.length > 0)),
  ).slice(0, 30);
  const dietaryRaw = payload.dietary.map((entry) => ({
    allergen: entry.allergen.trim(),
    level: entry.level,
    symptoms: normalizeString(entry.symptoms),
    treatment: normalizeString(entry.treatment),
    note: normalizeString(entry.note),
  }));

  const dietary = (() => {
    const result: typeof dietaryRaw = [];
    const seen = new Set<string>();
    for (const entry of dietaryRaw) {
      const key = entry.allergen.toLocaleLowerCase("de-DE");
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }
    return result;
  })();

  const genderOption = payload.gender.option as GenderOption;
  const genderCustom = normalizeString(payload.gender.custom);
  const genderLabel =
    genderOption === "custom"
      ? genderCustom
      : genderOptionLabels[genderOption] ?? null;
  const genderDisplay = genderLabel ?? genderOptionLabels.no_answer;

  const memberSinceYear = payload.memberSinceYear ?? null;

  const dietaryPreference = payload.dietaryPreference;
  const dietaryStyleOption = dietaryPreference.style as DietaryStyleOption;
  const dietaryCustom = normalizeString(dietaryPreference.custom);
  const dietaryStyleLabel =
    dietaryStyleOption === "custom"
      ? dietaryCustom
      : dietaryStyleLabels[dietaryStyleOption] ?? null;
  const dietaryStyleDisplay = dietaryStyleLabel ?? dietaryStyleLabels.none;

  const dietaryStrictnessOption = dietaryPreference.strictness as DietaryStrictnessOption;
  const dietaryStrictnessLabel = dietaryStrictnessLabels[dietaryStrictnessOption];
  const isBaselineDietaryStyle =
    dietaryStyleOption === "none" || dietaryStyleOption === "omnivore";
  const dietaryStrictnessDisplay = isBaselineDietaryStyle
    ? "Nicht relevant"
    : dietaryStrictnessLabel;

  let dateOfBirth: Date | null = null;
  if (payload.dateOfBirth) {
    const parsed = new Date(payload.dateOfBirth);
    if (Number.isNaN(parsed.valueOf())) {
      return NextResponse.json({ error: "Geburtsdatum ist ungültig" }, { status: 400 });
    }
    dateOfBirth = parsed;
  }

  const age = calculateAge(dateOfBirth);
  const photoConsent = payload.photoConsent ?? { consent: true };

  let documentBuffer: Buffer | null = null;
  let documentMime: string | null = null;
  let documentName: string | null = null;
  let documentSize: number | null = null;

  if (documentFile instanceof File && documentFile.size > 0) {
    if (documentFile.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Dokument darf maximal 8 MB groß sein" }, { status: 400 });
    }
    const type = documentFile.type?.toLowerCase() ?? "";
    if (type && !ALLOWED_DOCUMENT_TYPES.has(type)) {
      return NextResponse.json({ error: "Bitte nutze PDF oder Bilddateien (JPG/PNG)" }, { status: 400 });
    }
    const arrayBuffer = await documentFile.arrayBuffer();
    documentBuffer = Buffer.from(arrayBuffer);
    documentMime = type || null;
    documentName = sanitizeFilename(documentFile.name);
    documentSize = documentBuffer.length;
  }

  if (!documentBuffer) {
    const missingDocumentMessage =
      age !== null && age < 18
        ? "Bitte lade die unterschriebene Einverständniserklärung deiner Erziehungsberechtigten hoch."
        : "Bitte lade dein unterschriebenes Einverständnis hoch oder unterschreibe digital.";
    return NextResponse.json({ error: missingDocumentMessage }, { status: 400 });
  }

  const redemption = await prisma.memberInviteRedemption.findUnique({
    where: { sessionToken: payload.sessionToken },
    include: { invite: true },
  });

  if (!redemption?.invite) {
    return NextResponse.json({ error: "Einladung wurde nicht gefunden" }, { status: 404 });
  }

  if (redemption.completedAt) {
    return NextResponse.json({ error: "Einladung wurde bereits verwendet" }, { status: 409 });
  }

  const invite = redemption.invite;
  if (!isInviteUsable(invite)) {
    return NextResponse.json({ error: "Dieser Einladungslink ist nicht mehr gültig" }, { status: 400 });
  }

  if (!invite.showId) {
    return NextResponse.json(
      { error: "Diese Einladung ist keiner Produktion zugeordnet." },
      { status: 400 },
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Für diese E-Mail existiert bereits ein Konto" }, { status: 409 });
  }

  const rolesFromInvite = invite.roles?.filter((role): role is Role => (ROLES as readonly string[]).includes(role)) ?? [];
  const roles = sortRoles(rolesFromInvite.length ? rolesFromInvite : ["member"]);
  const primaryRole = roles[roles.length - 1];

  const storedPayload = {
    firstName,
    lastName,
    name: fullName,
    email,
    focus,
    background,
    backgroundClass,
    notes,
    dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
    gender: {
      option: genderOption,
      label: genderDisplay,
      custom: genderCustom,
    },
    memberSinceYear,
    preferences,
    interests,
    dietaryPreference: {
      style: dietaryStyleOption,
      label: dietaryStyleDisplay,
      custom: dietaryCustom,
      strictness: dietaryStrictnessOption,
      strictnessLabel: dietaryStrictnessDisplay,
    },
    dietary,
    photoConsent: {
      consent: photoConsent.consent,
      hasDocument: Boolean(documentBuffer),
    },
  };

  try {
    const passwordHash = await hashPassword(password);
    const result = await prisma.$transaction(async (tx) => {
      const latestInvite = await tx.memberInvite.findUnique({ where: { id: invite.id } });
      if (!latestInvite || !isInviteUsable(latestInvite)) {
        throw new Error("InviteUnavailable");
      }

      const user = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          name: fullName,
          role: primaryRole,
          dateOfBirth,
          passwordHash,
          roles: { create: roles.map((role) => ({ role })) },
        },
        select: { id: true, email: true },
      });

      await tx.memberInvite.update({
        where: { id: invite.id },
        data: { usageCount: { increment: 1 } },
      });

      await tx.memberInviteRedemption.update({
        where: { id: redemption.id },
        data: {
          email,
          userId: user.id,
          completedAt: new Date(),
          payload: storedPayload,
        },
      });

      await tx.productionMembership.create({
        data: {
          userId: user.id,
          showId: invite.showId,
        },
      });

      await tx.memberOnboardingProfile.create({
        data: {
          userId: user.id,
          inviteId: invite.id,
          redemptionId: redemption.id,
          showId: invite.showId,
          focus,
          background,
          backgroundClass: backgroundClass ?? undefined,
          notes: notes ?? undefined,
          gender: genderDisplay,
          memberSinceYear: memberSinceYear ?? undefined,
          dietaryPreference: dietaryStyleDisplay,
          dietaryPreferenceStrictness: dietaryStrictnessDisplay,
        },
      });

      if (preferences.length) {
        await tx.memberRolePreference.createMany({
          data: preferences.map((pref) => ({
            userId: user.id,
            code: pref.code,
            domain: pref.domain,
            weight: pref.weight,
          })),
        });
      }

      if (interests.length) {
        const normalizedInterests = Array.from(
          new Map(interests.map((name) => [name.toLowerCase(), name])).entries(),
        );

        const filters = normalizedInterests.map(([, original]) => ({
          name: { equals: original, mode: 'insensitive' as const },
        }));

        let interestRecords = filters.length
          ? await tx.interest.findMany({
              where: { OR: filters },
            })
          : [];

        const existingNames = new Set(interestRecords.map((entry) => entry.name.toLowerCase()));
        const toCreate = normalizedInterests
          .filter(([normalized]) => !existingNames.has(normalized))
          .map(([, original]) => ({ name: original, createdById: user.id }));

        if (toCreate.length) {
          await tx.interest.createMany({
            data: toCreate,
            skipDuplicates: true,
          });
          interestRecords = await tx.interest.findMany({
            where: { OR: filters },
          });
        }

        const interestByName = new Map(
          interestRecords.map((entry) => [entry.name.toLowerCase(), entry]),
        );

        const userInterests = normalizedInterests
          .map(([normalized]) => interestByName.get(normalized))
          .filter((entry): entry is (typeof interestRecords)[number] => Boolean(entry))
          .map((entry) => ({ userId: user.id, interestId: entry.id }));

        if (userInterests.length) {
          await tx.userInterest.createMany({
            data: userInterests,
            skipDuplicates: true,
          });
        }
      }

      if (dietary.length) {
        await tx.dietaryRestriction.createMany({
          data: dietary.map((entry) => ({
            userId: user.id,
            allergen: entry.allergen,
            level: entry.level,
            symptoms: entry.symptoms,
            treatment: entry.treatment,
            note: entry.note,
          })),
        });
      }

      const shouldCreateConsent = photoConsent.consent || documentBuffer || (age !== null && age < 18);
      if (shouldCreateConsent) {
        await tx.photoConsent.create({
          data: {
            userId: user.id,
            consentGiven: photoConsent.consent,
            status: "pending",
            documentName: documentName,
            documentMime: documentMime,
            documentSize: documentSize ?? undefined,
            documentUploadedAt: documentBuffer ? new Date() : null,
            documentData: documentBuffer ?? undefined,
          },
        });
      }

      return { userId: user.id, email: user.email };
    });

    return NextResponse.json({ ok: true, user: result });
  } catch (error) {
    if (error instanceof Error && error.message === "InviteUnavailable") {
      return NextResponse.json({ error: "Einladungslink ist nicht mehr gültig" }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const targetValue = error.meta?.target;
      const target = Array.isArray(targetValue)
        ? targetValue.map((value) => String(value).toLowerCase()).join(" ")
        : String(targetValue ?? "").toLowerCase();

      if (target.includes("allergen")) {
        return NextResponse.json({ error: "Du hast dieses Allergen bereits eingetragen." }, { status: 409 });
      }

      if (target.includes("email")) {
        return NextResponse.json({ error: "Für diese E-Mail existiert bereits ein Konto" }, { status: 409 });
      }

      return NextResponse.json({ error: "Daten existieren bereits" }, { status: 409 });
    }
    console.error("[onboarding.complete]", error);
    return NextResponse.json({ error: "Registrierung fehlgeschlagen" }, { status: 500 });
  }
}
