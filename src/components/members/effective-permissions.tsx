"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ExplainedPermission, PermissionSource } from "@/lib/permissions";
import { cn } from "@/lib/utils";

function sourceText(source: PermissionSource): string {
  switch (source.kind) {
    case "baseline":
      return "Grundzugang";
    case "admin":
      return `${source.label}: alle Rechte`;
    case "role":
      return source.viaProductions.length
        ? `${source.label} (über ${source.viaProductions.join(", ")})`
        : `Rolle ${source.label}`;
    case "customRole":
      return `Rolle ${source.label}`;
    case "department":
      return `Gewerk ${source.label}`;
  }
}

const SOURCE_CLASS: Record<PermissionSource["kind"], string> = {
  baseline: "border-border/60 bg-muted/50 text-muted-foreground",
  admin: "border-destructive/40 bg-destructive/10 text-destructive",
  role: "border-primary/40 bg-primary/10 text-primary",
  customRole: "border-primary/40 bg-primary/10 text-primary",
  department: "border-info/40 bg-info/10 text-info",
};

/** Effektive Rechte eines Mitglieds mit Herkunft: beantwortet „Warum darf X das?“. */
export function EffectivePermissions({ permissions }: { permissions: ExplainedPermission[] }) {
  const [filter, setFilter] = useState<"granted" | "all">("granted");
  const grantedCount = permissions.filter((p) => p.sources.length > 0).length;

  const categories = useMemo(() => {
    const map = new Map<string, ExplainedPermission[]>();
    for (const permission of permissions) {
      if (filter === "granted" && !permission.sources.length) continue;
      const list = map.get(permission.categoryLabel) ?? [];
      list.push(permission);
      map.set(permission.categoryLabel, list);
    }
    return [...map.entries()];
  }, [permissions, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          aria-label="Rechte filtern"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "granted", label: `Erlaubt ${grantedCount}` },
            { value: "all", label: `Alle ${permissions.length}` },
          ]}
        />
        <Link href="/mitglieder/rechte" className="text-sm text-primary hover:underline">
          Rechte der Rollen ändern
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border">
        {categories.map(([category, entries]) => (
          <section key={category}>
            <h3 className="border-b bg-muted/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {category}
            </h3>
            <ul className="divide-y">
              {entries.map((permission) => (
                <li
                  key={permission.key}
                  className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span
                    className={cn(
                      "text-sm",
                      permission.sources.length ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {permission.label}
                  </span>
                  <span className="flex flex-wrap gap-1 sm:justify-end">
                    {permission.sources.length ? (
                      permission.sources.map((source, index) => (
                        <span
                          key={index}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs",
                            SOURCE_CLASS[source.kind],
                          )}
                        >
                          {sourceText(source)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">nicht erlaubt</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
