"use client";

import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Filter, Layers, Search, ShieldCheck } from "lucide-react";
import { PermissionDetailDrawer } from "@/components/members/permissions/permission-detail-drawer";
import type {
  DepartmentGrantState,
  PermissionWorkbenchDepartment,
  PermissionWorkbenchPermission,
  PermissionWorkbenchRole,
  RoleGrantState,
} from "@/components/members/permissions/permission-workbench-client";

const FILTER_BUTTON_CLASS =
  "w-full justify-between rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary";

type PermissionExplorerProps = {
  permissions: PermissionWorkbenchPermission[];
  systemRoles: PermissionWorkbenchRole[];
  roles: PermissionWorkbenchRole[];
  departments: PermissionWorkbenchDepartment[];
  roleGrants: RoleGrantState;
  departmentGrants: DepartmentGrantState;
  setRoleGrants: Dispatch<SetStateAction<RoleGrantState>>;
  setDepartmentGrants: Dispatch<SetStateAction<DepartmentGrantState>>;
  unassignedCount: number;
};

type AssignmentStats = {
  roleCount: number;
  departmentCount: number;
};

type CategorySummary = {
  key: string;
  label: string;
  total: number;
};

export function PermissionExplorer({
  permissions,
  systemRoles,
  roles,
  departments,
  roleGrants,
  departmentGrants,
  setRoleGrants,
  setDepartmentGrants,
  unassignedCount,
}: PermissionExplorerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPermissionKey, setSelectedPermissionKey] = useState<string | null>(null);
  const [focusedPermissionKey, setFocusedPermissionKey] = useState<string | null>(null);

  const permissionMap = useMemo(() => {
    const map = new Map<string, PermissionWorkbenchPermission>();
    for (const permission of permissions) {
      map.set(permission.key, permission);
    }
    return map;
  }, [permissions]);

  const categorySummaries = useMemo<CategorySummary[]>(() => {
    const summaryMap = new Map<string, CategorySummary>();
    for (const permission of permissions) {
      if (!summaryMap.has(permission.categoryKey)) {
        summaryMap.set(permission.categoryKey, {
          key: permission.categoryKey,
          label: permission.categoryLabel,
          total: 0,
        });
      }
      summaryMap.get(permission.categoryKey)!.total += 1;
    }
    return Array.from(summaryMap.values()).sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [permissions]);

  const assignmentStats = useMemo(() => {
    const stats = new Map<string, AssignmentStats>();
    for (const permission of permissions) {
      stats.set(permission.key, { roleCount: 0, departmentCount: 0 });
    }
    for (const role of roles) {
      const grants = roleGrants[role.id];
      if (!grants) continue;
      for (const permissionKey of grants) {
        const entry = stats.get(permissionKey);
        if (!entry) {
          stats.set(permissionKey, { roleCount: 1, departmentCount: 0 });
        } else {
          entry.roleCount += 1;
        }
      }
    }
    for (const department of departments) {
      const grants = departmentGrants[department.id];
      if (!grants) continue;
      for (const permissionKey of grants) {
        const entry = stats.get(permissionKey);
        if (!entry) {
          stats.set(permissionKey, { roleCount: 0, departmentCount: 1 });
        } else {
          entry.departmentCount += 1;
        }
      }
    }
    return stats;
  }, [permissions, roles, roleGrants, departments, departmentGrants]);

  const filteredPermissions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return permissions.filter((permission) => {
      if (activeCategories.size > 0 && !activeCategories.has(permission.categoryKey)) {
        return false;
      }
      if (term) {
        const haystacks = [permission.key, permission.label, permission.description, permission.categoryLabel]
          .filter(Boolean)
          .map((value) => value!.toString().toLowerCase());
        const matches = haystacks.some((value) => value.includes(term));
        if (!matches) return false;
      }
      if (onlyUnassigned) {
        const stats = assignmentStats.get(permission.key);
        if (stats && (stats.roleCount > 0 || stats.departmentCount > 0)) {
          return false;
        }
      }
      return true;
    });
  }, [permissions, activeCategories, searchTerm, onlyUnassigned, assignmentStats]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, { label: string; permissions: PermissionWorkbenchPermission[] }>();
    for (const permission of filteredPermissions) {
      if (!groups.has(permission.categoryKey)) {
        groups.set(permission.categoryKey, {
          label: permission.categoryLabel,
          permissions: [],
        });
      }
      groups.get(permission.categoryKey)!.permissions.push(permission);
    }
    return Array.from(groups.entries()).map(([categoryKey, value]) => ({
      categoryKey,
      label: value.label,
      permissions: value.permissions,
    }));
  }, [filteredPermissions]);

  const focusedPermission =
    (focusedPermissionKey ? permissionMap.get(focusedPermissionKey) : null) ??
    (selectedPermissionKey ? permissionMap.get(selectedPermissionKey) : null) ??
    filteredPermissions[0] ??
    null;

  const handleCategoryToggle = (categoryKey: string) => {
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

  const handleClearFilters = () => {
    setActiveCategories(new Set());
    setOnlyUnassigned(false);
    setSearchTerm("");
  };

  const handleOpenDrawer = (permissionKey: string) => {
    setSelectedPermissionKey(permissionKey);
    setDrawerOpen(true);
  };

  const activeFilters = activeCategories.size + (onlyUnassigned ? 1 : 0) + (searchTerm.trim() ? 1 : 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
      <aside className="space-y-4 xl:sticky xl:top-24">
        <div className="rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            <span>Filter</span>
            <Filter className="h-4 w-4" aria-hidden />
          </div>
          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Suche</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Rechte durchsuchen…"
                  className="pl-9"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                <span>Kategorien</span>
                <Layers className="h-4 w-4" aria-hidden />
              </div>
              <div className="grid gap-2">
                {categorySummaries.map((category) => {
                  const isActive = activeCategories.has(category.key);
                  return (
                    <button
                      key={category.key}
                      type="button"
                      className={cn(
                        FILTER_BUTTON_CLASS,
                        isActive && "border-primary bg-primary/10 text-primary shadow-sm",
                      )}
                      onClick={() => handleCategoryToggle(category.key)}
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
                <span>Besonderes</span>
                <ShieldCheck className="h-4 w-4" aria-hidden />
              </div>
              <button
                type="button"
                className={cn(
                  FILTER_BUTTON_CLASS,
                  onlyUnassigned && "border-primary bg-primary/10 text-primary shadow-sm",
                )}
                onClick={() => setOnlyUnassigned((current) => !current)}
              >
                <span>Nur ungeplante Rechte</span>
                <Badge variant={onlyUnassigned ? "default" : "muted"} size="sm">
                  {unassignedCount}
                </Badge>
              </button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              disabled={activeFilters === 0}
              onClick={handleClearFilters}
            >
              Filter zurücksetzen
            </Button>
          </div>
        </div>
      </aside>

      <div className="space-y-6">
        {groupedPermissions.length === 0 ? (
          <Card className="border-dashed bg-muted/40 text-center">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {activeFilters > 0
                  ? "Keine Rechte passen zu den aktuellen Filtern."
                  : "Keine Rechte gefunden."}
              </p>
            </CardContent>
          </Card>
        ) : null}
        {groupedPermissions.map((group) => (
          <section key={group.categoryKey} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/50" aria-hidden />
              <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                {group.label}
              </div>
              <div className="h-px flex-1 bg-border/50" aria-hidden />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {group.permissions.map((permission) => {
                const stats = assignmentStats.get(permission.key) ?? { roleCount: 0, departmentCount: 0 };
                const isActive = selectedPermissionKey === permission.key;
                const isFocused = focusedPermissionKey === permission.key;
                return (
                  <Card
                    key={permission.key}
                    className={cn(
                      "relative cursor-pointer border-border/80 bg-card/70 transition hover:border-primary/50 hover:shadow-md",
                      (isActive || isFocused) && "border-primary/70 shadow-lg",
                    )}
                    onMouseEnter={() => setFocusedPermissionKey(permission.key)}
                    onMouseLeave={() => setFocusedPermissionKey((current) => (current === permission.key ? null : current))}
                    onClick={() => handleOpenDrawer(permission.key)}
                  >
                    <CardHeader>
                      <CardTitle className="flex flex-col gap-1 text-base">
                        <span>{permission.label}</span>
                        <span className="text-xs font-normal text-muted-foreground">{permission.key}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {permission.description ? (
                        <p className="text-muted-foreground">{permission.description}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={stats.roleCount > 0 ? "default" : "muted"} size="sm">
                          {stats.roleCount} Rollen
                        </Badge>
                        <Badge variant={stats.departmentCount > 0 ? "secondary" : "muted"} size="sm">
                          {stats.departmentCount} Gewerke
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-24 space-y-4">
          <div className="rounded-xl border border-border/80 bg-card/60 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Detailansicht
            </div>
            {focusedPermission ? (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{focusedPermission.label}</p>
                  <p className="text-xs text-muted-foreground">{focusedPermission.key}</p>
                </div>
                {focusedPermission.description ? (
                  <p className="text-sm text-muted-foreground">{focusedPermission.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="muted" size="sm">
                    {focusedPermission.categoryLabel}
                  </Badge>
                  {(() => {
                    const stats = assignmentStats.get(focusedPermission.key) ?? {
                      roleCount: 0,
                      departmentCount: 0,
                    };
                    return (
                      <>
                        <Badge variant={stats.roleCount > 0 ? "default" : "muted"} size="sm">
                          {stats.roleCount} Rollen
                        </Badge>
                        <Badge variant={stats.departmentCount > 0 ? "secondary" : "muted"} size="sm">
                          {stats.departmentCount} Gewerke
                        </Badge>
                      </>
                    );
                  })()}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => focusedPermission && handleOpenDrawer(focusedPermission.key)}
                >
                  Zuweisungen öffnen
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Wähle ein Recht aus, um Details zu sehen und Zuweisungen zu bearbeiten.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border/80 bg-card/40 p-4 text-xs text-muted-foreground">
            <p className="font-semibold uppercase tracking-[0.3em]">Hinweis</p>
            <p className="mt-2 leading-relaxed">
              Owner und Admin verfügen automatisch über vollständigen Zugriff auf alle Rechte. Individuelle
              Zuweisungen werden über Rollen und Gewerke gesteuert.
            </p>
          </div>
        </div>
      </aside>

      <PermissionDetailDrawer
        open={drawerOpen && Boolean(selectedPermissionKey)}
        onOpenChange={setDrawerOpen}
        permission={selectedPermissionKey ? permissionMap.get(selectedPermissionKey) ?? null : null}
        systemRoles={systemRoles}
        roles={roles}
        departments={departments}
        roleGrants={roleGrants}
        departmentGrants={departmentGrants}
        setRoleGrants={setRoleGrants}
        setDepartmentGrants={setDepartmentGrants}
      />
    </div>
  );
}

export default PermissionExplorer;
