import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { linkOpenRestrictions } from "@/lib/food/restriction-store";

import { auth } from "@/auth";
import { ALLERGEN_KIND_VALUES } from "@/data/allergens";
import { ALLERGY_LEVEL_VALUES } from "@/data/allergy-styles";
import {
  dietaryPreferenceSchema,
  parseDietaryStrictnessFromLabel,
  parseDietaryStyleFromLabel,
  resolveDietaryStrictnessLabel,
  resolveDietaryStyleLabel,
  resolveDietaryVariantLabel,
} from "@/data/dietary-preferences";
import { replaceProductionPreferences } from "@/lib/onboarding/production-preferences";
import { legacyBackgroundFromPayload } from "@/lib/education/schools";
import { normalizeInterestList, replaceUserInterests } from "@/lib/profil/interests";
import { prisma } from "@/lib/prisma";
import { getActiveProductionId } from "@/lib/active-production";
import { ONBOARDING_TOKEN_COOKIE } from "@/lib/authentik/config";
import { requestServiceGroupSync } from "@/lib/authentik/service-groups";
import { buildProfileSnapshot } from "@/lib/onboarding/production-onboarding";
import { MAX_PHOTO_CONSENT_NOTE, PHOTO_CONSENT_LEVELS } from "@/lib/photo-consent-levels";
import { calculatePhotoConsentAge } from "@/lib/photo-consent-summary";
import {
  checkPhotoConsentSubmission,
  persistPhotoConsentSubmission,
  type PhotoConsentDocumentInput,
  type PhotoConsentSignatureInput,
} from "@/lib/photo-consent-submission";
import { signatureSubmissionSchema } from "@/types/signature";
import {
  sanitizeProductionRoles,
  syncProductionRoles,
  type ProductionRole,
} from "@/lib/produktionen/production-roles";
import { calculateInviteStatus, hashInviteToken } from "@/lib/member-invites";

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
  level: z.enum(ALLERGY_LEVEL_VALUES),
  kind: z.enum(ALLERGEN_KIND_VALUES).optional().default("ALLERGY"),
  tracesOk: z.boolean().nullable().optional().default(null),
  diagnosed: z.boolean().optional().default(false),
  symptoms: z.string().nullable(),
  treatment: z.string().nullable(),
  note: z.string().nullable(),
});

/** Altform vor der strukturierten Angabe: `none` war „Allesesser", der Freitext hieß `custom`. */
const nutritionPreferenceSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record: Record<string, unknown> = { ...value };
  if (record.style === "none") {
    record.style = "omnivore";
  }
  if (record.customLabel == null && typeof record.custom === "string") {
    record.customLabel = record.custom;
  }
  return record;
}, dietaryPreferenceSchema);

