"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { Countdown } from "@/components/countdown";
import { useFrontendEditing } from "@/components/frontend-editing/frontend-editing-provider";
import {
  type PremiereCountdownSettingsFormSavedSettings,
  PremiereCountdownSettingsForm,
} from "@/components/mystery/premiere-countdown-settings-form";

const COUNTDOWN_LABEL_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function formatLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return COUNTDOWN_LABEL_FORMATTER.format(date);
}

type MysteryLaunchCountdownCardProps = {
  initialCountdownTarget: string | null;
  initialExpirationMessage: string | null;
  effectiveCountdownTarget: string;
  effectiveExpirationMessage: string;
  defaultCountdownTarget: string;
  defaultExpirationMessage: string;
  updatedAt: string | null;
  hasCustomCountdown: boolean;
  hasCustomMessage: boolean;
  isFirstRiddleReleased: boolean;
  initialNow: number;
};

type TimerState = {
  countdownTarget: string | null;
  expirationMessage: string | null;
  effectiveCountdownTarget: string;
  effectiveExpirationMessage: string;
  hasCustomCountdown: boolean;
  hasCustomMessage: boolean;
  updatedAt: string | null;
};

const EDITOR_SECTION_ID = "mystery-timer-editor";

export function MysteryLaunchCountdownCard({
  initialCountdownTarget,
  initialExpirationMessage,
  effectiveCountdownTarget,
  effectiveExpirationMessage,
  defaultCountdownTarget,
  defaultExpirationMessage,
  updatedAt,
  hasCustomCountdown,
  hasCustomMessage,
  isFirstRiddleReleased,
  initialNow,
}: MysteryLaunchCountdownCardProps) {
  const router = useRouter();
  const { hasFeature, toggleFeature, activeFeature } = useFrontendEditing();
  const [state, setState] = useState<TimerState>(() => ({
    countdownTarget: initialCountdownTarget,
    expirationMessage: initialExpirationMessage,
    effectiveCountdownTarget,
    effectiveExpirationMessage,
    hasCustomCountdown,
    hasCustomMessage,
    updatedAt,
  }));
  const [now, setNow] = useState(() => initialNow);

  useEffect(() => {
    setState({
      countdownTarget: initialCountdownTarget,
      expirationMessage: initialExpirationMessage,
      effectiveCountdownTarget,
      effectiveExpirationMessage,
      hasCustomCountdown,
      hasCustomMessage,
      updatedAt,
    });
  }, [
    initialCountdownTarget,
    initialExpirationMessage,
    effectiveCountdownTarget,
    effectiveExpirationMessage,
    hasCustomCountdown,
    hasCustomMessage,
    updatedAt,
  ]);

  const canEdit = hasFeature("FEATURE.MYSTERY.COUNTDOWN");
  const editorOpen = canEdit && activeFeature === "FEATURE.MYSTERY.COUNTDOWN";

  useEffect(() => {
    setNow(Date.now());

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const countdownLabel = useMemo(
    () => formatLabel(state.effectiveCountdownTarget),
    [state.effectiveCountdownTarget],
  );

  const countdownReached = useMemo(() => {
    const target = new Date(state.effectiveCountdownTarget);
    if (Number.isNaN(target.getTime())) return false;
    return target.getTime() <= now;
  }, [state.effectiveCountdownTarget, now]);

  const showCountdown = !isFirstRiddleReleased && !countdownReached;

  function handleSaved(next: PremiereCountdownSettingsFormSavedSettings) {
    setState({
      countdownTarget: next.countdownTarget,
      expirationMessage: next.expirationMessage,
      effectiveCountdownTarget: next.effectiveCountdownTarget,
      effectiveExpirationMessage: next.effectiveExpirationMessage,
      hasCustomCountdown: next.hasCustomCountdown,
      hasCustomMessage: next.hasCustomMessage,
      updatedAt: next.updatedAt,
    });
    router.refresh();
  }

  return (
    <Card className="relative">
      <CardHeader className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <CardTitle>Nächstes Rätsel in</CardTitle>
        {canEdit ? (
          <Button
            size="sm"
            variant={editorOpen ? "secondary" : "outline"}
            className="sm:self-start"
            onClick={() => toggleFeature("FEATURE.MYSTERY.COUNTDOWN")}
            aria-pressed={editorOpen}
            aria-controls={EDITOR_SECTION_ID}
          >
            {editorOpen ? "Editor schließen" : "Mystery-Timer bearbeiten"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {showCountdown ? (
          <>
            <Countdown
              targetDate={state.effectiveCountdownTarget}
              initialNow={initialNow}
              variant="highlight"
            />
            {countdownLabel ? (
              <Text variant="small" tone="muted">
                Start am {countdownLabel}
              </Text>
            ) : null}
          </>
        ) : (
          <div className="space-y-2">
            <Text variant="lead" tone="success">
              {state.effectiveExpirationMessage}
            </Text>
            {countdownLabel ? (
              <Text variant="small" tone="muted">
                Veröffentlicht am {countdownLabel}
              </Text>
            ) : null}
          </div>
        )}
      </CardContent>
      {editorOpen ? (
        <CardContent
          id={EDITOR_SECTION_ID}
          className="space-y-4 border-t border-border/60 bg-muted/5"
        >
          <Text variant="small" tone="muted">
            Änderungen werden direkt auf der öffentlichen Mystery-Seite sichtbar.
          </Text>
          <PremiereCountdownSettingsForm
            scope="public"
            initialCountdownTarget={state.countdownTarget}
            initialExpirationMessage={state.expirationMessage}
            effectiveCountdownTarget={state.effectiveCountdownTarget}
            effectiveExpirationMessage={state.effectiveExpirationMessage}
            defaultCountdownTarget={defaultCountdownTarget}
            defaultExpirationMessage={defaultExpirationMessage}
            updatedAt={state.updatedAt}
            hasCustomCountdown={state.hasCustomCountdown}
            hasCustomMessage={state.hasCustomMessage}
            onSaved={handleSaved}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
