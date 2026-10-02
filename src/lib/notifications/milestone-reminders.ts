import { findUserIdsWithPermission } from "@/lib/permissions";
import { PLAN_MANAGE_PERMISSION } from "@/lib/planning/plan-service";
import { computeSchedule, daysUntil } from "@/lib/planning/schedule";
import { prisma } from "@/lib/prisma";

import { notify } from "./notify";
import { NOTIFICATION_TYPES } from "./types";

/**
 * Fristerinnerungen des Produktionsplans (docs/Plan/projektplanung-plan.md, „Benachrichtigungen“):
 * Gewerk-Leitung 7 und 2 Tage vorher und bei Überfälligkeit, Planverantwortliche bei kritischem
 * Verzug. Läuft im vorhandenen Erinnerungs-Cron mit; jede Stufe geht je Meilenstein nur einmal raus.
 */

export type MilestoneReminderStage = "d7" | "d2" | "overdue" | "critical";

const PLAN_PATH = "/mitglieder/produktionen";

/** Fällige Stufe für die Gewerk-Leitung, abhängig von den Tagen bis zur Frist. */
export function leadStageFor(days: number): MilestoneReminderStage | null {
  if (days < 0) return "overdue";
  if (days <= 2) return "d2";
  if (days <= 7) return "d7";
  return null;
}

export function reminderText(stage: MilestoneReminderStage, title: string, days: number): string {
  switch (stage) {
    case "d7":
      return `Frist in ${days} Tagen: ${title}`;
    case "d2":
      return days === 0
        ? `Frist heute: ${title}`
        : `Frist in ${days === 1 ? "1 Tag" : `${days} Tagen`}: ${title}`;
    case "overdue":
      return `Überfällig: ${title}`;
    case "critical":
      return `Plan in Gefahr: ${title} verschiebt Folgetermine`;
  }
}

export async function dispatchMilestoneReminders(now: Date = new Date()) {
  const summary = { sent: 0, skipped: 0, failed: 0 };
  const shows = await prisma.show.findMany({
    where: { status: { in: ["planning", "active"] }, milestones: { some: { doneAt: null } } },
    select: {
      id: true,
      premiereAt: true,
      finalRehearsalWeekStart: true,
      milestones: {
        select: {
          id: true,
          title: true,
          anchorType: true,
          anchorMilestoneId: true,
          offsetDays: true,
          fixedDate: true,
          doneAt: true,
          dueAt: true,
          department: {
            select: {
              memberships: {
                where: { role: "lead", status: "active" },
                select: { userId: true },
              },
            },
          },
          reminders: { select: { stage: true } },
        },
      },
    },
  });
  if (!shows.length) return summary;

  let planManagers: string[] | null = null;
  const managers = async () =>
    (planManagers ??= await findUserIdsWithPermission(PLAN_MANAGE_PERMISSION));

  for (const show of shows) {
    const deps = await prisma.milestoneDependency.findMany({
      where: { from: { showId: show.id } },
      select: { fromId: true, toId: true, lagDays: true },
    });
    let schedule: ReturnType<typeof computeSchedule> | null = null;
    try {
      schedule = computeSchedule(
        show.milestones,
        deps,
        { premiereAt: show.premiereAt, finalRehearsalStart: show.finalRehearsalWeekStart },
        now,
      );
    } catch (error) {
      console.error("[milestone-reminders] Plan nicht berechenbar", show.id, error);
    }

    for (const milestone of show.milestones) {
      if (milestone.doneAt || !milestone.dueAt) continue;
      const sent = new Set(milestone.reminders.map((entry) => entry.stage));
      const days = daysUntil(milestone.dueAt, now) ?? 0;
      const stages: { stage: MilestoneReminderStage; recipients: () => Promise<string[]> }[] = [];

      const stage = leadStageFor(days);
      if (stage && !sent.has(stage)) {
        const leads = milestone.department?.memberships.map((entry) => entry.userId) ?? [];
        stages.push({ stage, recipients: async () => (leads.length ? leads : managers()) });
      }
      // Kritischer Verzug: dieser Meilenstein ist überfällig und schiebt offene Nachfolger.
      const endangers = schedule
        ? [...schedule.values()].some((entry) => entry.endangeredBy.includes(milestone.id))
        : false;
      if (endangers && !sent.has("critical")) {
        stages.push({ stage: "critical", recipients: managers });
      }

      for (const entry of stages) {
        try {
          // Erst vormerken, dann senden: ein paralleler Cron-Lauf scheitert am Unique-Index.
          await prisma.milestoneReminderDispatch.create({
            data: { milestoneId: milestone.id, stage: entry.stage },
          });
        } catch (error) {
          // Bereits vorgemerkt (Unique-Index) – kein erneuter Versand.
          console.warn(
            "[milestone-reminders] Stufe schon vorgemerkt",
            milestone.id,
            entry.stage,
            error,
          );
          summary.skipped += 1;
          continue;
        }
        try {
          const recipients = await entry.recipients();
          if (!recipients.length) {
            summary.skipped += 1;
            continue;
          }
          await notify({
            type: NOTIFICATION_TYPES.PLAN_DEADLINE,
            recipients,
            title: reminderText(entry.stage, milestone.title, days),
            actionUrl: PLAN_PATH,
            showId: show.id,
            groupKey: `plan-deadline:${milestone.id}`,
            ...(entry.stage === "critical" || entry.stage === "overdue"
              ? { severity: "error" as const }
              : {}),
          });
          summary.sent += 1;
        } catch (error) {
          console.error("[milestone-reminders] Versand fehlgeschlagen", milestone.id, error);
          summary.failed += 1;
        }
      }
    }
  }
  return summary;
}