const payloadSchema = z.object({
  educationCategory: educationCategorySchema,
  educationSchoolName: z.string().nullable(),
  educationClassName: z.string().nullable(),
  educationWorkDescription: z.string().nullable(),
  educationUniversityName: z.string().nullable(),
  educationOtherDescription: z.string().nullable(),
  preferences: z.array(preferenceSchema),
  /** Strukturierte Angabe des Wizards. Ältere Clients senden hier noch das Label als String. */
  dietaryPreference: z.union([nutritionPreferenceSchema, z.string()]).nullable().optional(),
  dietaryPreferenceStrictness: z.string().nullable().optional(),
  dietary: z.array(dietarySchema),
  notes: z.string().nullable(),
  photoConsent: z.object({
    level: z.enum(PHOTO_CONSENT_LEVELS),
    note: z.string().max(MAX_PHOTO_CONSENT_NOTE).optional().nullable(),
    deferProof: z.boolean().optional(),
    signature: signatureSubmissionSchema.optional().nullable(),
  }),
  /** Fehlt das Feld, bleiben die Interessen unverändert (ältere Clients). */
  interests: z.array(z.string()).optional(),
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
  const rawPayload = formData.get("payload");
  const documentFile = formData.get("document");
  const rawOnboardingToken = formData.get("onboardingToken");
  const onboardingToken = typeof rawOnboardingToken === "string" ? rawOnboardingToken.trim() : null;

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
  // Das Profil speichert Labels (Entscheidung E1 im Plan). Beide Payload-Formen werden hier auf
  // dieselben drei Labels gebracht, damit der Bestand einheitlich bleibt.
  const dietary = (() => {
    const structured = data.dietaryPreference;
    if (structured && typeof structured === "object") {
      return {
        preference: resolveDietaryStyleLabel(structured.style, structured.customLabel).label,
        variant: resolveDietaryVariantLabel(structured.style, structured.variant),
        strictness: resolveDietaryStrictnessLabel(structured.style, structured.strictness),
      };
    }
    const { style, customLabel } = parseDietaryStyleFromLabel(
      typeof structured === "string" ? structured : null,
    );
    return {
      preference: resolveDietaryStyleLabel(style, customLabel).label,
      variant: null,
      strictness: resolveDietaryStrictnessLabel(
        style,
        parseDietaryStrictnessFromLabel(data.dietaryPreferenceStrictness),
      ),
    };
  })();

  const preferences = data.preferences.map((preference) => ({
    code: normalizeString(preference.code),
    domain: preference.domain,
    weight: preference.weight,
  }));

  const dietaryEntries = data.dietary.map((entry) => ({
    allergen: normalizeString(entry.allergen),
    level: entry.level,
    kind: entry.kind,
    tracesOk: entry.tracesOk,
    diagnosed: entry.diagnosed,
    symptoms: normalizeNullableString(entry.symptoms),
    treatment: normalizeNullableString(entry.treatment),
    note: normalizeNullableString(entry.note),
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

  const photoLevel = data.photoConsent.level;
  const photoNote = data.photoConsent.note?.trim() || null;
  const signaturePayload =
    photoLevel === "none" ? null : (data.photoConsent.signature?.payload ?? null);
  const photoSignature: PhotoConsentSignatureInput | null = signaturePayload
    ? {
        version: signaturePayload.version,
        capturedAt: (() => {
          const parsed = new Date(signaturePayload.endedAt);
          return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
        })(),
        payload: signaturePayload,
      }
    : null;

  let photoDocument: PhotoConsentDocumentInput | null = null;
  if (
    photoLevel !== "none" &&
    !photoSignature &&
    documentFile instanceof File &&
    documentFile.size > 0
  ) {
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
    const bytes = new Uint8Array(await documentFile.arrayBuffer());
    photoDocument = {
      name: sanitizeFilename(documentFile.name),
      mime: type || "application/octet-stream",
      size: bytes.length,
      data: bytes,
    };
  }

  let targetShowId: string | null = null;
  let targetInviteId: string | null = null;
  let targetInviteRoles: ProductionRole[] = [];
  if (onboardingToken) {
    const tokenHash = /^[0-9a-f]{64}$/i.test(onboardingToken)
      ? onboardingToken.toLowerCase()
      : hashInviteToken(onboardingToken);
    const invite = await prisma.memberInvite.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        showId: true,
        roles: true,
        personalForUserId: true,
        expiresAt: true,
        maxUses: true,
        usageCount: true,
        isDisabled: true,
      },
    });
    if (invite) {
      const status = calculateInviteStatus(invite);
      if (invite.personalForUserId && invite.personalForUserId !== userId) {
        return NextResponse.json(
          { error: "Dieser Einladungslink ist für eine andere Person bestimmt." },
          { status: 403 },
        );
      }
      if (status.isActive && invite.showId) {
        targetShowId = invite.showId;
        targetInviteId = invite.id;
        targetInviteRoles = sanitizeProductionRoles(invite.roles ?? []);
      }
    }
  }

  // Deaktivierte Rückkehrer kommen nur mit gültigem Einladungslink hierher; der Abschluss
  // schaltet ihr Konto wieder frei.
  const isDeactivated = Boolean(session?.user?.isDeactivated);
  if (isDeactivated && !targetInviteId) {
    return NextResponse.json(
      { error: "Dein Konto ist deaktiviert. Bitte nutze den Einladungslink der Produktion." },
      { status: 403 },
    );
  }
  const reactivate = isDeactivated && Boolean(targetInviteId);

  const consentShowId = targetShowId ?? (await getActiveProductionId(userId));

  const [photoUser, existingConsent] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true } }),
    consentShowId
      ? prisma.photoConsent.findUnique({
          where: { userId_showId: { userId, showId: consentShowId } },
          select: { documentUploadedAt: true, signatureCapturedAt: true, revokedAt: true },
        })
      : null,
  ]);
  const photoAge = calculatePhotoConsentAge(photoUser?.dateOfBirth ?? null);
  const photoError = checkPhotoConsentSubmission({
    level: photoLevel,
    isMinor: photoAge === null ? null : photoAge < 18,
    hasDateOfBirth: Boolean(photoUser?.dateOfBirth),
    hasNewProof: Boolean(photoSignature || photoDocument),
    hasExistingProof: Boolean(
      existingConsent &&
      !existingConsent.revokedAt &&
      (existingConsent.documentUploadedAt || existingConsent.signatureCapturedAt),
    ),
    deferProof: Boolean(data.photoConsent.deferProof),
  });
  if (photoError) {
    return NextResponse.json({ error: photoError }, { status: 400 });
  }

  const legacyBackground = legacyBackgroundFromPayload({
    educationCategory: data.educationCategory,
    educationSchoolName,
    educationClassName,
    educationWorkDescription,
    educationUniversityName,
    educationOtherDescription,
  });

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
          ...legacyBackground,
          notes,
          dietaryPreference: dietary.preference,
          dietaryPreferenceVariant: dietary.variant,
          dietaryPreferenceStrictness: dietary.strictness,
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
          ...legacyBackground,
          notes,
          dietaryPreference: dietary.preference,
          dietaryPreferenceVariant: dietary.variant,
          dietaryPreferenceStrictness: dietary.strictness,
        },
        select: { id: true, focus: true },
      });

      if (consentShowId) {
        const now = new Date();
        const profileSnapshot = buildProfileSnapshot(
          {
            dietaryPreference: dietary.preference,
            dietaryPreferenceVariant: dietary.variant,
            dietaryPreferenceStrictness: dietary.strictness,
            dietary: uniqueDietaryEntries,
            preferences,
            photoConsent: photoLevel !== "none",
            education: {
              category: data.educationCategory,
              schoolName: educationSchoolName,
              className: educationClassName,
              workDescription: educationWorkDescription,
              universityName: educationUniversityName,
              otherDescription: educationOtherDescription,
            },
            notes,
          },
          now,
        );
        await tx.productionOnboarding.upsert({
          where: { userId_showId: { userId, showId: consentShowId } },
          update: {
            completedAt: now,
            profileSnapshot,
            notes,
            ...(targetInviteId ? { inviteId: targetInviteId } : {}),
          },
          create: {
            userId,
            showId: consentShowId,
            inviteId: targetInviteId,
            focus: onboardingProfile.focus,
            isReturning: true,
            completedAt: now,
            profileSnapshot,
            notes,
          },
        });
      }

      await replaceProductionPreferences(tx, userId, consentShowId, preferences);

      if (data.interests) {
        await replaceUserInterests(tx, userId, normalizeInterestList(data.interests));
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
              level: entry.level,
              kind: entry.kind,
              tracesOk: entry.tracesOk,
              diagnosed: entry.diagnosed,
              symptoms: entry.symptoms,
              treatment: entry.treatment,
              note: entry.note,
              isActive: true,
            },
            create: {
              userId,
              allergen: entry.allergen,
              level: entry.level,
              kind: entry.kind,
              tracesOk: entry.tracesOk,
              diagnosed: entry.diagnosed,
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

      if (consentShowId) {
        // Jede Änderung muss erneut freigegeben werden.
        await persistPhotoConsentSubmission(tx, {
          userId,
          showId: consentShowId,
          level: photoLevel,
          exclusionNote: photoNote,
          document: photoDocument,
          signature: photoSignature,
          submittedById: userId,
          source: "returnee",
        });
      }

      if (targetShowId) {
        await tx.productionMembership.upsert({
          where: {
            showId_userId: {
              showId: targetShowId,
              userId,
            },
          },
          // Bestehende Rollen vergibt die Produktionsleitung; neue Mitgliedschaften
          // starten mit den Rollen aus der Einladung.
          update: { leftAt: null, status: "active" },
          create: {
            showId: targetShowId,
            userId,
            status: "active",
            roles: targetInviteRoles,
          },
        });
        await syncProductionRoles([userId], tx);
      }

      // Auch Rückkehrer verbrauchen die Einladung (persönliche Links sind einmal nutzbar).
      if (targetInviteId) {
        await tx.memberInvite.update({
          where: { id: targetInviteId },
          data: { usageCount: { increment: 1 } },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          onboardingUpdatedAt: new Date(),
          ...(reactivate ? { deactivatedAt: null } : {}),
        },
      });
    });

    if (reactivate) {
      requestServiceGroupSync();
    }
    // Allergie-Freitexte mit der Lebensmittel-Taxonomie verknüpfen (nie blockierend).
    await linkOpenRestrictions(userId);

    const response = NextResponse.json({ success: true, reactivated: reactivate }, { status: 200 });
    // Die gemerkte Einladung ist verbraucht (siehe /api/auth/onboarding-token).
    response.cookies.delete(ONBOARDING_TOKEN_COOKIE);
    return response;
  } catch (error) {
    console.error("[Onboarding][Update] update failed", error);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}
