import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const connectionStatusBadgeVariants = cva(
  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors duration-200",
  {
    variants: {
      state: {
        idle: "bg-muted/60 text-muted-foreground ring-border/60",
        online: "bg-success/15 text-success ring-success/40",
        offline: "bg-muted/40 text-muted-foreground ring-border/60",
        error: "bg-destructive/15 text-destructive ring-destructive/40",
        warning: "bg-warning/15 text-warning ring-warning/40",
      },
    },
    defaultVariants: {
      state: "idle",
    },
  },
);

export interface ConnectionStatusBadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof connectionStatusBadgeVariants> {
  icon?: React.ReactNode;
}

export function ConnectionStatusBadge({
  icon,
  state,
  children,
  className,
  ...props
}: ConnectionStatusBadgeProps) {
  return (
    <span
      className={cn(connectionStatusBadgeVariants({ state }), "[&>svg]:h-4 [&>svg]:w-4", className)}
      {...props}
    >
      {icon ? <span className="flex items-center text-current">{icon}</span> : null}
      <span className="leading-none">{children}</span>
    </span>
  );
}
