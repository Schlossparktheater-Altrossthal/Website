import { NextResponse } from "next/server";
import { z } from "zod";

import { solveAssignments } from "@/lib/onboarding-assignment";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const assignmentSchema = z.object({
  capacities: z
    .record(z.string(), z.number().min(0))
    .refine((value) => Object.values(value).some((entry) => entry > 0), {
      message: "Mindestens eine Kapazität muss größer als 0 sein.",
    }),
  filters: z
    .object({
      focuses: z.array(z.enum(["acting", "tech", "both"])).optional(),
      ageBuckets: z.array(z.string()).optional(),
      backgrounds: z.array(z.string()).optional(),
      documentStatuses: z.array(z.string()).optional(),
    })
    .optional(),
  fairness: z
    .object({
      gender: z.record(z.string(), z.number().min(0)).optional(),
      experience: z
        .object({ experienced: z.number().min(0), newcomer: z.number().min(0) })
        .optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const user = session.user;
    if (!user?.id) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const allowed = await hasPermission(user, "mitglieder.dashboard");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await request.json();
    const payload = assignmentSchema.parse(json);

    const solution = await solveAssignments(payload);
    return NextResponse.json({ solution });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("[onboarding-assignment.solve]", error);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
