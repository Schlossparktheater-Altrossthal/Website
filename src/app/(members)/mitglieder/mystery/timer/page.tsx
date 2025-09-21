import { MysteryTimerManager } from "@/components/members/mystery/mystery-timer-manager";
import { MysteryTipsTable } from "@/components/members/mystery/mystery-tips-table";
import { Text } from "@/components/ui/typography";
import {
  DEFAULT_MYSTERY_COUNTDOWN_ISO,
  DEFAULT_MYSTERY_EXPIRATION_MESSAGE,
  resolveMysterySettings,
  readMysterySettings,
} from "@/lib/mystery-settings";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

export default async function MysteryTimerPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.mystery.timer");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Mystery-Verwaltung</div>;
  }

  if (!process.env.DATABASE_URL) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Mystery-Timer</h1>
          <p className="text-sm text-foreground/70">
            Verwalte Countdown und Hinweistext für das öffentliche Geheimnis.
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 p-4">
          <Text variant="small" tone="muted">
            Die Datenbank ist nicht konfiguriert. Bitte hinterlege eine gültige <code>DATABASE_URL</code>, um den Timer zu
            verwalten.
          </Text>
        </div>
      </div>
    );
  }

  const [settingsRecord, tipRecords] = await Promise.all([
    readMysterySettings(),
    prisma.mysteryTip.findMany({
      orderBy: [
        { count: "desc" },
        { updatedAt: "desc" },
        { createdAt: "asc" },
      ],
    }),
  ]);

  const resolved = resolveMysterySettings(settingsRecord);

  const tips = tipRecords.map((tip) => ({
    id: tip.id,
    text: tip.text,
    normalizedText: tip.normalizedText,
    count: tip.count,
    createdAt: tip.createdAt.toISOString(),
    updatedAt: tip.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mystery-Timer</h1>
        <p className="text-sm text-foreground/70">
          Verwalte Countdown, Hinweistext und erhalte einen Überblick über die häufigsten Community-Tipps.
        </p>
      </div>

      <MysteryTimerManager
        initialCountdownTarget={resolved.countdownTarget ? resolved.countdownTarget.toISOString() : null}
        initialExpirationMessage={resolved.expirationMessage}
        effectiveCountdownTarget={resolved.effectiveCountdownTarget.toISOString()}
        effectiveExpirationMessage={resolved.effectiveExpirationMessage}
        defaultCountdownTarget={DEFAULT_MYSTERY_COUNTDOWN_ISO}
        defaultExpirationMessage={DEFAULT_MYSTERY_EXPIRATION_MESSAGE}
        updatedAt={resolved.updatedAt ? resolved.updatedAt.toISOString() : null}
        hasCustomCountdown={resolved.hasCustomCountdown}
        hasCustomMessage={resolved.hasCustomMessage}
      />

      <MysteryTipsTable tips={tips} />
    </div>
  );
}
