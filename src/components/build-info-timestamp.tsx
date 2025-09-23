"use client";

import { useEffect, useMemo, useState } from "react";

import { formatRelativeFromNow } from "@/lib/datetime";

type BuildInfoTimestampProps = {
  formattedTimestamp: string;
  isoTimestamp: string;
};

export function BuildInfoTimestamp({
  formattedTimestamp,
  isoTimestamp,
}: BuildInfoTimestampProps) {
  const buildDate = useMemo(() => new Date(isoTimestamp), [isoTimestamp]);
  const isValidTimestamp = !Number.isNaN(buildDate.getTime());
  const [relativeTime, setRelativeTime] = useState<string | null>(null);

  useEffect(() => {
    if (!isValidTimestamp) {
      return;
    }

    const updateRelativeTime = () => {
      setRelativeTime(formatRelativeFromNow(buildDate));
    };

    updateRelativeTime();

    const interval = window.setInterval(updateRelativeTime, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [buildDate, isValidTimestamp]);

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
