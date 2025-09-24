"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/typography";

type CountdownVariant = "default" | "highlight";

type CountdownProps = {
  targetDate: string;
  initialNow: number;
  className?: string;
  variant?: CountdownVariant;
};

type CountdownState = {
  totalMilliseconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const EMPTY_COUNTDOWN_STATE: CountdownState = {
  totalMilliseconds: 0,
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
};

function getTimeRemaining(targetTimestamp: number, now: number): CountdownState {
  const totalMilliseconds = Math.max(0, targetTimestamp - now);
  const totalSeconds = Math.floor(totalMilliseconds / MILLISECONDS_PER_SECOND);

  const days = Math.floor(totalSeconds / (HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE));
  const hours = Math.floor(
    (totalSeconds % (HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE)) /
      (MINUTES_PER_HOUR * SECONDS_PER_MINUTE),
  );
  const minutes = Math.floor((totalSeconds % (MINUTES_PER_HOUR * SECONDS_PER_MINUTE)) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  return {
    totalMilliseconds,
    days,
    hours,
    minutes,
    seconds,
  };
}

function formatNumber(value: number) {
  return value.toString().padStart(2, "0");
}

export function Countdown({ targetDate, initialNow, className, variant = "default" }: CountdownProps) {
  const targetTimestamp = useMemo(() => new Date(targetDate).getTime(), [targetDate]);
  const [state, setState] = useState<CountdownState>(() => {
    if (Number.isNaN(targetTimestamp) || !Number.isFinite(initialNow)) {
      return EMPTY_COUNTDOWN_STATE;
    }

    return getTimeRemaining(targetTimestamp, initialNow);
  });

  useEffect(() => {
    if (Number.isNaN(targetTimestamp)) {
      return;
    }

    const update = () => {
      setState(getTimeRemaining(targetTimestamp, Date.now()));
    };

    update();

    const interval = window.setInterval(() => {
      setState((previous) => {
        const next = getTimeRemaining(targetTimestamp, Date.now());
        if (next.totalMilliseconds === 0 && previous.totalMilliseconds === 0) {
          window.clearInterval(interval);
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [targetTimestamp]);

  if (Number.isNaN(targetTimestamp)) {
    return <Text tone="destructive">Ungültiges Datum</Text>;
  }

  const timeParts = [
    { label: "Tage", value: state.days },
    { label: "Stunden", value: state.hours },
    { label: "Minuten", value: state.minutes },
    { label: "Sekunden", value: state.seconds },
  ];

  const containerClassName = cn("grid w-full grid-cols-2 gap-3 sm:grid-cols-4", className);
  const cellClassName =
    variant === "highlight"
      ? "rounded-lg border border-primary/50 bg-primary/10 px-4 py-3 text-center shadow-sm text-primary"
      : "rounded-lg border border-border bg-card px-4 py-3 text-center shadow-sm";
  const numberClassName = cn(
    "text-3xl font-semibold tabular-nums sm:text-4xl",
    variant === "highlight" ? "text-primary" : undefined,
  );
  const labelTone = variant === "highlight" ? "primary" : "muted";

  return (
    <div className={containerClassName} aria-live="polite">
      {timeParts.map((part) => (
        <div key={part.label} className={cellClassName}>
          <div className={numberClassName}>{formatNumber(part.value)}</div>
          <Text
            variant="small"
            tone={labelTone}
            className={cn("mt-1 uppercase tracking-[0.2em]", variant === "highlight" ? "text-primary/80" : undefined)}
          >
            {part.label}
          </Text>
        </div>
      ))}
    </div>
  );
}
