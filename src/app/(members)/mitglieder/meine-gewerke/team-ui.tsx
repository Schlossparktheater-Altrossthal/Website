import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import type { DepartmentMembershipRole } from "@prisma/client";

import { cn } from "@/lib/utils";

export const TEAM_ROLE_LABELS: Record<DepartmentMembershipRole, string> = {
  lead: "Leitung",
  deputy: "Vertretung",
  member: "Mitglied",
  guest: "Gast",
};

export function ColorDot({ color, className }: { color: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
    />
  );
}

export function Initials({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground/80",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function formatEventDate(date: Date) {
  return format(date, "EEE d. MMM, HH:mm", { locale: de });
}

export function formatDue(date: Date) {
  return format(date, "d. MMM", { locale: de });
}

/** Zwei bis drei Ansichten als Segmente in voller Breite, Zustand in `?ansicht=`. */
export function ViewSwitcher<T extends string>({
  basePath,
  current,
  options,
}: {
  basePath: string;
  current: T;
  options: { value: T; label: string }[];
}) {
  return (
    <nav
      aria-label="Ansicht"
      className="flex w-full gap-0.5 rounded-lg bg-muted/70 p-0.5 sm:inline-flex sm:w-auto"
    >
      {options.map((option, index) => {
        const active = option.value === current;
        return (
          <Link
            key={option.value}
            href={index === 0 ? basePath : `${basePath}?ansicht=${option.value}`}
            aria-current={active ? "page" : undefined}
            scroll={false}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Farbige Fläche aus der Gewerk-Farbe, in hell und dunkel lesbar. */
export function tint(color: string | null, amount: number) {
  return `color-mix(in oklab, ${color ?? "var(--muted-foreground)"} ${amount}%, transparent)`;
}

export function AvatarStack({
  initials,
  total,
  size = "sm",
}: {
  initials: string[];
  total: number;
  size?: "sm" | "md";
}) {
  const extra = total - initials.length;
  const box = size === "md" ? "h-8 w-8 text-[11px]" : "h-7 w-7 text-[10px]";
  if (total === 0) return null;
  return (
    <span className="flex items-center -space-x-1" aria-label={`${total} Personen`}>
      {initials.map((value, index) => (
        <span
          key={`${value}-${index}`}
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground/80 ring-2 ring-card",
            box,
          )}
        >
          {value}
        </span>
      ))}
      {extra > 0 ? (
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-card",
            box,
          )}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
