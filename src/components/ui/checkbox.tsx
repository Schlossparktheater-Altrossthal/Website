"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type CheckedState = boolean | "indeterminate";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "checked" | "defaultChecked" | "onChange"> & {
  checked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
};

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, checked, onCheckedChange, ...props }, ref) => {
  const internalRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => internalRef.current as HTMLInputElement);

  React.useEffect(() => {
    if (!internalRef.current) return;
    internalRef.current.indeterminate = checked === "indeterminate";
  }, [checked]);

  return (
    <input
      ref={internalRef}
      type="checkbox"
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-input bg-background text-primary shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "checked:border-primary checked:bg-primary checked:text-primary-foreground",
        "disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive/60 aria-invalid:ring-destructive/30",
        className
      )}
      checked={checked === true}
      aria-checked={checked === "indeterminate" ? "mixed" : checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  );
});

Checkbox.displayName = "Checkbox";

export { Checkbox };
