"use client";

import { CheckIcon, MinusIcon } from "@/components/ui/action-icons";
import { cn } from "@/lib/utils";

export type PermissionToggleState = boolean | "indeterminate" | undefined;

type PermissionToggleProps = {
  checked?: PermissionToggleState;
  disabled?: boolean;
  className?: string;
  onCheckedChange?: (checked: PermissionToggleState) => void;
};

export function PermissionToggle({
  checked = false,
  disabled = false,
  className,
  onCheckedChange,
}: PermissionToggleProps) {
  const isChecked = checked === true;
  const isIndeterminate = checked === "indeterminate";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isIndeterminate ? "mixed" : isChecked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(isChecked ? false : true)}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full border border-border bg-transparent text-primary-foreground transition-colors",
        "hover:border-primary/40 hover:bg-primary/10",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary/60",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent",
        className,
      )}
      data-state={isChecked ? "checked" : isIndeterminate ? "indeterminate" : "unchecked"}
    >
      {isChecked ? <CheckIcon className="size-3" /> : null}
      {isIndeterminate ? <MinusIcon className="size-3" /> : null}
    </button>
  );
}
