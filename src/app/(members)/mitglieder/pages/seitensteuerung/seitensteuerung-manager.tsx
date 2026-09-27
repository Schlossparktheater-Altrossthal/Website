"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { LockIcon, SearchIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { defaultMembersNavIcon, membersNavigation } from "@/config/members-navigation";
import { LOCKED_MEMBER_PAGES } from "@/lib/members-page-visibility";
import { cn } from "@/lib/utils";
import type { ClientWebsiteSettings } from "@/lib/website-settings";

type VisibilityFilter = "all" | "visible" | "hidden";
type MembersVisibility = ClientWebsiteSettings["pageVisibility"]["members"];

const FILTER_OPTIONS = [
  { value: "all" as const, label: "Alle" },
  { value: "visible" as const, label: "Sichtbar" },
  { value: "hidden" as const, label: "Ausgeblendet" },
];

const PAGE_GROUPS = membersNavigation
  .map((group) => ({
    id: group.id,
    label: group.label,
    pages: group.items.map((item) => ({
      key: item.href,
      label: item.label,
      icon: item.icon ?? defaultMembersNavIcon,
      permissionKey: item.permissionKey,
      locked: LOCKED_MEMBER_PAGES.has(item.href),
    })),
  }))
  .filter((group) => group.pages.length > 0);

const ALL_PAGES = PAGE_GROUPS.flatMap((group) => group.pages);

export function SeitensteuerungManager({
  permissionLabels,
}: {
  permissionLabels: Record<string, string>;
}) {
  const [visibility, setVisibility] = useState<MembersVisibility | null>(null);
  const [filter, setFilter] = useState<VisibilityFilter>("all");
  const [query, setQuery] = useState("");
  // Zuletzt gespeicherter Stand, damit fehlgeschlagene Änderungen zurückspringen.
  const savedRef = useRef<MembersVisibility>({});

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const response = await fetch("/api/website/settings", { cache: "no-store" });
      if (!response.ok) {
        toast.error("Einstellungen konnten nicht geladen werden");
        return;
      }
      const payload = (await response.json()) as { settings?: ClientWebsiteSettings };
      if (!mounted) return;
      const members = payload.settings?.pageVisibility.members ?? {};
      savedRef.current = members;
      setVisibility(members);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const isVisible = (key: string) => visibility?.[key] ?? true;

  const updatePages = async (keys: string[], next: boolean) => {
    const changed = keys.filter((key) => !LOCKED_MEMBER_PAGES.has(key));
    if (changed.length === 0) return;
    const nextMembers = {
      ...savedRef.current,
      ...Object.fromEntries(changed.map((key) => [key, next])),
    };
    setVisibility(nextMembers);
    const response = await fetch("/api/website/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { pageVisibility: { members: nextMembers } } }),
    });
    if (!response.ok) {
      setVisibility(savedRef.current);
      toast.error("Änderung konnte nicht gespeichert werden");
      return;
    }
    savedRef.current = nextMembers;
    const label =
      changed.length === 1
        ? (ALL_PAGES.find((page) => page.key === changed[0])?.label ?? "Seite")
        : `${changed.length} Seiten`;
    toast.success(`${label} ${next ? "eingeblendet" : "ausgeblendet"}`);
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredGroups = useMemo(
    () =>
      PAGE_GROUPS.map((group) => ({
        ...group,
        pages: group.pages.filter((page) => {
          const visible = visibility?.[page.key] ?? true;
          if (filter === "visible" && !visible) return false;
          if (filter === "hidden" && visible) return false;
          if (!normalizedQuery) return true;
          return (
            page.label.toLowerCase().includes(normalizedQuery) ||
            page.key.toLowerCase().includes(normalizedQuery)
          );
        }),
      })).filter((group) => group.pages.length > 0),
    [visibility, filter, normalizedQuery],
  );

  if (!visibility) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const visibleCount = ALL_PAGES.filter((page) => isVisible(page.key)).length;
  const hiddenCount = ALL_PAGES.length - visibleCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{visibleCount}</span> von{" "}
          {ALL_PAGES.length} Seiten sichtbar
          {hiddenCount > 0 ? ` · ${hiddenCount} ausgeblendet` : null}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-56">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Seite suchen"
              aria-label="Seite suchen"
              className="pl-9"
            />
          </div>
          <SegmentedControl
            value={filter}
            onValueChange={setFilter}
            options={FILTER_OPTIONS}
            aria-label="Seiten filtern"
            fullWidth
            className="sm:w-auto"
          />
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Keine Seiten gefunden.
          </CardContent>
        </Card>
      ) : null}

      {filteredGroups.map((group) => {
        const allGroupPages = PAGE_GROUPS.find((entry) => entry.id === group.id)?.pages ?? [];
        const toggleable = allGroupPages.filter((page) => !page.locked);
        const groupVisible = allGroupPages.filter((page) => isVisible(page.key)).length;
        const allOn = toggleable.every((page) => isVisible(page.key));
        const allOff = toggleable.every((page) => !isVisible(page.key));

        return (
          <Card key={group.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{group.label}</CardTitle>
                <Badge
                  variant={groupVisible === allGroupPages.length ? "muted" : "warning"}
                  size="sm"
                >
                  {groupVisible}/{allGroupPages.length} sichtbar
                </Badge>
              </div>
              {toggleable.length > 1 ? (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={allOn}
                    onClick={() =>
                      void updatePages(
                        toggleable.map((page) => page.key),
                        true,
                      )
                    }
                  >
                    Alle ein
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={allOff}
                    onClick={() =>
                      void updatePages(
                        toggleable.map((page) => page.key),
                        false,
                      )
                    }
                  >
                    Alle aus
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="divide-y divide-border">
                {group.pages.map((page) => {
                  const visible = isVisible(page.key);
                  const Icon = page.icon;
                  const permissionLabel = page.permissionKey
                    ? (permissionLabels[page.permissionKey] ?? page.permissionKey)
                    : null;
                  return (
                    <li key={page.key}>
                      <label
                        className={cn(
                          "flex min-h-14 items-center gap-3 rounded-md px-2 py-2.5",
                          page.locked ? "cursor-default" : "cursor-pointer hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                            visible
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border/60 bg-muted/50 text-muted-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className={cn("min-w-0 flex-1", !visible && "opacity-60")}>
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{page.label}</span>
                            {!visible ? (
                              <Badge variant="muted" size="sm">
                                Ausgeblendet
                              </Badge>
                            ) : null}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {page.key}
                            {permissionLabel ? (
                              <span className="hidden sm:inline"> · Recht: {permissionLabel}</span>
                            ) : null}
                          </span>
                        </span>
                        {page.locked ? (
                          <span
                            className="flex items-center gap-1 text-xs text-muted-foreground"
                            title="Diese Seite lässt sich nicht ausblenden"
                          >
                            <LockIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Immer sichtbar</span>
                          </span>
                        ) : (
                          <Switch
                            checked={visible}
                            onCheckedChange={(checked) => void updatePages([page.key], checked)}
                            aria-label={`${page.label} ${visible ? "ausblenden" : "einblenden"}`}
                          />
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
