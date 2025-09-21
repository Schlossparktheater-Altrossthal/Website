import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const keyMetricValueVariants = cva(
  "text-2xl font-semibold tracking-tight",
  {
    variants: {
      tone: {
        default: "text-foreground",
        positive: "text-success",
        info: "text-info",
        warning: "text-warning",
        destructive: "text-destructive",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  },
);

export interface KeyMetricCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof keyMetricValueVariants> {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
}

export function KeyMetricCard({
  label,
  value,
  hint,
  icon,
  tone,
  className,
  ...props
}: KeyMetricCardProps) {
  return (
    <Card data-pattern="key-metric" className={cn("h-full", className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground/90">
          {label}
        </CardTitle>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className={cn(keyMetricValueVariants({ tone }))}>{value}</div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

type KeyMetricGridProps = React.HTMLAttributes<HTMLDivElement>;

export function KeyMetricGrid({ className, ...props }: KeyMetricGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:auto-rows-fr xl:grid-cols-2",
        className,
      )}
      {...props}
    />
  );
}

export { keyMetricValueVariants };
