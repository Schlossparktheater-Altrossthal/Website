"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { ACTIVE_PRODUCTION_COOKIE } from "@/lib/active-production";
import { setOnboardingWhatsAppLink } from "@/lib/onboarding-settings";

import {
  actionFailure,
  actionSuccess,
  parseCheckbox,
  parseOptionalDate,
  parseRedirectPath,
  readInt,
  readOptionalString,
  readString,
  revalidateShow,
  type ProductionActionResult,
} from "./helpers";

export async function setActiveProductionAction(
  formData: FormData,
): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
    if (!allowed) {
      throw new Error("Du hast keinen Zugriff auf die Produktionsplanung.");
    }

    const showId = readString(formData, "showId", { label: "Produktion" });
    const redirectPath = readOptionalString(formData, "redirectPath");

    const show = await prisma.show.findUnique({ where: { id: showId }, select: { id: true } });
    if (!show) {
      throw new Error("Produktion wurde nicht gefunden.");
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_PRODUCTION_COOKIE, show.id, {
      maxAge: 60 * 60 * 24 * 180,
      sameSite: "lax",
      path: "/",
    });

    revalidatePath("/mitglieder", "layout");
    if (redirectPath) {
      revalidatePath(redirectPath);
    }
    return actionSuccess("Aktive Produktion wurde gesetzt.");
  } catch (error) {
    return actionFailure(error, "Aktive Produktion konnte nicht gesetzt werden.");
  }
}

export async function clearActiveProductionAction(
  formData: FormData,
): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
    if (!allowed) {
      throw new Error("Du hast keinen Zugriff auf die Produktionsplanung.");
    }

    const redirectPath = readOptionalString(formData, "redirectPath");

    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_PRODUCTION_COOKIE);

    revalidatePath("/mitglieder", "layout");
    if (redirectPath) {
      revalidatePath(redirectPath);
    }
    return actionSuccess("Aktive Produktion wurde zurückgesetzt.");
  } catch (error) {
    return actionFailure(error, "Aktive Produktion konnte nicht entfernt werden.");
  }
}

export async function createProductionAction(formData: FormData): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
    if (!allowed) {
      throw new Error("Du hast keinen Zugriff auf die Produktionsplanung.");
    }

    const year = readInt(formData, "year", { label: "Jahr", min: 1900, max: 2200 });
    const title = readOptionalString(formData, "title", {
      label: "Titel",
      minLength: 2,
      maxLength: 160,
    });
    const synopsis = readOptionalString(formData, "synopsis", {
      label: "Kurzbeschreibung",
      minLength: 2,
      maxLength: 600,
    });
    const startDate = parseOptionalDate(formData, "startDate", "Startdatum");
    const endDate = parseOptionalDate(formData, "endDate", "Enddatum");
    const revealDate = parseOptionalDate(formData, "revealDate", "Premierenankündigung");
    const finalRehearsalWeekStart = parseOptionalDate(
      formData,
      "finalRehearsalWeekStart",
      "Start der Endprobenwoche",
    );
    const finalRehearsalWeekEnd = parseOptionalDate(
      formData,
      "finalRehearsalWeekEnd",
      "Ende der Endprobenwoche",
    );

    if (finalRehearsalWeekEnd && !finalRehearsalWeekStart) {
      throw new Error(
        "Bitte gib auch ein Startdatum an, wenn du ein Enddatum für die Endprobenwoche festlegst.",
      );
    }
    if (
      finalRehearsalWeekStart &&
      finalRehearsalWeekEnd &&
      finalRehearsalWeekEnd.getTime() < finalRehearsalWeekStart.getTime()
    ) {
      throw new Error("Das Ende der Endprobenwoche darf nicht vor dem Start liegen.");
    }
    const setActive = parseCheckbox(formData.get("setActive"));
    const redirectPath = readOptionalString(formData, "redirectPath");

    if (endDate && !startDate) {
      throw new Error("Bitte gib auch ein Startdatum an, wenn du ein Enddatum festlegst.");
    }
    if (startDate && endDate && endDate < startDate) {
      throw new Error("Das Enddatum darf nicht vor dem Startdatum liegen.");
    }

    const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

    const show = await prisma.show.create({
      data: {
        year,
        title: title ?? null,
        synopsis: synopsis ?? null,
        dates:
          startDate && endDate
            ? `${formatDateOnly(startDate)}/${formatDateOnly(endDate)}`
            : startDate
              ? formatDateOnly(startDate)
              : Prisma.JsonNull,
        revealedAt: revealDate ?? null,
        finalRehearsalWeekStart: finalRehearsalWeekStart ?? null,
        finalRehearsalWeekEnd: finalRehearsalWeekEnd ?? null,
      },
      select: { id: true },
    });

    if (setActive) {
      const cookieStore = await cookies();
      cookieStore.set(ACTIVE_PRODUCTION_COOKIE, show.id, {
        maxAge: 60 * 60 * 24 * 180,
        sameSite: "lax",
        path: "/",
      });

      if (session.user?.id) {
        await prisma.productionMembership.upsert({
          where: {
            showId_userId: {
              showId: show.id,
              userId: session.user.id,
            },
          },
          update: {
            leftAt: null,
          },
          create: {
            showId: show.id,
            userId: session.user.id,
          },
        });
      }
    }

    revalidatePath("/mitglieder", "layout");
    revalidatePath("/mitglieder/produktionen");
    if (redirectPath) {
      revalidatePath(redirectPath);
    }
    return actionSuccess("Produktion wurde erstellt.");
  } catch (error) {
    console.error("createProductionAction", error);
    return actionFailure(error, "Produktion konnte nicht angelegt werden.");
  }
}

