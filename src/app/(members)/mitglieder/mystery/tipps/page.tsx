import { MysteryTipManager } from "@/components/members/mystery/mystery-tip-manager";
import { Heading, Text } from "@/components/ui/typography";
import { getMysteryClueSummaries, getMysteryScoreboard, getMysterySubmissionsForClue } from "@/lib/mystery-tips";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export default async function MysteryTipsAdminPage({
  searchParams,
}: {
  searchParams?: { clue?: string };
}) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.mystery.tips");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Mystery-Tipps</div>;
  }

  if (!process.env.DATABASE_URL) {
    return (
      <div className="space-y-6">
        <div>
          <Heading level="h1">Mystery-Tipps</Heading>
          <Text variant="small" tone="muted">
            Die Datenbank ist nicht konfiguriert. Bitte hinterlege eine gültige <code>DATABASE_URL</code>, um die Tipps auszuwerten.
          </Text>
        </div>
      </div>
    );
  }

  const [clueSummaries, scoreboard] = await Promise.all([
    getMysteryClueSummaries(),
    getMysteryScoreboard(),
  ]);

  const clues = clueSummaries.map((clue) => ({
    id: clue.id,
    index: clue.index,
    points: clue.points,
    label: `Hinweis ${clue.index}`,
    releaseAt: clue.releaseAt ? clue.releaseAt.toISOString() : null,
    published: clue.published,
  }));

  const availableClueIds = new Set(clues.map((clue) => clue.id));
  let selectedClueId = searchParams?.clue && availableClueIds.has(searchParams.clue) ? searchParams.clue : null;
  if (!selectedClueId && clues.length > 0) {
    selectedClueId = clues[0].id;
  }

  const submissions = selectedClueId ? await getMysterySubmissionsForClue(selectedClueId) : [];

  const submissionEntries = submissions.map((submission) => ({
    id: submission.id,
    playerName: submission.playerName,
    tipText: submission.tipText,
    normalizedText: submission.normalizedText,
    isCorrect: submission.isCorrect,
    score: submission.score,
    tipCount: submission.tip?.count ?? 0,
    cluePoints: submission.clue?.points ?? null,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
  }));

  const scoreboardEntries = scoreboard.map((entry) => ({
    playerName: entry.playerName,
    totalScore: entry.totalScore,
    correctCount: entry.correctCount,
    totalSubmissions: entry.totalSubmissions,
    lastUpdated: entry.lastUpdated ? entry.lastUpdated.toISOString() : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Heading level="h1">Mystery-Tipps</Heading>
        <Text variant="small" tone="muted">
          Analysiere Community-Tipps pro Rätsel und vergebe Punkte für richtige Ideen.
        </Text>
      </div>

      <MysteryTipManager
        clues={clues}
        selectedClueId={selectedClueId ?? null}
        submissions={submissionEntries}
        scoreboard={scoreboardEntries}
      />
    </div>
  );
}
