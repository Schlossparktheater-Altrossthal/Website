"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type DepartmentSelectOption = {
  label: string;
  href: string;
};

interface DepartmentSelectProps {
  options: DepartmentSelectOption[];
}

export function DepartmentSelect({ options }: DepartmentSelectProps) {
  const pathname = usePathname();
  const navOptions = [{ label: "Allgemeines", href: "/mitglieder/meine-gewerke" }, ...options];

  return (
    <nav
      aria-label="Gewerknavigation"
      className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-full border border-border/60 bg-background/80 p-1 text-muted-foreground shadow-inner ring-1 ring-primary/10"
    >
      {navOptions.map((option) => {
        const isActive = pathname === option.href;

        return (
          <Link
            key={option.href}
            href={option.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex min-w-0 items-center justify-center rounded-full px-3.5 py-2 text-xs font-semibold uppercase tracking-wide transition",
              isActive
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
