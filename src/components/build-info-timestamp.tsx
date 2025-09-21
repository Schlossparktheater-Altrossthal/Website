"use client";

import { useEffect, useMemo, useState } from "react";

type BuildInfoTimestampProps = {
  formattedTimestamp: string;
  isoTimestamp: string;
};

const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30.4375 * DAY;
const YEAR = 365.25 * DAY;

function formatRelativeTime(
  targetDate: Date,
  formatter: Intl.RelativeTimeFormat,
): string {
  const now = Date.now();
  const diffInSeconds = (targetDate.getTime() - now) / 1000;
  const absoluteDiff = Math.abs(diffInSeconds);

  if (absoluteDiff < MINUTE) {
    return formatter.format(Math.round(diffInSeconds / SECOND), "second");
  }

  if (absoluteDiff < HOUR) {
    return formatter.format(Math.round(diffInSeconds / MINUTE), "minute");
  }

  if (absoluteDiff < DAY) {
    return formatter.format(Math.round(diffInSeconds / HOUR), "hour");
  }

  if (absoluteDiff < WEEK) {
    return formatter.format(Math.round(diffInSeconds / DAY), "day");
  }

  if (absoluteDiff < MONTH) {
    return formatter.format(Math.round(diffInSeconds / WEEK), "week");
  }

  if (absoluteDiff < YEAR) {
    return formatter.format(Math.round(diffInSeconds / MONTH), "month");
  }

  return formatter.format(Math.round(diffInSeconds / YEAR), "year");
}

export function BuildInfoTimestamp({
  formattedTimestamp,
  isoTimestamp,
}: BuildInfoTimestampProps) {
  const buildDate = useMemo(() => new Date(isoTimestamp), [isoTimestamp]);
  const relativeTimeFormatter = useMemo(
    () => new Intl.RelativeTimeFormat("de", { numeric: "auto" }),
    [],
  );
  const isValidTimestamp = !Number.isNaN(buildDate.getTime());
  const [relativeTime, setRelativeTime] = useState<string | null>(null);

  useEffect(() => {
    if (!isValidTimestamp) {
      return;
    }

    const updateRelativeTime = () => {
      setRelativeTime(formatRelativeTime(buildDate, relativeTimeFormatter));
    };

    updateRelativeTime();

    const interval = window.setInterval(updateRelativeTime, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [buildDate, isValidTimestamp, relativeTimeFormatter]);

  if (!isValidTimestamp) {
    return <span>Stand {formattedTimestamp}</span>;
  }

  return (
    <span className="inline-flex items-baseline gap-1">
      <time dateTime={isoTimestamp}>Stand {formattedTimestamp}</time>
      {relativeTime !== null ? (
        <>
          <span aria-hidden>({relativeTime})</span>
          <span className="sr-only">, aktualisiert {relativeTime}</span>
        </>
      ) : null}
    </span>
  );
}
