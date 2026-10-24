import Link from "next/link";

import { ArrowLeftIcon } from "@/components/ui/action-icons";
import { loadScriptReview } from "@/lib/skript/review";
import { readImportReport } from "@/lib/skript/json";
import { listPendingImports, listScriptVersions } from "@/lib/skript/service";

import { loadScriptRoleAdmin } from "@/lib/skript/role-admin";
import { loadTakeover } from "@/lib/skript/takeover";

import { ScriptReview } from "./skript-review";
import { ScriptRoles } from "./skript-roles";
import { ScriptTakeover } from "./skript-takeover";
import { ScriptVersions, type ScriptPendingItem, type ScriptVersionItem } from "./skript-versions";

export const SKRIPT_PATH = "/mitglieder/produktionen/stueck?ansicht=skript";

/** Reiter „Skript“: Fassungen, Import und Prüfschritt (docs/Plan/skript-plan.md). */
export async function SkriptView({
  showId,
  versionId,
  section = null,
  includeMembers = false,
  canManage,
}: {
  showId: string;
  versionId: string | null;
  section?: "roles" | "takeover" | null;
  includeMembers?: boolean;
  canManage: boolean;
}) {
  if (section === "roles") return <ScriptRoles data={await loadScriptRoleAdmin(showId)} />;
  if (section === "takeover") {
    const takeover = await loadTakeover(showId, includeMembers);
    return takeover ? (
      <ScriptTakeover data={takeover} />
    ) : (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Zum Übernehmen braucht es eine freigegebene Fassung.
      </p>
    );
  }
  if (versionId) {
    const review = await loadScriptReview(versionId);
    if (
      !review ||
      review.version.showId !== showId ||
      (!canManage && review.version.status !== "released")
    ) {
      return (
        <p className="py-12 text-center text-sm text-muted-foreground">Fassung nicht gefunden.</p>
      );
    }
    return (
      <div className="space-y-4">
        <Link
          href={SKRIPT_PATH}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon aria-hidden /> Alle Fassungen
        </Link>
        <ScriptReview data={review} canManage={canManage} />
      </div>
    );
  }

  const [versions, pendingRows] = await Promise.all([
    listScriptVersions(showId, { includeDrafts: canManage }),
    canManage ? listPendingImports(showId) : [],
  ]);
  const pending: ScriptPendingItem[] = pendingRows.map((item) => ({
    id: item.id,
    label: item.label,
    sourceName: item.sourceName,
    error: item.error,
    attempts: item.attempts,
    lastTriedAt: item.lastTriedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    createdByName: item.createdBy?.name ?? null,
  }));
  const items: ScriptVersionItem[] = versions.map((version) => {
    const report = readImportReport(version.importReport);
    return {
      id: version.id,
      label: version.label,
      status: version.status,
      sourceName: version.sourceName,
      createdAt: version.createdAt.toISOString(),
      createdByName: version.createdBy?.name ?? null,
      releasedAt: version.releasedAt?.toISOString() ?? null,
      releasedByName: version.releasedBy?.name ?? null,
      scenes: report.scenes,
      blocks: report.blocks,
      roles: report.speakers.length,
      hasSource: version.hasSource,
    };
  });
  return (
    <ScriptVersions showId={showId} versions={items} pending={pending} canManage={canManage} />
  );
}
