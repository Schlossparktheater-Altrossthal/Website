import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const resetSchema = z.object({
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein."),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}
