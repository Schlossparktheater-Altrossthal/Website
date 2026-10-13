import Link from "next/link";

import { ArrowLeftIcon } from "@/components/ui/action-icons";
import { loadScriptReview } from "@/lib/skript/review";
import { readImportReport } from "@/lib/skript/json";
import { listScriptVersions } from "@/lib/skript/service";

import { ScriptReview } from "./skript-review";
import { ScriptVersions, type ScriptVersionItem } from "./skript-versions";

export const SKRIPT_PATH = "/mitglieder/produktionen/stueck?ansicht=skript";

/** Reiter „Skript“: Fassungen, Import und Prüfschritt (docs/Plan/skript-plan.md). */
export async function SkriptView({
  showId,
  versionId,
  canManage,
}: {
  showId: string;
  versionId: string | null;
  canManage: boolean;
}) {
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

  const versions = await listScriptVersions(showId, { includeDrafts: canManage });
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
    };
  });
  return <ScriptVersions showId={showId} versions={items} canManage={canManage} />;
}
