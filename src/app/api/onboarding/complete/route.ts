import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isInviteUsable } from "@/lib/member-invites";
import { sortRoles, ROLES, type Role } from "@/lib/roles";
import { hashPassword } from "@/lib/password";

const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
]);

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

const payloadSchema = z.object({
  sessionToken: z.string().min(16),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  background: z.string().min(2),
  dateOfBirth: z.string().optional().nullable(),
  focus: z.enum(["acting", "tech", "both"]),
  preferences: z.array(preferenceSchema),
  interests: z.array(z.string().min(1)).max(30),
  photoConsent: z
    .object({
      consent: z.boolean(),
      skipDocument: z.boolean().optional(),
    })
    .optional()
    .default({ consent: true, skipDocument: false }),
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
  const background = payload.background.trim();
  const focus = payload.focus;
  const password = payload.password;
  const preferences = payload.preferences.filter((pref) => pref.weight > 0);
  const interests = Array.from(
    new Set(payload.interests.map((interest) => interest.trim()).filter((interest) => interest.length > 0)),
  ).slice(0, 30);
  const dietary = payload.dietary.map((entry) => ({
    allergen: entry.allergen.trim(),
    level: entry.level,
    symptoms: normalizeString(entry.symptoms),
    treatment: normalizeString(entry.treatment),
    note: normalizeString(entry.note),
  }));

  let dateOfBirth: Date | null = null;
  if (payload.dateOfBirth) {
    const parsed = new Date(payload.dateOfBirth);
    if (Number.isNaN(parsed.valueOf())) {
      return NextResponse.json({ error: "Geburtsdatum ist ungültig" }, { status: 400 });
    }
    dateOfBirth = parsed;
  }

  const age = calculateAge(dateOfBirth);
  const photoConsent = payload.photoConsent ?? { consent: true, skipDocument: false };
  const skipDocument = Boolean(photoConsent.skipDocument);

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

  if (age !== null && age < 18 && !skipDocument && !documentBuffer) {
    return NextResponse.json({ error: "Bitte lade die unterschriebene Einverständniserklärung hoch oder überspringe den Upload" }, { status: 400 });
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

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Für diese E-Mail existiert bereits ein Konto" }, { status: 409 });
  }

  const rolesFromInvite = invite.roles?.filter((role): role is Role => (ROLES as readonly string[]).includes(role)) ?? [];
  const roles = sortRoles(rolesFromInvite.length ? rolesFromInvite : ["member"]);
  const primaryRole = roles[roles.length - 1];

  const storedPayload = {
    name: payload.name,
    email,
    focus,
    background,
    dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
    preferences,
    interests,
    dietary,
    photoConsent: {
      consent: photoConsent.consent,
      skipDocument,
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
          name: payload.name.trim(),
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

      await tx.memberOnboardingProfile.create({
        data: {
          userId: user.id,
          inviteId: invite.id,
          redemptionId: redemption.id,
          focus,
          background,
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
        for (const interestName of interests) {
          const existing = await tx.interest.findFirst({
            where: { name: { equals: interestName, mode: "insensitive" } },
          });
          const interest =
            existing ??
            (await tx.interest.create({
              data: { name: interestName, createdById: user.id },
            }));
          await tx.userInterest.create({
            data: { userId: user.id, interestId: interest.id },
          });
        }
      }

      if (dietary.length) {
        for (const entry of dietary) {
          await tx.dietaryRestriction.create({
            data: {
              userId: user.id,
              allergen: entry.allergen,
              level: entry.level,
              symptoms: entry.symptoms,
              treatment: entry.treatment,
              note: entry.note,
            },
          });
        }
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
      return NextResponse.json({ error: "Für diese E-Mail existiert bereits ein Konto" }, { status: 409 });
    }
    console.error("[onboarding.complete]", error);
    return NextResponse.json({ error: "Registrierung fehlgeschlagen" }, { status: 500 });
  }
}
