import type * as React from "react";

import { Badge } from "@/components/ui/badge";
import type { StatusTone } from "@/lib/inventory/constants";

const VARIANT: Record<StatusTone, "success" | "info" | "warning" | "destructive" | "muted"> = {
  success: "success",
  info: "info",
  warning: "warning",
  destructive: "destructive",
  muted: "muted",
};

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant={VARIANT[tone]} size="sm" className={className}>
      {children}
    </Badge>
  );
}
