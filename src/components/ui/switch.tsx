"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onCheckedChange(!checked);
        }}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border bg-muted p-0.5 shadow-sm outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "data-[state=checked]:border-transparent data-[state=checked]:bg-primary data-[state=checked]:shadow-md disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        style={{
          transition: "background-color var(--transition-base), box-shadow var(--transition-base)",
          ...props.style,
        }}
        {...props}
      >
        <span className="sr-only">Umschalten</span>
        <span
          aria-hidden
          className={cn(
            "block h-5 w-5 rounded-full shadow-sm",
            // Ausgeschaltet muss der Knopf auch im dunklen Theme sichtbar sein.
            checked ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground",
          )}
          style={{ transition: "transform var(--transition-base)" }}
        />
      </button>
    );
  },
);

Switch.displayName = "Switch";

export { Switch };
