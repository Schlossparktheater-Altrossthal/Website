import { notFound } from "next/navigation";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { loadScriptReader } from "@/lib/skript/reader";
import { SCRIPT_MANAGE_PERMISSION, SCRIPT_READ_PERMISSION } from "@/lib/skript/service";

import { ScriptReader } from "./reader";

/** Leser einer Skript-Fassung (docs/Plan/skript-plan.md, Abschnitt „Leser“). */
export default async function ScriptReaderPage({
  params,
}: {
  params: Promise<{ fassung: string }>;
}) {
  const session = await requireAuth();
  const { fassung } = await params;
  const data = await loadScriptReader(fassung, session.user?.id ?? null);
  if (!data) notFound();

  const [canRead, canManage] = await Promise.all([
    hasPermission(session.user, SCRIPT_READ_PERMISSION, { showId: data.version.showId }),
    hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId: data.version.showId }),
  ]);
  // Entwürfe sehen nur Verwalter (E7).
  if (!canManage && (!canRead || data.version.status !== "released")) notFound();

  return <ScriptReader data={data} canManage={canManage} />;
}
