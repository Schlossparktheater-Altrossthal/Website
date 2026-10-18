import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/rbac";
import { listSessions } from "@/lib/skript/session-protocol";
import { versionAccess } from "@/lib/skript/sessions";

import { SessionList } from "./session-list";

/** Protokolle der Aufnahmen einer Fassung (docs/Plan/skript-mitlesen-plan.md, E10–E12). */
export default async function ScriptProtocolsPage({
  params,
}: {
  params: Promise<{ fassung: string }>;
}) {
  const session = await requireAuth();
  const userId = session.user?.id;
  const { fassung } = await params;
  const access = userId ? await versionAccess(session.user, fassung) : null;
  if (!userId || !access) notFound();
  const sessions = await listSessions(access.version.id, userId, access.canManage);
  return (
    <SessionList
      versionId={access.version.id}
      versionLabel={access.version.label}
      sessions={sessions}
      canManage={access.canManage}
    />
  );
}