export async function updateProductionAction(formData: FormData): Promise<ProductionActionResult> {
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
    if (!allowed) {
      throw new Error("Du hast keinen Zugriff auf die Produktionsplanung.");
    }

    const showId = readString(formData, "showId", { label: "Produktion" });
    const year = readInt(formData, "year", { label: "Jahr", min: 1900, max: 2200 });
    const title = readOptionalString(formData, "title", {
      label: "Titel",
      minLength: 2,
      maxLength: 160,
    });
    const synopsis = readOptionalString(formData, "synopsis", {
      label: "Kurzbeschreibung",
      minLength: 2,
      maxLength: 600,
    });
    const startDate = parseOptionalDate(formData, "startDate", "Startdatum");
    const endDate = parseOptionalDate(formData, "endDate", "Enddatum");
    const revealDate = parseOptionalDate(formData, "revealDate", "Premierenankündigung");
    const finalRehearsalWeekStart = parseOptionalDate(
      formData,
      "finalRehearsalWeekStart",
      "Start der Endprobenwoche",
    );
    const finalRehearsalWeekEnd = parseOptionalDate(
      formData,
      "finalRehearsalWeekEnd",
      "Ende der Endprobenwoche",
    );
    const redirectPath = readOptionalString(formData, "redirectPath");

    if (endDate && !startDate) {
      throw new Error("Bitte gib auch ein Startdatum an, wenn du ein Enddatum festlegst.");
    }
    if (startDate && endDate && endDate < startDate) {
      throw new Error("Das Enddatum darf nicht vor dem Startdatum liegen.");
    }

    const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

    await prisma.show.update({
      where: { id: showId },
      data: {
        year,
        title: title ?? null,
        synopsis: synopsis ?? null,
        dates:
          startDate && endDate
            ? `${formatDateOnly(startDate)}/${formatDateOnly(endDate)}`
            : startDate
              ? formatDateOnly(startDate)
              : Prisma.JsonNull,
        revealedAt: revealDate ?? null,
        finalRehearsalWeekStart: finalRehearsalWeekStart ?? null,
        finalRehearsalWeekEnd: finalRehearsalWeekEnd ?? null,
      },
    });

    revalidateShow(showId, redirectPath, true);
    return actionSuccess("Produktion wurde aktualisiert.");
  } catch (error) {
    console.error("updateProductionAction", error);
    return actionFailure(error, "Produktion konnte nicht aktualisiert werden.");
  }
}

