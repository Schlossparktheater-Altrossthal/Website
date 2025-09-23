"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { Countdown } from "./countdown";
import { useFrontendEditing } from "@/components/frontend-editing/frontend-editing-provider";
import {
  type MysteryTimerFormSavedSettings,
  MysteryTimerForm,
} from "@/components/mystery/mystery-timer-form";

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

type MysteryCountdownCardProps = {
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

export function MysteryCountdownCard({
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
}: MysteryCountdownCardProps) {
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

  const canEdit = hasFeature("mystery.timer");
  const editorOpen = canEdit && activeFeature === "mystery.timer";

  const countdownLabel = useMemo(
    () => formatLabel(state.effectiveCountdownTarget),
    [state.effectiveCountdownTarget],
  );

  const countdownReached = useMemo(() => {
    const target = new Date(state.effectiveCountdownTarget);
    if (Number.isNaN(target.getTime())) return false;
    return target.getTime() <= Date.now();
  }, [state.effectiveCountdownTarget]);

  const showCountdown = !isFirstRiddleReleased && !countdownReached;

  function handleSaved(next: MysteryTimerFormSavedSettings) {
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
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <CardTitle>Nächstes Rätsel in</CardTitle>
        {canEdit ? (
          <Button
            size="sm"
            variant={editorOpen ? "secondary" : "outline"}
            onClick={() => toggleFeature("mystery.timer")}
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
            <Countdown targetDate={state.effectiveCountdownTarget} />
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
          <MysteryTimerForm
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
