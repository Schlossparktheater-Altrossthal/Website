"use server";

import { createConfiguredMailSender } from "@/lib/email/send";
import { hasPermission } from "@/lib/permissions";
import {
  actionFailure,
  actionSuccess,
  readString,
  revalidateShow,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import {
  findOpenOnboardingUserIds,
  formatReminderSummary,
  sendPhotoConsentReminders,
} from "@/lib/produktionen/production-reminders";
import { inviteFormerMembers } from "@/lib/produktionen/returnee-invites";
import { requireAuth } from "@/lib/rbac";

import type { InviteFormerMembersResult } from "./ensemble";

async function ensureManager() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"))) {
    throw new Error("Du hast keinen Zugriff auf die Produktionsplanung.");
  }
  return session;
}

/** Schickt allen, deren Onboarding noch offen ist, einen neuen persönlichen Link. */
export async function remindOpenOnboardingsAction(
  formData: FormData,
): Promise<InviteFormerMembersResult> {
  try {
    const session = await ensureManager();
    const showId = readString(formData, "showId", { label: "Produktion" });
    const createdById = session.user?.id;
    if (!createdById) throw new Error("Nicht angemeldet.");

    const userIds = await findOpenOnboardingUserIds(showId);
    if (userIds.length === 0) {
      return { ok: true, message: "Niemand hat ein offenes Onboarding.", outcomes: [] };
    }
    const sender = await createConfiguredMailSender();
    const outcomes = await inviteFormerMembers({ showId, userIds, createdById, sender });

    revalidateShow(showId, `/mitglieder/produktionen/${showId}/ensemble`);
    const sent = outcomes.filter((outcome) => outcome.status === "sent").length;
    return {
      ok: true,
      message:
        sent === outcomes.length
          ? `${sent} Erinnerungen mit neuem Link verschickt.`
          : `${sent} Erinnerungen verschickt, ${outcomes.length - sent} Links bitte selbst weitergeben.`,
      outcomes,
    };
  } catch (error) {
    console.error("remindOpenOnboardingsAction", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Erinnerungen konnten nicht verschickt werden.",
    };
  }
}

/** Erinnert aktive Mitglieder ohne (gültige) Fotoerlaubnis für diese Produktion. */
export async function remindMissingPhotoConsentsAction(
  formData: FormData,
): Promise<ProductionActionResult> {
  try {
    await ensureManager();
    const showId = readString(formData, "showId", { label: "Produktion" });
    const sender = await createConfiguredMailSender();
    if (!sender) {
      throw new Error("Es ist kein Mailversand eingerichtet (Server-Einstellungen → E-Mail).");
    }
    const summary = await sendPhotoConsentReminders({ showId, sender });
    return actionSuccess(formatReminderSummary(summary));
  } catch (error) {
    console.error("remindMissingPhotoConsentsAction", error);
    return actionFailure(error, "Erinnerungen konnten nicht verschickt werden.");
  }
}
