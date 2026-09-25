"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/action-icons";
import { cn } from "@/lib/utils";

const MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

type MonthSwitcherProps = {
  month: Date;
  onPrevious: () => void;
  onNext: () => void;
  /** Zeigt „Heute“, solange nicht der aktuelle Monat zu sehen ist. */
  onToday?: () => void;
  isCurrentMonth?: boolean;
  className?: string;
};

/** Monatstitel mit Vor/Zurück – gemeinsam für alle Kalenderansichten. */
export function MonthSwitcher({
  month,
  onPrevious,
  onNext,
  onToday,
  isCurrentMonth,
  className,
}: MonthSwitcherProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <h2 className="mr-auto min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg">
        {MONTH_FORMATTER.format(month)}
      </h2>
      {onToday && !isCurrentMonth ? (
        <Button type="button" variant="ghost" size="xs" onClick={onToday}>
          Heute
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onPrevious}
        aria-label="Vorheriger Monat"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onNext}
        aria-label="Nächster Monat"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
