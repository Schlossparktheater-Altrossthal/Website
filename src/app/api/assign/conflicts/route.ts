import { NextResponse } from "next/server";

import { getAssignmentConflicts } from "@/lib/onboarding-assignment";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const solutionId = url.searchParams.get("solutionId");
    if (!solutionId) {
      return NextResponse.json({ error: "solutionId erforderlich" }, { status: 400 });
    }

    const conflicts = getAssignmentConflicts(solutionId);
    return NextResponse.json({ conflicts });
  } catch (error) {
    console.error("[onboarding-assignment.conflicts]", error);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
