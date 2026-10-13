import { notFound } from "next/navigation";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { loadLearnPage } from "@/lib/skript/learn/service";
import { SCRIPT_READ_PERMISSION } from "@/lib/skript/service";

import { LearnApp } from "./learn-app";

/** Lernmodus eines Stücks: neueste freigegebene Fassung (docs/Plan/lernmodus-plan.md, L7). */
export default async function LearnPage({ params }: { params: Promise<{ showId: string }> }) {
  const session = await requireAuth();
  const { showId } = await params;
  const userId = session.user?.id;
  if (!userId || !(await hasPermission(session.user, SCRIPT_READ_PERMISSION, { showId }))) {
    notFound();
  }
  const data = await loadLearnPage(showId, userId);
  if (!data) notFound();
  return <LearnApp data={data} />;
}
