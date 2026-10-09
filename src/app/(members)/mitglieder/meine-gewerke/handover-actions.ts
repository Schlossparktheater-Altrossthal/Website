"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { notifyRequestersIfReady } from "@/lib/ausstattung/notify";
import { syncObjectFromTask } from "@/lib/ausstattung/service";
import {
  claimActive,
  NOTE_LIMIT,
  STEP_LIMIT,
  WORK_STATUS_LABELS,
  type ActivityEntry,
} from "@/lib/departments/activity-format";
import { ensureBoardColumns, requireBoardAccess } from "@/lib/departments/board";
import {
  buildHandoverSummary,
  canEditNotes,
  handoverRecipients,
  loadHandoverSettings,
  loadTaskActivity,
  loadTaskFeed,
  logTaskActivity,
  type FeedEntry,
  type HandoverSummary,
} from "@/lib/departments/handover";
import { notify } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES, departmentActionUrl } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";
import {
  actionFailure,
  actionSuccess,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";

type Result<T = undefined> = ProductionActionResult & { data?: T };

function revalidateTeams() {
  revalidatePath("/mitglieder/meine-gewerke", "layout");
}

async function loadTask(taskId: string) {
  const task = await prisma.departmentTask.findUnique({
    where: { id: z.string().parse(taskId) },
    select: {
      id: true,
      departmentId: true,
      claimedById: true,
      claimedAt: true,
      status: true,
      objectId: true,
    },
  });
  if (!task) throw new Error("Karte wurde nicht gefunden.");
  return task;
}

// ---------------------------------------------------------------------------
// Stand einer Karte

const noteSchema = z.object({
  taskId: z.string(),
  field: z.enum(["nextStep", "caution"]),
  text: z.string().trim().max(NOTE_LIMIT),
});

/** „Nächster Schritt“ oder „Achtung“ setzen; leerer Text entfernt die Notiz. */
export async function setTaskNoteAction(input: z.input<typeof noteSchema>): Promise<Result> {
  try {
    const data = noteSchema.parse(input);
    const task = await loadTask(data.taskId);
    const access = await requireBoardAccess(task.departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    if (data.field === "caution") {
      const settings = await loadHandoverSettings(task.departmentId);
      if (!canEditNotes(access, settings.noteEditors)) {
        throw new Error("„Achtung“ setzt in diesem Gewerk nur die Leitung.");
      }
    }
    const text = data.text || null;
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.departmentTask.update({
        where: { id: task.id },
        data:
          data.field === "nextStep"
            ? { nextStep: text, nextStepAt: now, nextStepById: access.userId }
            : { caution: text, cautionAt: now, cautionById: access.userId },
      });
      await logTaskActivity(
        tx,
        task.id,
        access.userId,
        data.field === "nextStep" ? "next_step" : "caution",
        { text },
      );
    });
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Notiz konnte nicht gespeichert werden.");
  }
}

