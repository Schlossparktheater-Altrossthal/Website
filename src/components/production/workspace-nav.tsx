import Link from "next/link";

import { cn } from "@/lib/utils";

type WorkspaceKey = "overview" | "departments" | "casting" | "scenes";

const NAVIGATION: { key: WorkspaceKey; label: string; href: string }[] = [
  { key: "overview", label: "Übersicht", href: "/mitglieder/produktionen" },
  { key: "departments", label: "Gewerke & Teams", href: "/mitglieder/produktionen/gewerke" },
  { key: "casting", label: "Rollen & Besetzung", href: "/mitglieder/produktionen/besetzung" },
  { key: "scenes", label: "Szenen & Breakdowns", href: "/mitglieder/produktionen/szenen" },
];

export function ProductionWorkspaceNav({ active }: { active: WorkspaceKey }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Produktionsbereiche">
      {NAVIGATION.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition",
            item.key === active
              ? "border-primary/70 bg-primary/10 text-primary shadow-sm"
              : "border-border/60 bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
