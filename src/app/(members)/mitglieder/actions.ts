"use server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function saveAttendanceAction(rehearsalId: string, status: "yes" | "no" | "maybe") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  await prisma.rehearsalAttendance.upsert({
    where: { rehearsalId_userId: { rehearsalId, userId: user.id } },
    update: { status },
    create: { rehearsalId, userId: user.id, status },
  });

  return { ok: true } as const;
}

