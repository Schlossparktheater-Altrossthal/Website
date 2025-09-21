import { MysteryTimerManager } from "@/components/members/mystery/mystery-timer-manager";
import { Text } from "@/components/ui/typography";
import {
  DEFAULT_MYSTERY_COUNTDOWN_ISO,
  DEFAULT_MYSTERY_EXPIRATION_MESSAGE,
  MysterySettingsScope,
  resolveMysterySettings,
  readMysterySettings,
} from "@/lib/mystery-settings";
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

  const scope: MysterySettingsScope = "members";
  const settingsRecord = await readMysterySettings(scope);

  const resolved = resolveMysterySettings(settingsRecord);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mystery-Timer</h1>
        <p className="text-sm text-foreground/70">
          Verwalte Countdown und Hinweistext für interne Planungen unabhängig vom öffentlichen Countdown.
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

    </div>
  );
}
