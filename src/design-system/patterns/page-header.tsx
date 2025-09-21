import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type PageHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function PageHeader({ className, ...props }: PageHeaderProps) {
  return (
    <div
      data-pattern="page-header"
      className={cn(
        "flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6",
        className,
      )}
      {...props}
    />
  );
}

type PageHeaderTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export function PageHeaderTitle({ className, ...props }: PageHeaderTitleProps) {
  return <Heading level="h1" className={cn("text-3xl sm:text-4xl", className)} {...props} />;
}

type PageHeaderDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export function PageHeaderDescription({
  className,
  ...props
}: PageHeaderDescriptionProps) {
  return <Text className={cn("max-w-2xl", className)} tone="muted" variant="body" {...props} />;
}

type PageHeaderActionsProps = React.HTMLAttributes<HTMLDivElement>;

export function PageHeaderActions({ className, ...props }: PageHeaderActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

const pageHeaderStatusVariants = cva(
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

export interface PageHeaderStatusProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pageHeaderStatusVariants> {
  icon?: React.ReactNode;
}

export function PageHeaderStatus({
  icon,
  state,
  children,
  className,
  ...props
}: PageHeaderStatusProps) {
  return (
    <span
      className={cn(pageHeaderStatusVariants({ state }), "[&>svg]:h-4 [&>svg]:w-4", className)}
      {...props}
    >
      {icon ? <span className="flex items-center text-current">{icon}</span> : null}
      <span className="leading-none">{children}</span>
    </span>
  );
}
