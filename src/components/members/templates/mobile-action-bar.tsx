"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface StickyBottomActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  showOnDesktop?: boolean;
  elevate?: boolean;
  containerClassName?: string;
}

export function StickyBottomActions({
  children,
  className,
  containerClassName,
  showOnDesktop = false,
  elevate = true,
  ...rest
}: StickyBottomActionsProps) {
  return (
    <div
      role="presentation"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]",
        showOnDesktop ? "" : "lg:hidden",
        containerClassName,
      )}
    >
      <div
        {...rest}
        className={cn(
          "pointer-events-auto flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-border/60 bg-background/95 p-3",
          "shadow-lg shadow-black/5 backdrop-blur supports-[backdrop-filter]:bg-background/75",
          elevate ? "" : "shadow-none",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export interface StickyBottomActionsSpacerProps {
  height?: number;
  className?: string;
}

export function StickyBottomActionsSpacer({ height = 96, className }: StickyBottomActionsSpacerProps) {
  return <div aria-hidden className={cn("lg:hidden", className)} style={{ height }} />;
}
