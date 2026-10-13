import Link from "next/link";
import { notFound } from "next/navigation";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  listComparableVersions,
  loadScriptComparison,
  previousVersion,
} from "@/lib/skript/compare";
import { SCRIPT_MANAGE_PERMISSION, SCRIPT_READ_PERMISSION } from "@/lib/skript/service";

import { ScriptCompare } from "./compare";

/** Fassungsvergleich (docs/Plan/skript-plan.md, Phase 7): Änderungen seit einer älteren Fassung. */
export default async function ScriptComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ fassung: string }>;
  searchParams: Promise<{ mit?: string; nur?: string }>;
}) {
  const session = await requireAuth();
  const { fassung } = await params;
  const { mit, nur } = await searchParams;
  const beforeId = mit ?? (await previousVersion(fassung))?.id;
  if (!beforeId) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
        <p>Es gibt noch keine ältere Fassung zum Vergleichen.</p>
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href={`/mitglieder/skript/${fassung}`}
        >
          Zurück zum Skript
        </Link>
      </div>
    );
  }
  const comparison = await loadScriptComparison(beforeId, fassung, session.user?.id ?? null);
  if (!comparison) notFound();

  const showId = comparison.after.showId;
  const [canRead, canManage] = await Promise.all([
    hasPermission(session.user, SCRIPT_READ_PERMISSION, { showId }),
    hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId }),
  ]);
  const visible = (status: "draft" | "released") => canManage || (canRead && status === "released");
  if (!visible(comparison.after.status) || !visible(comparison.before.status)) notFound();

  const versions = (await listComparableVersions(showId, canManage)).filter(
    (version) => version.id !== fassung,
  );
  return (
    <ScriptCompare
      comparison={comparison}
      versions={versions}
      initialFilter={nur === "meine" ? "mine" : nur === "hinweise" ? "cues" : "all"}
    />
  );
}
