"use client";

import { ChevronDownIcon, SettingsIcon } from "@/components/ui/action-icons";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { membersNavigation } from "@/config/members-navigation";
import { toast } from "sonner";
import type { ClientWebsiteSettings } from "@/lib/website-settings";

export function SeitensteuerungManager() {
  const memberPageGroups = useMemo(
    () =>
      membersNavigation
        .map((group) => ({
          id: group.id,
          label: group.label,
          pages: group.items
            .filter((item) => item.href !== "/mitglieder/pages/seitensteuerung")
            .map((item) => ({ key: item.href, label: item.label })),
        }))
        .filter((group) => group.pages.length > 0),
    [],
  );
  const memberPages = useMemo(
    () => memberPageGroups.flatMap((group) => group.pages),
    [memberPageGroups],
  );
  const [pageVisibility, setPageVisibility] = useState<ClientWebsiteSettings["pageVisibility"]>({
    members: {},
  });
  const [pendingMembers, setPendingMembers] = useState<Record<string, boolean>>({});
  const [savingPage, setSavingPage] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initialMembers = Object.fromEntries(memberPages.map((page) => [page.key, true]));
    setPendingMembers(initialMembers);
  }, [memberPages]);
  useEffect(() => {
    setExpandedCategories(Object.fromEntries(memberPageGroups.map((group) => [group.id, false])));
  }, [memberPageGroups]);

  useEffect(() => {
    let mounted = true;
    const loadSettings = async () => {
      const response = await fetch("/api/website/settings", { cache: "no-store" });
      if (!response.ok) {
        toast.error("Einstellungen konnten nicht geladen werden");
        return;
      }
      const payload = (await response.json()) as { settings?: ClientWebsiteSettings };
      if (!mounted || !payload.settings) return;
      setPageVisibility(payload.settings.pageVisibility);
      const membersFromSettings = payload.settings.pageVisibility.members ?? {};
      setPendingMembers(
        Object.fromEntries(
          memberPages.map((page) => [page.key, membersFromSettings[page.key] ?? true]),
        ),
      );
    };
    void loadSettings();
    return () => {
      mounted = false;
    };
  }, [memberPages]);

  const saveVisibility = async (
    partial: { members?: ClientWebsiteSettings["pageVisibility"]["members"] },
    key: string,
  ) => {
    setSavingPage(key);
    const nextVisibility = { ...pageVisibility, ...partial };
    const res = await fetch("/api/website/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { pageVisibility: nextVisibility } }),
    });
    setSavingPage(null);
    if (!res.ok) {
      toast.error("Seitenstatus konnte nicht gespeichert werden");
      return;
    }
    setPageVisibility(nextVisibility);
    toast.success("Seitenstatus gespeichert");
  };

  const setCategoryExpanded = (categoryId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const getCategoryStatus = (categoryPageKeys: string[]) => {
    const enabledCount = categoryPageKeys.filter(
      (pageKey) => (pendingMembers[pageKey] ?? true) === true,
    ).length;
    if (enabledCount === 0) return "disabled";
    if (enabledCount === categoryPageKeys.length) return "enabled";
    return "partial";
  };

  const toggleCategory = async (categoryPageKeys: string[], next: boolean, categoryId: string) => {
    const nextMembers = {
      ...pageVisibility.members,
      ...Object.fromEntries(categoryPageKeys.map((pageKey) => [pageKey, next])),
    };

    setPendingMembers((prev) => ({
      ...prev,
      ...Object.fromEntries(categoryPageKeys.map((pageKey) => [pageKey, next])),
    }));
    await saveVisibility({ members: nextMembers }, categoryId);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Seitensteuerung</h1>

      <Card>
        <CardHeader>
          <CardTitle>Mitglieder-Seiten ({memberPages.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberPageGroups.map((group) => {
            const categoryPageKeys = group.pages.map((page) => page.key);
            const categoryStatus = getCategoryStatus(categoryPageKeys);
            const expanded = expandedCategories[group.id] ?? false;

            return (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center gap-3 px-1 py-1">
                  <button
                    type="button"
                    className="flex flex-1 items-center text-left"
                    onClick={() => setCategoryExpanded(group.id)}
                    aria-expanded={expanded}
                  >
                    <ChevronDownIcon
                      className={`mr-2 h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`}
                    />
                    <span className="text-lg font-semibold">{group.label}</span>
                  </button>
                  <div className="relative">
                    <Switch
                      checked={categoryStatus === "enabled"}
                      onCheckedChange={(checked) =>
                        void toggleCategory(categoryPageKeys, checked, group.id)
                      }
                      aria-label={`${group.label} aktivieren`}
                    />
                    {categoryStatus === "partial" ? (
                      <span className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-sm" />
                    ) : null}
                  </div>
                </div>
                {expanded && (
                  <div className="space-y-2 pl-2">
                    {group.pages.map((page) => (
                      <div key={page.key} className="flex items-center justify-between px-3 py-2">
                        <span>{page.label}</span>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <SettingsIcon className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{page.label} konfigurieren</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label htmlFor={`member-${page.key}`}>Seite aktivieren</Label>
                                <Switch
                                  id={`member-${page.key}`}
                                  checked={pendingMembers[page.key] ?? true}
                                  onCheckedChange={(checked) =>
                                    setPendingMembers((prev) => ({ ...prev, [page.key]: checked }))
                                  }
                                />
                              </div>
                              <Button
                                disabled={savingPage === page.key}
                                onClick={() =>
                                  void saveVisibility(
                                    {
                                      members: {
                                        ...pageVisibility.members,
                                        [page.key]: pendingMembers[page.key] ?? true,
                                      },
                                    },
                                    page.key,
                                  )
                                }
                              >
                                Speichern
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
