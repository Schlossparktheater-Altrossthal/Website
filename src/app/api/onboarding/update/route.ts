import { NextRequest, NextResponse } from "next/server";
import { AllergyLevel } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/auth";
import { replaceProductionPreferences } from "@/lib/onboarding/production-preferences";
import { prisma } from "@/lib/prisma";
import { getActiveProductionId } from "@/lib/active-production";
import { ONBOARDING_TOKEN_COOKIE } from "@/lib/authentik/config";
import { requestServiceGroupSync } from "@/lib/authentik/service-groups";
import { buildProfileSnapshot } from "@/lib/onboarding/production-onboarding";
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
  level: z.string(),
  symptoms: z.string().nullable(),
  treatment: z.string().nullable(),
  note: z.string().nullable(),
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
  photoConsent: z.boolean(),
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
        select: { id: true, focus: true },
      });

      if (consentShowId) {
        const now = new Date();
        const profileSnapshot = buildProfileSnapshot(
          {
            dietaryPreference,
            dietaryPreferenceStrictness,
            dietary: uniqueDietaryEntries,
            preferences,
            photoConsent: data.photoConsent,
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

      if (consentShowId) {
        const documentFields = documentBuffer
          ? {
              documentData: documentBuffer,
              documentMime,
              documentName,
              documentSize,
              documentUploadedAt: new Date(),
            }
          : {};
        // Jede Änderung muss erneut freigegeben werden.
        await tx.photoConsent.upsert({
          where: { userId_showId: { userId, showId: consentShowId } },
          update: {
            consentGiven: data.photoConsent,
            status: "pending",
            approvedAt: null,
            approvedById: null,
            rejectionReason: null,
            revokedAt: null,
            ...documentFields,
          },
          create: {
            userId,
            showId: consentShowId,
            consentGiven: data.photoConsent,
            ...documentFields,
          },
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

    const response = NextResponse.json({ success: true, reactivated: reactivate }, { status: 200 });
    // Die gemerkte Einladung ist verbraucht (siehe /api/auth/onboarding-token).
    response.cookies.delete(ONBOARDING_TOKEN_COOKIE);
    return response;
  } catch (error) {
    console.error("[Onboarding][Update] update failed", error);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}
