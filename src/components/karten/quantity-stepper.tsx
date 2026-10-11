"use client";

import { Button } from "@/components/ui/button";
import { MinusIcon, PlusIcon } from "@/components/ui/action-icons";
import { cn } from "@/lib/utils";

/** − 2 + mit großen Tippflächen; Pfeiltasten hoch/runter ändern die Zahl. */
export function QuantityStepper({
  value,
  onChange,
  max = 99,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  label: string;
  className?: string;
}) {
  const set = (next: number) => onChange(Math.max(0, Math.min(max, next)));
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label={`${label}: eine weniger`}
        disabled={value <= 0}
        onClick={() => set(value - 1)}
        tabIndex={-1}
      >
        <MinusIcon />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={value}
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          set(digits ? Number.parseInt(digits, 10) : 0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            set(value + 1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            set(value - 1);
          }
        }}
        className="h-9 w-12 rounded-md border border-border bg-background text-center text-base font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label={`${label}: eine mehr`}
        disabled={value >= max}
        onClick={() => set(value + 1)}
        tabIndex={-1}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