/** „Ich bin dran“ an- oder ausschalten. Fremde, noch gültige Übernahmen bleiben bestehen. */
export async function toggleTaskClaimAction(input: { taskId: string }): Promise<Result> {
  try {
    const task = await loadTask(input.taskId);
    const access = await requireBoardAccess(task.departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    const active = claimActive(task.claimedAt) ? task.claimedById : null;
    const mine = active === access.userId;
    await prisma.$transaction(async (tx) => {
      await tx.departmentTask.update({
        where: { id: task.id },
        data: mine
          ? { claimedById: null, claimedAt: null }
          : { claimedById: access.userId, claimedAt: new Date() },
      });
      await logTaskActivity(tx, task.id, access.userId, "claim", { on: !mine });
    });
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Das hat nicht geklappt.");
  }
}

export async function loadTaskActivityAction(input: {
  taskId: string;
}): Promise<Result<ActivityEntry[]>> {
  try {
    const task = await loadTask(input.taskId);
    await requireBoardAccess(task.departmentId);
    return { ...actionSuccess(), data: await loadTaskActivity(task.id) };
  } catch (error) {
    return actionFailure(error, "Verlauf konnte nicht geladen werden.");
  }
}

export async function loadTaskFeedAction(input: { taskId: string }): Promise<Result<FeedEntry[]>> {
  try {
    const task = await loadTask(input.taskId);
    await requireBoardAccess(task.departmentId);
    return { ...actionSuccess(), data: await loadTaskFeed(task.id) };
  } catch (error) {
    return actionFailure(error, "Verlauf konnte nicht geladen werden.");
  }
}

/** Status Offen / In Arbeit / Fertig: Karte in die erste Spalte mit diesem Status. */
export async function setTaskStatusAction(input: {
  taskId: string;
  status: "todo" | "doing" | "done";
}): Promise<Result> {
  try {
    const status = z.enum(["todo", "doing", "done"]).parse(input.status);
    const task = await loadTask(input.taskId);
    const access = await requireBoardAccess(task.departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    if (task.status === status) return actionSuccess();
    await ensureBoardColumns(task.departmentId);
    await prisma.$transaction(async (tx) => {
      const column = await tx.departmentBoardColumn.findFirst({
        where: { departmentId: task.departmentId, status },
        orderBy: { position: "asc" },
        select: { id: true },
      });
      const last = column
        ? await tx.departmentTask.aggregate({
            where: { columnId: column.id },
            _max: { position: true },
          })
        : null;
      await tx.departmentTask.update({
        where: { id: task.id },
        data: {
          status,
          ...(column ? { columnId: column.id, position: (last?._max.position ?? -1) + 1 } : {}),
        },
      });
      await syncObjectFromTask(tx, task.id);
      await logTaskActivity(tx, task.id, access.userId, "status", {
        to: WORK_STATUS_LABELS[status],
      });
    });
    if (task.objectId && status === "done") {
      await notifyRequestersIfReady(task.objectId, "ready", access.userId);
    }
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Status konnte nicht geändert werden.");
  }
}

// ---------------------------------------------------------------------------
// Schritte (Checkliste) einer Karte

const stepsSchema = z.object({
  taskId: z.string(),
  texts: z.array(z.string().trim().min(1).max(STEP_LIMIT)).min(1).max(50),
});

/** Einen oder mehrere Schritte anhängen. */
export async function addStepsAction(input: z.input<typeof stepsSchema>): Promise<Result> {
  try {
    const data = stepsSchema.parse(input);
    const task = await loadTask(data.taskId);
    const access = await requireBoardAccess(task.departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    await prisma.$transaction(async (tx) => {
      const last = await tx.taskChecklistItem.aggregate({
        where: { taskId: task.id },
        _max: { position: true },
      });
      const start = (last._max.position ?? -1) + 1;
      await tx.taskChecklistItem.createMany({
        data: data.texts.map((text, index) => ({ taskId: task.id, text, position: start + index })),
      });
      for (const text of data.texts) {
        await logTaskActivity(tx, task.id, access.userId, "checklist_added", { text });
      }
    });
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Schritt konnte nicht angelegt werden.");
  }
}

async function loadStep(itemId: string) {
  const item = await prisma.taskChecklistItem.findUnique({
    where: { id: z.string().parse(itemId) },
    select: {
      id: true,
      text: true,
      doneAt: true,
      doneById: true,
      taskId: true,
      task: { select: { departmentId: true } },
    },
  });
  if (!item) throw new Error("Schritt wurde nicht gefunden.");
  const access = await requireBoardAccess(item.task.departmentId);
  if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
  return { item, access };
}

export async function toggleStepAction(input: { itemId: string; done: boolean }): Promise<Result> {
  try {
    const done = z.boolean().parse(input.done);
    const { item, access } = await loadStep(input.itemId);
    if (Boolean(item.doneAt) === done) return actionSuccess();
    if (!done && item.doneById && item.doneById !== access.userId && !access.canManage) {
      const settings = await loadHandoverSettings(item.task.departmentId);
      if (settings.stepUndo === "own") {
        throw new Error("Wieder öffnen darf hier nur, wer abgehakt hat, oder die Leitung.");
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.taskChecklistItem.update({
        where: { id: item.id },
        data: done
          ? { doneAt: new Date(), doneById: access.userId }
          : { doneAt: null, doneById: null },
      });
      await logTaskActivity(
        tx,
        item.taskId,
        access.userId,
        done ? "checklist_done" : "checklist_undone",
        { text: item.text },
      );
    });
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Schritt konnte nicht geändert werden.");
  }
}

export async function renameStepAction(input: { itemId: string; text: string }): Promise<Result> {
  try {
    const text = z.string().trim().min(1).max(STEP_LIMIT).parse(input.text);
    const { item } = await loadStep(input.itemId);
    await prisma.taskChecklistItem.update({ where: { id: item.id }, data: { text } });
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Schritt konnte nicht geändert werden.");
  }
}

export async function deleteStepAction(input: { itemId: string }): Promise<Result> {
  try {
    const { item } = await loadStep(input.itemId);
    await prisma.taskChecklistItem.delete({ where: { id: item.id } });
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Schritt konnte nicht gelöscht werden.");
  }
}

// ---------------------------------------------------------------------------
// Hinweise für das ganze Gewerk

async function requireNoteEditor(departmentId: string) {
  const access = await requireBoardAccess(departmentId);
  const settings = await loadHandoverSettings(departmentId);
  if (!canEditNotes(access, settings.noteEditors)) {
    throw new Error("Hinweise pflegt in diesem Gewerk nur die Leitung.");
  }
  return access;
}

export async function addNoticeAction(input: {
  departmentId: string;
  body: string;
}): Promise<Result> {
  try {
    const departmentId = z.string().parse(input.departmentId);
    const body = z.string().trim().min(1, "Hinweis ist leer.").max(NOTE_LIMIT).parse(input.body);
    const access = await requireNoteEditor(departmentId);
    await prisma.departmentNotice.create({
      data: { departmentId, body, authorId: access.userId },
    });
    revalidateTeams();
    return actionSuccess("Hinweis angepinnt");
  } catch (error) {
    return actionFailure(error, "Hinweis konnte nicht gespeichert werden.");
  }
}

export async function resolveNoticeAction(input: { noticeId: string }): Promise<Result> {
  try {
    const notice = await prisma.departmentNotice.findUnique({
      where: { id: z.string().parse(input.noticeId) },
      select: { id: true, departmentId: true },
    });
    if (!notice) throw new Error("Hinweis wurde nicht gefunden.");
    const access = await requireNoteEditor(notice.departmentId);
    await prisma.departmentNotice.update({
      where: { id: notice.id },
      data: { resolvedAt: new Date(), resolvedById: access.userId },
    });
    revalidateTeams();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Hinweis konnte nicht erledigt werden.");
  }
}

// ---------------------------------------------------------------------------
// Feierabend / Übergabe

export async function prepareHandoverAction(input: {
  departmentId: string;
}): Promise<Result<HandoverSummary>> {
  try {
    const departmentId = z.string().parse(input.departmentId);
    const access = await requireBoardAccess(departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    return { ...actionSuccess(), data: await buildHandoverSummary(departmentId, access.userId) };
  } catch (error) {
    return actionFailure(error, "Übergabe konnte nicht vorbereitet werden.");
  }
}

export async function saveHandoverAction(input: {
  departmentId: string;
  note?: string | null;
}): Promise<Result> {
  try {
    const departmentId = z.string().parse(input.departmentId);
    const note = z.string().trim().max(1000).nullish().parse(input.note) || null;
    const access = await requireBoardAccess(departmentId);
    if (!access.canEdit) throw new Error("Du kannst hier nur lesen.");
    const summary = await buildHandoverSummary(departmentId, access.userId);
    if (!summary.length && !note) throw new Error("Schreib kurz, was du gemacht hast.");
    // Eigene Karten freigeben: wer geht, ist nicht mehr dran.
    await prisma.$transaction([
      prisma.departmentHandover.create({
        data: { departmentId, authorId: access.userId, summary, note },
      }),
      prisma.departmentTask.updateMany({
        where: { departmentId, claimedById: access.userId },
        data: { claimedById: null, claimedAt: null },
      }),
    ]);

    const [settings, department, author] = await Promise.all([
      loadHandoverSettings(departmentId),
      prisma.department.findUnique({
        where: { id: departmentId },
        select: { slug: true, showId: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: access.userId },
        select: { firstName: true, name: true },
      }),
    ]);
    const recipients = await handoverRecipients(departmentId, settings.handoverPush);
    if (recipients.some((id) => id !== access.userId)) {
      const who = author?.firstName || author?.name || "Jemand";
      await notify({
        type: NOTIFICATION_TYPES.DEPARTMENT_HANDOVER,
        recipients,
        actorId: access.userId,
        title: `${who} hat Feierabend gemacht – ${department?.name ?? "Gewerk"}`,
        body:
          note ??
          summary
            .slice(0, 3)
            .map((group) => `${group.title}: ${group.lines.slice(0, 2).join(", ")}`)
            .join("\n"),
        actionUrl: departmentActionUrl(department?.slug),
        showId: department?.showId,
      });
    }
    revalidateTeams();
    return actionSuccess("Übergabe gespeichert");
  } catch (error) {
    return actionFailure(error, "Übergabe konnte nicht gespeichert werden.");
  }
}

// ---------------------------------------------------------------------------
// Einstellungen

const settingsSchema = z.object({
  departmentId: z.string(),
  handoverPush: z.enum(["none", "leads", "all"]),
  noteEditors: z.enum(["all", "leads"]),
  stepUndo: z.enum(["all", "own"]),
});

export async function updateHandoverSettingsAction(
  input: z.input<typeof settingsSchema>,
): Promise<Result> {
  try {
    const data = settingsSchema.parse(input);
    const access = await requireBoardAccess(data.departmentId);
    if (!access.canManage) throw new Error("Einstellen dürfen Leitung und Vertretung.");
    await prisma.department.update({
      where: { id: data.departmentId },
      data: {
        handoverPush: data.handoverPush,
        noteEditors: data.noteEditors,
        stepUndo: data.stepUndo,
      },
    });
    revalidateTeams();
    return actionSuccess("Gespeichert");
  } catch (error) {
    return actionFailure(error, "Einstellungen konnten nicht gespeichert werden.");
  }
}
