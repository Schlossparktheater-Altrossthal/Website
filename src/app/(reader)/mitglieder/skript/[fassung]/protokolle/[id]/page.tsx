import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/rbac";
import { loadScriptReader } from "@/lib/skript/reader";
import { loadSessionDetail } from "@/lib/skript/session-protocol";
import { versionAccess } from "@/lib/skript/sessions";

import { SessionView } from "./session-view";

/** Protokoll einer Aufnahme (docs/Plan/skript-mitlesen-plan.md, E10–E12). */
export default async function ScriptProtocolPage({
  params,
}: {
  params: Promise<{ fassung: string; id: string }>;
}) {
  const session = await requireAuth();
  const userId = session.user?.id;
  const { fassung, id } = await params;
  const access = userId ? await versionAccess(session.user, fassung) : null;
  if (!userId || !access) notFound();
  const data = await loadScriptReader(access.version.id, userId);
  if (!data) notFound();
  const detail = await loadSessionDetail(id, data, userId, access.canManage);
  if (!detail) notFound();

  // Nur die Absätze, auf die das Protokoll zeigt (Stillstände, Wiederholungen).
  const indices = new Set<number>();
  for (const stop of detail.protocol?.stops ?? []) indices.add(stop.blockIndex);
  for (const repeat of detail.protocol?.repeats ?? []) indices.add(repeat.blockIndex);
  const snippets: Record<number, string> = {};
  for (const index of indices) {
    const block = data.blocks[index];
    if (!block) continue;
    const text = block.parts
      .filter((part) => part.kind !== "cue")
      .map((part) => part.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const short = text.length > 70 ? `${text.slice(0, 68)}…` : text;
    snippets[index] = block.speaker ? `${block.speaker}: ${short}` : short;
  }

  return (
    <SessionView
      versionId={access.version.id}
      versionLabel={access.version.label}
      detail={detail}
      canManage={access.canManage}
      roleNames={Object.fromEntries(data.roles.map((role) => [role.id, role.name]))}
      snippets={snippets}
    />
  );
}