export async function updateProductionTimelineAction(formData: FormData): Promise<void> {
  const redirectPath = parseRedirectPath(formData);
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
    if (!allowed) {
      throw new Error("Du hast keinen Zugriff auf die Produktionsplanung.");
    }

    const showId = readString(formData, "showId", { label: "Produktion" });
    const finalRehearsalWeekStart = parseOptionalDate(
      formData,
      "finalRehearsalWeekStart",
      "Start der Endprobenwoche",
    );
    const finalRehearsalWeekEnd = parseOptionalDate(
      formData,
      "finalRehearsalWeekEnd",
      "Ende der Endprobenwoche",
    );

    if (finalRehearsalWeekEnd && !finalRehearsalWeekStart) {
      throw new Error(
        "Bitte gib auch ein Startdatum an, wenn du ein Enddatum für die Endprobenwoche festlegst.",
      );
    }
    if (
      finalRehearsalWeekStart &&
      finalRehearsalWeekEnd &&
      finalRehearsalWeekEnd.getTime() < finalRehearsalWeekStart.getTime()
    ) {
      throw new Error("Das Ende der Endprobenwoche darf nicht vor dem Start liegen.");
    }

    await prisma.show.update({
      where: { id: showId },
      data: {
        finalRehearsalWeekStart: finalRehearsalWeekStart ?? null,
        finalRehearsalWeekEnd: finalRehearsalWeekEnd ?? null,
      },
    });

    revalidateShow(showId, redirectPath, true);
  } catch (error) {
    console.error("updateProductionTimelineAction", error);
    const message =
      error instanceof Error ? error.message : "Produktion konnte nicht aktualisiert werden.";
    throw new Error(message);
  }
}

function normalizeWhatsAppLink(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Bitte gib einen gültigen WhatsApp-Link an.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("WhatsApp-Links müssen mit https:// beginnen.");
  }

  const host = parsed.hostname.toLowerCase();
  const allowedHosts = [
    "chat.whatsapp.com",
    "whatsapp.com",
    "www.whatsapp.com",
    "wa.me",
    "api.whatsapp.com",
  ];
  const isAllowedHost = allowedHosts.some(
    (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`),
  );
  if (!isAllowedHost) {
    throw new Error("Bitte nutze einen offiziellen WhatsApp-Beitrittslink.");
  }

  return parsed.toString();
}

export async function updateOnboardingSettingsAction(formData: FormData): Promise<void> {
  const redirectPath = parseRedirectPath(formData);
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
    if (!allowed) {
      throw new Error("Du hast keinen Zugriff auf die Produktionsplanung.");
    }

    const showId = readString(formData, "showId", { label: "Produktion" });
    const shouldClear = formData.get("clear") === "1";
    let whatsappLink: string | null = null;

    if (!shouldClear) {
      const rawLink = readOptionalString(formData, "whatsappLink", {
        label: "WhatsApp-Link",
        maxLength: 500,
      });

      if (rawLink) {
        whatsappLink = normalizeWhatsAppLink(rawLink);
      }
    }

    const show = await prisma.show.findUnique({ where: { id: showId }, select: { meta: true } });
    if (!show) {
      throw new Error("Produktion wurde nicht gefunden.");
    }

    const updatedMeta = setOnboardingWhatsAppLink(show.meta, whatsappLink);

    await prisma.show.update({
      where: { id: showId },
      data: { meta: updatedMeta as Prisma.InputJsonValue },
    });

    revalidateShow(showId, redirectPath, false);
  } catch (error) {
    console.error("updateOnboardingSettingsAction", error);
    const message =
      error instanceof Error
        ? error.message
        : "Onboarding-Einstellungen konnten nicht gespeichert werden.";
    throw new Error(message);
  }
}
