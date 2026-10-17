import { notFound } from "next/navigation";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { loadScriptReader } from "@/lib/skript/reader";
import { SCRIPT_MANAGE_PERMISSION, SCRIPT_READ_PERMISSION } from "@/lib/skript/service";
import { computeScriptStats } from "@/lib/skript/stats";

import { ScriptOverview } from "./overview";

/** Übersichten einer Fassung im Leser (docs/Plan/skript-auswertungen-plan.md, Phase 5). */
export default async function ScriptOverviewPage({
  params,
}: {
  params: Promise<{ fassung: string }>;
}) {
  const session = await requireAuth();
  const { fassung } = await params;
  const data = await loadScriptReader(fassung, session.user?.id ?? null);
  if (!data) notFound();
  const scope = { showId: data.version.showId };
  const [canRead, canManage] = await Promise.all([
    hasPermission(session.user, SCRIPT_READ_PERMISSION, scope),
    hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, scope),
  ]);
  if (!canManage && (!canRead || data.version.status !== "released")) notFound();

  return (
    <ScriptOverview
      version={data.version}
      stats={computeScriptStats(data)}
      roleNames={data.roles.map((role) => [role.id, role.name])}
      ownRoleIds={data.ownRoleIds}
    />
  );
}
