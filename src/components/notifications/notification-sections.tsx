"use client";

import * as React from "react";

import type { InboxCounts, InboxGroup, InboxSection } from "@/lib/notifications/inbox-shared";
import { CATEGORY_LABELS } from "@/lib/notifications/format";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

import { NotificationRow, type InboxUpdate } from "./notification-row";

const SECTION_LABELS: Record<InboxSection, string> = {
  action: "Zu erledigen",
  new: "Neu",
  earlier: "Früher",
};

type NotificationSectionsProps = {
  groups: InboxGroup[];
  update: InboxUpdate;
  onNavigate?: () => void;
  /** Höchstzahl je Abschnitt (Glocke); ohne Angabe alles. */
  limits?: Partial<Record<InboxSection, number>>;
  archived?: boolean;
  empty: React.ReactNode;
};

/** Bündel nach Abschnitten: zuerst was zu tun ist, dann Neues, dann Früheres. */
export function NotificationSections({
  groups,
  update,
  onNavigate,
  limits,
  archived,
  empty,
}: NotificationSectionsProps) {
  if (!groups.length) {
    return <div className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</div>;
  }

  if (archived) {
    return <GroupList groups={groups} update={update} onNavigate={onNavigate} archived />;
  }

  return (
    <div className="space-y-3">
      {(["action", "new", "earlier"] as const).map((section) => {
        const all = groups.filter((group) => group.section === section);
        if (!all.length) return null;
        const shown = limits?.[section] ? all.slice(0, limits[section]) : all;
        return (
          <section key={section} aria-labelledby={`notifications-${section}`}>
            <h3
              id={`notifications-${section}`}
              className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {SECTION_LABELS[section]}
              {section !== "earlier" ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[0.7rem] font-semibold",
                    section === "action"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {all.length}
                </span>
              ) : null}
            </h3>
            <GroupList groups={shown} update={update} onNavigate={onNavigate} />
          </section>
        );
      })}
    </div>
  );
}

function GroupList({
  groups,
  update,
  onNavigate,
  archived,
}: {
  groups: InboxGroup[];
  update: InboxUpdate;
  onNavigate?: () => void;
  archived?: boolean;
}) {
  return (
    <ul className="divide-y divide-border/60">
      {groups.map((group) => (
        <li key={group.key}>
          <NotificationRow
            group={group}
            update={update}
            onNavigate={onNavigate}
            archived={archived}
          />
        </li>
      ))}
    </ul>
  );
}

/** Filter-Chips; Kategorien ohne offene Einträge erscheinen nur, wenn sie gewählt sind. */
export function CategoryChips({
  value,
  onChange,
  counts,
  showAll = false,
  className,
}: {
  value: NotificationCategory | undefined;
  onChange: (value: NotificationCategory | undefined) => void;
  counts: InboxCounts;
  /** Alle Kategorien zeigen (Seite), sonst nur solche mit Offenem. */
  showAll?: boolean;
  className?: string;
}) {
  const categories = NOTIFICATION_CATEGORIES.filter(
    (category) => showAll || counts.byCategory[category] > 0 || category === value,
  );
  if (!showAll && categories.length < 2 && !value) return null;

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-foreground hover:bg-muted",
    );

  return (
    <div
      role="group"
      aria-label="Nach Bereich filtern"
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      <button
        type="button"
        className={chip(!value)}
        aria-pressed={!value}
        onClick={() => onChange(undefined)}
      >
        Alle
      </button>
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          className={chip(value === category)}
          aria-pressed={value === category}
          onClick={() => onChange(value === category ? undefined : category)}
        >
          {CATEGORY_LABELS[category]}
          {counts.byCategory[category] ? (
            <span className="tabular-nums opacity-80">{counts.byCategory[category]}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Pfeiltasten springen zwischen den Einträgen (Desktop). */
export function useRovingNotificationFocus() {
  return React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[data-notification-link]"),
    );
    if (!links.length) return;
    event.preventDefault();
    const index = links.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "ArrowDown"
        ? links[Math.min(index + 1, links.length - 1)]
        : links[Math.max(index - 1, 0)];
    next?.focus();
  }, []);
}
