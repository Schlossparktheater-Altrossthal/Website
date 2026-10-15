import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { getProtocolAccess, readProtocol } from "@/lib/calendar/protocol-server";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { latestReleasedVersion } from "@/lib/skript/learn/service";
import { matchScenes } from "@/lib/skript/learn/plan";
import { SCRIPT_READ_PERMISSION } from "@/lib/skript/service";

import { ProbeMode } from "./probe-mode";

/** Bis eine Stunde vor Beginn gilt der Probenmodus als Vorbereitung. */
const PREPARE_UNTIL_MS = 60 * 60 * 1000;

/**
 * Probenmodus: vorab Hinweise sammeln, während der Probe Anwesenheit, Zeiten und Szenen erfassen –
 * live und offline. Gewerk-Leitungen sehen nur die Notizen.
 */
export default async function ProbePage({ params }: { params: Promise<{ eventId: string }> }) {
  const session = await requireAuth();
  const { eventId } = await params;
  if (!session.user?.id || !eventId) notFound();

  const data = await readProtocol(eventId);
  if (!data) notFound();
  const { event, state, candidates, scenes, assignees } = data;
  if (event.status === "DRAFT" || event.status === "CANCELLED") {
    redirect(`/mitglieder/termine/${eventId}`);
  }
  const access = event.departmentId
    ? null
    : await getProtocolAccess(session.user, event.showId, event.id);
  if (!access) redirect(`/mitglieder/termine/${eventId}`);
  const script = event.showId ? await scriptEntry(session.user, event.showId, scenes) : null;
  const preparing =
    !event.actualStart && event.start.getTime() - new Date().getTime() > PREPARE_UNTIL_MS;

  const breadcrumbs = [
    { id: event.id, label: event.title || "Termin", href: `/mitglieder/termine/${event.id}` },
    {
      id: `${event.id}-probe`,
      label: access === "full" ? "Probenmodus" : access === "notes" ? "Hinweise" : "Notizen",
      isCurrent: true,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          access === "full"
            ? "Probenmodus"
            : access === "notes"
              ? "Hinweise zur Probe"
              : "Notizen & Fotos zur Probe"
        }
        breadcrumbs={breadcrumbs}
      />
      <ProbeMode
        eventId={event.id}
        title={event.title || "Probe"}
        plannedStart={event.start.toISOString()}
        plannedEnd={event.end?.toISOString() ?? null}
        serverState={state}
        candidates={candidates}
        scenes={scenes}
        assignees={assignees}
        sentAt={event.protocolSentAt?.toISOString() ?? null}
        access={access}
        userId={session.user.id}
        initialPreparing={preparing}
        script={script}
      />
    </div>
  );
}

/**
 * Einstieg ins Skript (docs/Plan/skript-notizen-plan.md, Schritt 7): neueste freigegebene Fassung
 * und welche Skript-Szene zu welcher Szene des Stücks gehört (über Titel/Nummer, keine feste
 * Kopplung).
 */
async function scriptEntry(
  user: Parameters<typeof hasPermission>[0],
  showId: string,
  scenes: { id: string; label: string }[],
) {
  if (!(await hasPermission(user, SCRIPT_READ_PERMISSION, { showId }))) return null;
  const version = await latestReleasedVersion(showId);
  if (!version) return null;
  const [scriptScenes, stageScenes] = await Promise.all([
    prisma.scriptScene.findMany({
      where: { versionId: version.id },
      orderBy: { sequence: "asc" },
      select: { id: true, title: true },
    }),
    prisma.scene.findMany({
      where: { id: { in: scenes.map((scene) => scene.id) } },
      select: { id: true, title: true, identifier: true },
    }),
  ]);
  return {
    versionId: version.id,
    sceneMap: Object.fromEntries(matchScenes(stageScenes, scriptScenes)),
  };
}
