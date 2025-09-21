import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

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
  return (
    <h1
      className={cn(
        "text-3xl font-semibold tracking-tight text-foreground sm:text-4xl",
        className,
      )}
      {...props}
    />
  );
}

type PageHeaderDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

export function PageHeaderDescription({
  className,
  ...props
}: PageHeaderDescriptionProps) {
  return (
    <p
      className={cn(
        "max-w-2xl text-sm text-muted-foreground sm:text-base",
        className,
      )}
      {...props}
    />
  );
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
        idle: "bg-muted text-muted-foreground ring-border/60",
        online:
          "bg-emerald-50 text-emerald-700 ring-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/40",
        offline:
          "bg-muted text-muted-foreground ring-border/60 dark:bg-muted/40 dark:text-muted-foreground",
        error:
          "bg-rose-50 text-rose-700 ring-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-400/40",
        warning:
          "bg-amber-50 text-amber-700 ring-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-400/40",
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
