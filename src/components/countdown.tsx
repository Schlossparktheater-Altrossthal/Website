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

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  if (Number.isNaN(targetTimestamp)) {
    return <Text tone="destructive">Ungültiges Datum</Text>;
  }

  const timeParts = [
    { label: "Tage", value: state.days },
    { label: "Stunden", value: state.hours },
    { label: "Minuten", value: state.minutes },
    { label: "Sekunden", value: state.seconds },
  ];

  const containerClassName = cn("mx-auto grid w-full grid-cols-2 gap-[clamp(0.4rem,1.5vw,1rem)] text-center md:grid-cols-2 lg:grid-cols-4", className);
  const cellClassName =
    variant === "highlight"
      ? "rounded-lg border border-primary/50 bg-primary/10 px-[clamp(0.5rem,2vw,1.5rem)] py-[clamp(0.5rem,2vw,1.5rem)] text-center text-primary shadow-sm"
      : "rounded-lg border border-border bg-card px-[clamp(0.5rem,2vw,1.5rem)] py-[clamp(0.5rem,2vw,1.5rem)] text-center shadow-[0_0_12px_rgba(var(--color-orange-rgb),0.25)]";
  const numberClassName = cn(
    "text-[clamp(1.5rem,6vw,3.5rem)] font-semibold tabular-nums text-primary transition-transform duration-300",
    variant === "highlight" ? "text-primary" : undefined,
  );
  const labelTone = variant === "highlight" ? "primary" : "muted";

  return (
    <div className={cn(containerClassName, loaded ? "animate-in fade-in slide-in-from-bottom-2 duration-700" : "opacity-0")} aria-live="polite">
      {timeParts.map((part) => (
        <div key={part.label} className={cellClassName}>
          <div className={numberClassName}>{formatNumber(part.value)}</div>
          <Text
            variant="small"
            tone={labelTone}
            className={cn(
              "mt-1 text-[clamp(0.6rem,1.5vw,0.85rem)] uppercase tracking-[0.2em] text-primary-foreground",
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
