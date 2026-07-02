"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/typography";

type CountdownVariant = "default" | "highlight";

type CountdownProps = {
  targetDate: string;
  initialNow?: number;
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

function getTimeRemaining(
  targetTimestamp: number,
  now: number,
): CountdownState {
  const totalMilliseconds = Math.max(0, targetTimestamp - now);
  const totalSeconds = Math.floor(totalMilliseconds / MILLISECONDS_PER_SECOND);

  const days = Math.floor(
    totalSeconds / (HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE),
  );
  const hours = Math.floor(
    (totalSeconds % (HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE)) /
      (MINUTES_PER_HOUR * SECONDS_PER_MINUTE),
  );
  const minutes = Math.floor(
    (totalSeconds % (MINUTES_PER_HOUR * SECONDS_PER_MINUTE)) /
      SECONDS_PER_MINUTE,
  );
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

export function Countdown({
  targetDate,
  initialNow,
  className,
  variant = "default",
}: CountdownProps) {
  const targetTimestamp = useMemo(
    () => new Date(targetDate).getTime(),
    [targetDate],
  );
  const [state, setState] = useState<CountdownState>(() => {
    const initialTimestamp =
      typeof initialNow === "number" && Number.isFinite(initialNow)
        ? initialNow
        : Date.now();

    if (Number.isNaN(targetTimestamp)) {
      return EMPTY_COUNTDOWN_STATE;
    }

    return getTimeRemaining(targetTimestamp, initialTimestamp);
  });

  useEffect(() => {
    if (Number.isNaN(targetTimestamp)) {
      return;
    }

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

  const containerClassName = cn(
    "mx-auto grid w-full grid-cols-2 gap-[clamp(0.4rem,1.5vw,1rem)] text-center transition-[opacity,transform] duration-700 ease-out will-change-[opacity,transform] md:grid-cols-4",
    "translate-y-0 opacity-100",
    className,
  );
  const cellClassName =
    variant === "highlight"
      ? "rounded-lg border border-primary/50 bg-primary/10 px-[clamp(0.5rem,2vw,1.5rem)] py-[clamp(0.5rem,2vw,1.5rem)] text-center text-primary shadow-sm"
      : "rounded-lg border border-border bg-card px-[clamp(0.5rem,2vw,1.5rem)] py-[clamp(0.5rem,2vw,1.5rem)] text-center";
  const numberClassName = cn(
    "text-[clamp(1.5rem,6vw,3.5rem)] font-semibold tabular-nums text-primary transition-transform duration-300",
    variant === "highlight" ? "text-primary" : undefined,
  );
  const labelTone = variant === "highlight" ? "primary" : "muted";

  return (
    <div className={containerClassName} aria-live="polite">
      {timeParts.map((part) => (
        <div
          key={part.label}
          className={cn(
            cellClassName,
            "flex flex-col items-center justify-center",
          )}
        >
          <div className={cn(numberClassName, "text-center")}>
            {formatNumber(part.value)}
          </div>
          <Text
            variant="small"
            tone={labelTone}
            className={cn(
              "mt-1 w-full text-center text-[clamp(0.6rem,1.5vw,0.85rem)] uppercase tracking-[0.2em] text-primary-foreground",
              variant === "highlight" ? "text-primary/80" : undefined,
            )}
          >
            {part.label}
          </Text>
        </div>
      ))}
    </div>
  );
}
