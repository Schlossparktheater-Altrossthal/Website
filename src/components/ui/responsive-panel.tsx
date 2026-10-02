"use client";

import * as React from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";

/** Mobil ein Blatt von unten, ab 640 px ein Dialog (beides über `BottomSheet`). */
export function ResponsivePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={footer}
    >
      {children}
    </BottomSheet>
  );
}
