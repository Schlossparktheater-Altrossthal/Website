"use client";

import * as React from "react";

import {
  CategoryChips,
  NotificationSections,
  useRovingNotificationFocus,
} from "@/components/notifications/notification-sections";
import { useInbox } from "@/components/notifications/use-inbox";
import { CheckCheckIcon, SearchIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { NotificationCategory } from "@/lib/notifications/types";

type View = "open" | "all" | "archive";

export function NotificationsPageClient() {
  const [view, setView] = React.useState<View>("open");
  const [category, setCategory] = React.useState<NotificationCategory | undefined>();
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  const onKeyDown = useRovingNotificationFocus();

  React.useEffect(() => {
    const timer = window.setTimeout(() => setQ(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const inbox = useInbox({ category, q, archived: view === "archive", limit: 50 });
  const groups =
    view === "open" ? inbox.groups.filter((group) => group.section !== "earlier") : inbox.groups;
  const openCount = inbox.counts.action + inbox.counts.new;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl<View>
          value={view}
          onValueChange={setView}
          aria-label="Ansicht"
          options={[
            { value: "open", label: openCount ? `Offen (${openCount})` : "Offen" },
            { value: "all", label: "Alle" },
            { value: "archive", label: "Archiv" },
          ]}
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Suchen"
              aria-label="Benachrichtigungen durchsuchen"
              className="pl-8"
            />
          </div>
          {view !== "archive" && openCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void inbox.update("read", { all: true })}
            >
              <CheckCheckIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Alle gelesen</span>
              <span className="sr-only sm:hidden">Alle als gelesen markieren</span>
            </Button>
          ) : null}
        </div>
      </div>

      <CategoryChips value={category} onChange={setCategory} counts={inbox.counts} showAll />

      <Card className="py-2" onKeyDown={onKeyDown}>
        <NotificationSections
          groups={groups}
          update={inbox.update}
          archived={view === "archive"}
          empty={
            !inbox.loaded
              ? "Lade…"
              : q
                ? "Nichts gefunden."
                : view === "archive"
                  ? "Das Archiv ist leer."
                  : view === "open"
                    ? "Alles erledigt – nichts Offenes."
                    : "Noch keine Benachrichtigungen."
          }
        />
        {inbox.nextCursor ? (
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={() => void inbox.loadMore()}>
              Mehr laden
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
