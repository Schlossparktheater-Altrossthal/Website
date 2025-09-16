"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const rehearsalSchema = z.object({
  title: z.string().min(3, "Titel ist zu kurz").max(120, "Titel ist zu lang"),
  date: z.string().min(1),
  time: z.string().min(1),
});

export async function createRehearsalAction(input: { title: string; date: string; time: string }) {
  const session = await requireAuth(["board", "admin", "tech"]);
  const user = session.user as { id?: string } | undefined;

  if (!user?.id) {
    return { error: "Keine Berechtigung." } as const;
  }

  const parsed = rehearsalSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Bitte Titel, Datum und Uhrzeit prüfen." } as const;
  }

  const { title, date, time } = parsed.data;
  const start = new Date(`${date}T${time}`);
  if (Number.isNaN(start.getTime())) {
    return { error: "Ungültige Kombination aus Datum und Uhrzeit." } as const;
  }
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    if (!users.length) {
      return { error: "Es wurden keine Benutzer gefunden." } as const;
    }

    const formatter = new Intl.DateTimeFormat("de-DE", {
      dateStyle: "full",
      timeStyle: "short",
    });

    await prisma.$transaction(async (tx) => {
      const rehearsal = await tx.rehearsal.create({
        data: {
          title,
          start,
          end,
          location: "Noch offen",
          requiredRoles: [],
          createdBy: user.id,
        },
      });

      await tx.notification.create({
        data: {
          title: `Neue Probe: ${title}`,
          body: `Am ${formatter.format(start)}`,
          type: "rehearsal",
          rehearsalId: rehearsal.id,
          recipients: {
            create: users.map((u) => ({ userId: u.id })),
          },
        },
      });
    });

    revalidatePath("/mitglieder/probenplanung");
    return { success: true } as const;
  } catch (error) {
    console.error("Error creating rehearsal", error);
    return { error: "Die Probe konnte nicht gespeichert werden." } as const;
  }
}
