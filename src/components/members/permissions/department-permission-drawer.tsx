"use client";

import { FilterIcon, LayersIcon, PowerIcon } from "@/components/ui/action-icons";

import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  DepartmentGrantState,
  PermissionWorkbenchDepartment,
  PermissionWorkbenchPermission,
} from "@/components/members/permissions/permission-workbench-types";

type DepartmentPermissionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: PermissionWorkbenchDepartment | null;
  permissions: PermissionWorkbenchPermission[];
  departmentGrants: DepartmentGrantState;
  setDepartmentGrants: Dispatch<SetStateAction<DepartmentGrantState>>;
};

export function DepartmentPermissionDrawer({
  open,
  onOpenChange,
  department,
  permissions,
  departmentGrants,
  setDepartmentGrants,
}: DepartmentPermissionDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [onlyAssigned, setOnlyAssigned] = useState(false);
  const [pendingPermissionKeys, setPendingPermissionKeys] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    setSearchTerm("");
    setActiveCategories(new Set());
    setOnlyAssigned(false);
    setPendingPermissionKeys(new Set());
    setBulkLoading(false);
  }, [department?.id]);

  const assignedPermissions = useMemo(() => {
    if (!department) return new Set<string>();
    return new Set(departmentGrants[department.id] ?? []);
  }, [department, departmentGrants]);

  const categorySummaries = useMemo(() => {
    const summaries = new Map<string, { label: string; total: number }>();
    for (const permission of permissions) {
      if (!summaries.has(permission.categoryKey)) {
        summaries.set(permission.categoryKey, { label: permission.categoryLabel, total: 0 });
      }
      summaries.get(permission.categoryKey)!.total += 1;
    }
    return Array.from(summaries.entries()).map(([key, value]) => ({ key, ...value }));
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return permissions.filter((permission) => {
      if (activeCategories.size > 0 && !activeCategories.has(permission.categoryKey)) {
        return false;
      }
      if (term) {
        const haystacks = [
          permission.label,
          permission.key,
          permission.description,
          permission.categoryLabel,
        ]
          .filter(Boolean)
          .map((value) => value!.toString().toLowerCase());
        if (!haystacks.some((value) => value.includes(term))) {
          return false;
        }
      }
      if (onlyAssigned && !assignedPermissions.has(permission.key)) {
        return false;
      }
      return true;
    });
  }, [permissions, activeCategories, searchTerm, onlyAssigned, assignedPermissions]);

  const toggleCategory = (categoryKey: string) => {
    setActiveCategories((current) => {
      const next = new Set(current);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      return next;
    });
  };

  const resetFilters = () => {
    setSearchTerm("");
    setActiveCategories(new Set());
    setOnlyAssigned(false);
  };

  const mutateDepartmentGrant = async (permissionKey: string, grant: boolean) => {
    if (!department) return;
    const departmentId = department.id;
    const previous = new Set(departmentGrants[departmentId] ?? []);
    setDepartmentGrants((current) => {
      const next = { ...current } as DepartmentGrantState;
      const updated = new Set(current[departmentId] ?? []);
      if (grant) {
        updated.add(permissionKey);
      } else {
        updated.delete(permissionKey);
      }
      next[departmentId] = updated;
      return next;
    });
    setPendingPermissionKeys((current) => new Set(current).add(permissionKey));
    try {
      const response = await fetch("/api/permissions/definitions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "department",
          targetId: departmentId,
          permissionKey,
          grant,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Speichern fehlgeschlagen");
      }
    } catch (error) {
      setDepartmentGrants((current) => {
        const next = { ...current } as DepartmentGrantState;
        next[departmentId] = previous;
        return next;
      });
      toast.error("Recht konnte nicht aktualisiert werden", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPendingPermissionKeys((current) => {
        const next = new Set(current);
        next.delete(permissionKey);
        return next;
      });
    }
  };

  const handleBulk = async (grant: boolean) => {
    if (!department) return;
    setBulkLoading(true);
    try {
      for (const permission of permissions) {
        const alreadyGranted = assignedPermissions.has(permission.key);
        if (grant && alreadyGranted) continue;
        if (!grant && !alreadyGranted) continue;
        await mutateDepartmentGrant(permission.key, grant);
      }
      toast.success(
        grant
          ? "Allen Rechten für dieses Gewerk Zugriff gewährt."
          : "Allen Rechten für dieses Gewerk entzogen.",
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const activeFilterCount =
    activeCategories.size + (onlyAssigned ? 1 : 0) + (searchTerm.trim() ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-4xl overflow-y-auto">
        {!department ? (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>Kein Gewerk ausgewählt</SheetTitle>
              <SheetDescription>Wähle ein Gewerk aus, um Rechte zu verwalten.</SheetDescription>
            </SheetHeader>
          </div>
        ) : (
          <div className="space-y-6">
            <SheetHeader className="text-left">
              <SheetTitle>{department.name}</SheetTitle>
              <SheetDescription>
                <span className="text-sm text-muted-foreground">
                  {department.slug ? department.slug : "Kein Slug hinterlegt"}
                </span>
                {department.requiresJoinApproval ? (
                  <Badge variant="warning" size="sm" className="ml-2 align-middle">
                    Zustimmung nötig
                  </Badge>
                ) : null}
              </SheetDescription>
            </SheetHeader>

            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="space-y-4">
                <Card className="border-border/80 bg-card/60">
                  <CardHeader>
                    <CardTitle className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      Filter
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Suche</label>
                      <Input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Rechte durchsuchen"
                        spellCheck={false}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                        <span>Kategorien</span>
                        <LayersIcon className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="grid gap-2">
                        {categorySummaries.map((category) => {
                          const isActive = activeCategories.has(category.key);
                          return (
                            <button
                              key={category.key}
                              type="button"
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-left",
                                "text-sm font-medium transition hover:border-primary/60 hover:bg-primary/5",
                                isActive && "border-primary bg-primary/10 text-primary shadow-sm",
                              )}
                              onClick={() => toggleCategory(category.key)}
                            >
                              <span>{category.label}</span>
                              <Badge variant={isActive ? "default" : "muted"} size="sm">
                                {category.total}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                        <span>Status</span>
                        <PowerIcon className="h-4 w-4" aria-hidden />
                      </div>
                      <Button
                        type="button"
                        variant={onlyAssigned ? "primary" : "outline"}
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => setOnlyAssigned((current) => !current)}
                      >
                        <span>Nur aktive Rechte</span>
                        <Badge variant={onlyAssigned ? "default" : "muted"} size="sm">
                          {assignedPermissions.size}
                        </Badge>
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      disabled={activeFilterCount === 0}
                      onClick={resetFilters}
                    >
                      <FilterIcon className="mr-2 h-4 w-4" /> Filter leeren
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      Schnellaktionen
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleBulk(true)}
                      disabled={bulkLoading || permissions.length === 0}
                    >
                      Allen Rechten Zugriff gewähren
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleBulk(false)}
                      disabled={bulkLoading || permissions.length === 0}
                    >
                      Allen Rechten Zugriff entziehen
                    </Button>
                  </CardContent>
                </Card>
              </aside>

              <div className="space-y-3">
                {filteredPermissions.length === 0 ? (
                  <Card className="border-dashed bg-muted/40 text-center">
                    <CardContent className="py-6 text-sm text-muted-foreground">
                      {activeFilterCount > 0
                        ? "Keine Rechte entsprechen den Filtern."
                        : "Keine Rechte verfügbar."}
                    </CardContent>
                  </Card>
                ) : null}
                {filteredPermissions.map((permission) => {
                  const granted = assignedPermissions.has(permission.key);
                  const pending = pendingPermissionKeys.has(permission.key) || bulkLoading;
                  return (
                    <Card
                      key={permission.key}
                      className={cn(
                        "border-border/70 bg-card/70 transition hover:border-primary/40",
                        granted && "border-secondary/60",
                      )}
                    >
                      <CardHeader className="space-y-1">
                        <CardTitle className="flex flex-col gap-1 text-base">
                          <span>{permission.label}</span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {permission.key}
                          </span>
                        </CardTitle>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="muted" size="sm">
                            {permission.categoryLabel}
                          </Badge>
                          <Badge variant={granted ? "secondary" : "muted"} size="sm">
                            {granted ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {permission.description ? (
                          <p className="text-muted-foreground">{permission.description}</p>
                        ) : null}
                        <Button
                          type="button"
                          variant={granted ? "secondary" : "outline"}
                          className="w-full"
                          disabled={pending}
                          onClick={() => void mutateDepartmentGrant(permission.key, !granted)}
                        >
                          {granted ? "Recht entziehen" : "Recht gewähren"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default DepartmentPermissionDrawer;
