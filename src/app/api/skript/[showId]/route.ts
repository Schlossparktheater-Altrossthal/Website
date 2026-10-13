import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/rbac";
import {
  SCRIPT_MANAGE_PERMISSION,
  SCRIPT_PDF_MAX_BYTES,
  SCRIPT_READ_PERMISSION,
  ScriptImportError,
  importScriptDraft,
  listScriptVersions,
} from "@/lib/skript/service";

type RouteParams = { params: Promise<{ showId: string }> };

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function loadUser() {
  const session = await getSession();
  const user = session?.user;
  if (!user?.id || user.isDeactivated) return null;
  return { ...user, id: user.id };
}

/** Fassungen des Skripts; Entwürfe nur mit Verwaltungsrecht. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { showId } = await params;
  const user = await loadUser();
  if (!user) return fail("Bitte anmelden.", 401);
  const [canRead, canManage] = await Promise.all([
    hasPermission(user, SCRIPT_READ_PERMISSION, { showId }),
    hasPermission(user, SCRIPT_MANAGE_PERMISSION, { showId }),
  ]);
  if (!canRead && !canManage) return fail("Keine Berechtigung.", 403);
  return NextResponse.json({
    versions: await listScriptVersions(showId, { includeDrafts: canManage }),
    canManage,
  });
}

/** PDF hochladen (Formularfelder: `file`, optional `label`, `versionDate` YYYY-MM-DD) → Entwurf. */
export async function POST(request: Request, { params }: RouteParams) {
  const { showId } = await params;
  const user = await loadUser();
  if (!user) return fail("Bitte anmelden.", 401);
  if (!(await hasPermission(user, SCRIPT_MANAGE_PERMISSION, { showId }))) {
    return fail("Skripte verwalten Regie und Board.", 403);
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Keine Datei erhalten.", 400);
  if (file.size > SCRIPT_PDF_MAX_BYTES) return fail("Das PDF ist zu groß (höchstens 25 MB).", 413);
  const label = form?.get("label");
  const dateRaw = form?.get("versionDate");
  const versionDate =
    typeof dateRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
      ? new Date(`${dateRaw}T12:00:00Z`)
      : null;

  try {
    const result = await importScriptDraft({
      showId,
      userId: user.id,
      fileName: file.name || "skript.pdf",
      data: new Uint8Array(await file.arrayBuffer()),
      label: typeof label === "string" ? label.slice(0, 200) : null,
      versionDate,
    });
    revalidatePath("/mitglieder/produktionen/stueck");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ScriptImportError) return fail(error.message, error.status);
    console.error("[skript] Import fehlgeschlagen", error);
    return fail("Das Skript konnte nicht gespeichert werden.", 500);
  }
}
