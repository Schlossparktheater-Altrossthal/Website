import React from "react";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number | React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-4 flex items-center gap-3">
      {icon ? <div className="text-primary" aria-hidden>{icon}</div> : null}
      <div>
        <div className="text-xs uppercase tracking-wide text-foreground/70">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-foreground/70">{hint}</div>}
      </div>
    </Card>
  );
}

