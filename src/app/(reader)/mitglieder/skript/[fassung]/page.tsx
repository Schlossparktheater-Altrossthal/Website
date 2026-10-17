import { notFound } from "next/navigation";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { loadReaderAnnotations } from "@/lib/skript/annotations";
import { previousVersion } from "@/lib/skript/compare";
import { listScriptPresets } from "@/lib/skript/presets";
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

  const [previous, annotations, presets] = await Promise.all([
    previousVersion(data.version.id),
    session.user?.id
      ? loadReaderAnnotations(data.version.showId, data.version.id, session.user.id, data.blocks)
      : Promise.resolve([]),
    listScriptPresets(data.version.showId, session.user?.id ?? null, canManage),
  ]);
  return (
    <ScriptReader
      data={data}
      canManage={canManage}
      previous={previous}
      annotations={annotations}
      presets={presets}
    />
  );
}
