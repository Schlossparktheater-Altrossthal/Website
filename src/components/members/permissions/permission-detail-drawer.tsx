"use client";

import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  DepartmentGrantState,
  PermissionWorkbenchDepartment,
  PermissionWorkbenchPermission,
  PermissionWorkbenchRole,
  RoleGrantState,
} from "@/components/members/permissions/permission-workbench-client";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS } from "@/lib/roles";

const ACTION_BUTTON_CLASS =
  "flex w-full items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5";

type PermissionDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission: PermissionWorkbenchPermission | null;
  systemRoles: PermissionWorkbenchRole[];
  roles: PermissionWorkbenchRole[];
  departments: PermissionWorkbenchDepartment[];
  roleGrants: RoleGrantState;
  departmentGrants: DepartmentGrantState;
  setRoleGrants: Dispatch<SetStateAction<RoleGrantState>>;
  setDepartmentGrants: Dispatch<SetStateAction<DepartmentGrantState>>;
};

type PendingState = Set<string>;

export function PermissionDetailDrawer({
  open,
  onOpenChange,
  permission,
  systemRoles,
  roles,
  departments,
  roleGrants,
  departmentGrants,
  setRoleGrants,
  setDepartmentGrants,
}: PermissionDetailDrawerProps) {
  const [pendingRoleIds, setPendingRoleIds] = useState<PendingState>(new Set());
  const [pendingDepartmentIds, setPendingDepartmentIds] = useState<PendingState>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const markRolePending = (roleId: string, pending: boolean) => {
    setPendingRoleIds((current) => {
      const next = new Set(current);
      if (pending) next.add(roleId);
      else next.delete(roleId);
      return next;
    });
  };

  const markDepartmentPending = (departmentId: string, pending: boolean) => {
    setPendingDepartmentIds((current) => {
      const next = new Set(current);
      if (pending) next.add(departmentId);
      else next.delete(departmentId);
      return next;
    });
  };

  const assignedRoleIds = useMemo(() => {
    if (!permission) return new Set<string>();
    const set = new Set<string>();
    for (const role of roles) {
      if (roleGrants[role.id]?.has(permission.key)) {
        set.add(role.id);
      }
    }
    return set;
  }, [permission, roles, roleGrants]);

  const assignedDepartmentIds = useMemo(() => {
    if (!permission) return new Set<string>();
    const set = new Set<string>();
    for (const department of departments) {
      if (departmentGrants[department.id]?.has(permission.key)) {
        set.add(department.id);
      }
    }
    return set;
  }, [permission, departments, departmentGrants]);

  const mutateRoleGrant = async (roleId: string, grant: boolean) => {
    if (!permission) return;
    const permissionKey = permission.key;
    const previous = new Set(roleGrants[roleId] ?? []);
    setRoleGrants((current) => {
      const next = { ...current } as RoleGrantState;
      const updated = new Set(current[roleId] ?? []);
      if (grant) {
        updated.add(permissionKey);
      } else {
        updated.delete(permissionKey);
      }
      next[roleId] = updated;
      return next;
    });
    markRolePending(roleId, true);
    try {
      const response = await fetch("/api/permissions/definitions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "role",
          targetId: roleId,
          permissionKey,
          grant,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Speichern fehlgeschlagen");
      }
    } catch (error) {
      setRoleGrants((current) => {
        const next = { ...current } as RoleGrantState;
        next[roleId] = previous;
        return next;
      });
      toast.error("Zuweisung konnte nicht aktualisiert werden", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      markRolePending(roleId, false);
    }
  };

  const mutateDepartmentGrant = async (departmentId: string, grant: boolean) => {
    if (!permission) return;
    const permissionKey = permission.key;
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
    markDepartmentPending(departmentId, true);
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
      toast.error("Gewerk konnte nicht aktualisiert werden", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      markDepartmentPending(departmentId, false);
    }
  };

  const handleBulkRoles = async (grant: boolean) => {
    if (!permission) return;
    setBulkLoading(true);
    try {
      for (const role of roles) {
        const alreadyGranted = roleGrants[role.id]?.has(permission.key) ?? false;
        if (grant && alreadyGranted) continue;
        if (!grant && !alreadyGranted) continue;
        await mutateRoleGrant(role.id, grant);
      }
      toast.success(grant ? "Recht allen Rollen zugewiesen." : "Recht bei allen Rollen entfernt.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDepartments = async (grant: boolean) => {
    if (!permission) return;
    setBulkLoading(true);
    try {
      for (const department of departments) {
        const alreadyGranted = departmentGrants[department.id]?.has(permission.key) ?? false;
        if (grant && alreadyGranted) continue;
        if (!grant && !alreadyGranted) continue;
        await mutateDepartmentGrant(department.id, grant);
      }
      toast.success(grant ? "Recht allen Gewerken zugewiesen." : "Recht bei allen Gewerken entfernt.");
    } finally {
      setBulkLoading(false);
    }
  };

  const renderRoleRow = (role: PermissionWorkbenchRole, granted: boolean, pending: boolean) => {
    const label = role.systemRole ? ROLE_LABELS[role.systemRole as keyof typeof ROLE_LABELS] ?? role.name : role.name;
    return (
      <button
        key={role.id}
        type="button"
        className={cn(
          ACTION_BUTTON_CLASS,
          granted && "border-primary bg-primary/10 text-primary",
          pending && "opacity-60",
        )}
        onClick={() => mutateRoleGrant(role.id, !granted)}
        disabled={pending || bulkLoading}
      >
        <span className="truncate text-left">
          {label}
          {role.systemRole ? (
            <span className="ml-2 text-xs font-semibold text-muted-foreground/70">System</span>
          ) : null}
        </span>
        <Badge variant={granted ? "default" : "muted"} size="sm">
          {granted ? "Aktiv" : "Inaktiv"}
        </Badge>
      </button>
    );
  };

  const renderDepartmentRow = (
    department: PermissionWorkbenchDepartment,
    granted: boolean,
    pending: boolean,
  ) => {
    return (
      <button
        key={department.id}
        type="button"
        className={cn(
          ACTION_BUTTON_CLASS,
          granted && "border-secondary bg-secondary/10 text-secondary",
          pending && "opacity-60",
        )}
        onClick={() => mutateDepartmentGrant(department.id, !granted)}
        disabled={pending || bulkLoading}
      >
        <span className="truncate text-left">
          <span className="font-medium">{department.name}</span>
          {department.slug ? (
            <span className="ml-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{department.slug}</span>
          ) : null}
          {department.requiresJoinApproval ? (
            <Badge variant="warning" size="sm" className="ml-2">
              Zustimmung nötig
            </Badge>
          ) : null}
        </span>
        <Badge variant={granted ? "secondary" : "muted"} size="sm">
          {granted ? "Aktiv" : "Inaktiv"}
        </Badge>
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-3xl overflow-y-auto">
        {!permission ? (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>Kein Recht ausgewählt</SheetTitle>
              <SheetDescription>Wähle ein Recht aus, um Zuweisungen zu bearbeiten.</SheetDescription>
            </SheetHeader>
          </div>
        ) : (
          <div className="space-y-6">
            <SheetHeader className="text-left">
              <SheetTitle>{permission.label}</SheetTitle>
              <SheetDescription>
                <span className="font-mono text-xs text-muted-foreground">{permission.key}</span>
                {permission.description ? <p className="mt-2 text-sm">{permission.description}</p> : null}
              </SheetDescription>
            </SheetHeader>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Systemrollen</h3>
                <Badge variant="muted" size="sm">
                  Immer aktiv
                </Badge>
              </div>
              <div className="grid gap-2">
                {systemRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Systemrollen registriert.</p>
                ) : null}
                {systemRoles.map((role) => {
                  const label = role.systemRole
                    ? ROLE_LABELS[role.systemRole as keyof typeof ROLE_LABELS] ?? role.name
                    : role.name;
                  return (
                    <div
                      key={role.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="flex flex-col">
                        <span className="font-medium">{label}</span>
                        {role.systemRole ? (
                          <span className="text-xs text-muted-foreground">{role.systemRole}</span>
                        ) : null}
                      </span>
                      <Badge
                        className={ROLE_BADGE_VARIANTS[(role.systemRole as keyof typeof ROLE_BADGE_VARIANTS) ?? "member"]}
                        size="sm"
                      >
                        Vollzugriff
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Eigene Rollen</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={bulkLoading || roles.length === 0}
                    onClick={() => void handleBulkRoles(true)}
                  >
                    Allen gewähren
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={bulkLoading || roles.length === 0}
                    onClick={() => void handleBulkRoles(false)}
                  >
                    Allen entziehen
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                {roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine eigenen Rollen angelegt.</p>
                ) : null}
                {roles.map((role) =>
                  renderRoleRow(
                    role,
                    assignedRoleIds.has(role.id),
                    pendingRoleIds.has(role.id),
                  ),
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Gewerke</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={bulkLoading || departments.length === 0}
                    onClick={() => void handleBulkDepartments(true)}
                  >
                    Allen gewähren
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={bulkLoading || departments.length === 0}
                    onClick={() => void handleBulkDepartments(false)}
                  >
                    Allen entziehen
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                {departments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Gewerke vorhanden.</p>
                ) : null}
                {departments.map((department) =>
                  renderDepartmentRow(
                    department,
                    assignedDepartmentIds.has(department.id),
                    pendingDepartmentIds.has(department.id),
                  ),
                )}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default PermissionDetailDrawer;
