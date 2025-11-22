"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { updateAttendanceWithLog } from "@/lib/rehearsals/attendance";

export type AttendanceActionState = {
  ok: boolean;
  error: string | null;
};

const RESPOND_SCHEMA = z.object({
  rehearsalId: z.string().min(1, "Termin konnte nicht gefunden werden."),
  status: z.enum(["yes", "no", "emergency"], { error: "Ungültige Auswahl." }),
});

export const INITIAL_ATTENDANCE_STATE: AttendanceActionState = {
  ok: false,
  error: null,
};

export async function respondToRehearsal(
  _prevState: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, "mitglieder.meine-proben");
    const userId = session.user?.id ?? null;

    if (!allowed || !userId) {
      return { ok: false, error: "Du darfst auf diesen Termin nicht antworten." };
    }

    const parsed = RESPOND_SCHEMA.safeParse({
      rehearsalId: formData.get("rehearsalId"),
      status: formData.get("status"),
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Ungültige Eingabe.";
      return { ok: false, error: message };
    }

    const { rehearsalId, status } = parsed.data;

    const rehearsal = await prisma.rehearsal.findUnique({
      where: { id: rehearsalId },
      select: {
        id: true,
        status: true,
        invitees: {
          where: { userId },
          select: { userId: true },
        },
      },
    });

    if (!rehearsal || rehearsal.status === "DRAFT") {
      return { ok: false, error: "Dieser Termin ist nicht mehr verfügbar." };
    }

    if (!rehearsal.invitees.length) {
      return { ok: false, error: "Du bist für diesen Termin nicht eingeladen." };
    }

    await updateAttendanceWithLog({
      prisma,
      rehearsalId,
      targetUserId: userId,
      actorUserId: userId,
      nextStatus: status,
    });

    revalidatePath("/mitglieder/meine-proben");
    revalidatePath(`/mitglieder/proben/${rehearsalId}`);

    return { ok: true, error: null };
  } catch (error) {
    console.error("Error responding to rehearsal from Meine Termine", error);
    return { ok: false, error: "Die Rückmeldung konnte nicht gespeichert werden." };
  }
}
