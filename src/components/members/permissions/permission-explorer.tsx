"use client";

import { Fragment, type Dispatch, type SetStateAction, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  DepartmentGrantState,
  PermissionWorkbenchDepartment,
  PermissionWorkbenchPermission,
  PermissionWorkbenchRole,
  RoleGrantState,
} from "@/components/members/permissions/permission-workbench-client";
import { ROLE_LABELS } from "@/lib/roles";

type PermissionExplorerProps = {
  permissions: PermissionWorkbenchPermission[];
  systemRoles: PermissionWorkbenchRole[];
  roles: PermissionWorkbenchRole[];
  departments: PermissionWorkbenchDepartment[];
  roleGrants: RoleGrantState;
  departmentGrants: DepartmentGrantState;
  setRoleGrants: Dispatch<SetStateAction<RoleGrantState>>;
  setDepartmentGrants: Dispatch<SetStateAction<DepartmentGrantState>>;
};

type MatrixTarget = "role" | "department";

type GroupedPermission = {
  categoryKey: string;
  label: string;
  permissions: PermissionWorkbenchPermission[];
};

type MutableGrantState = Record<string, Set<string>>;

const makeCellKey = (targetType: MatrixTarget, targetId: string, permissionKey: string) =>
  `${targetType}:${targetId}:${permissionKey}`;

export function PermissionExplorer({
  permissions,
  systemRoles,
  roles,
  departments,
  roleGrants,
  departmentGrants,
  setRoleGrants,
  setDepartmentGrants,
}: PermissionExplorerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());

  const categoryOptions = useMemo(() => {
    const entries = new Map<string, string>();
    for (const permission of permissions) {
      if (!entries.has(permission.categoryKey)) {
        entries.set(permission.categoryKey, permission.categoryLabel);
      }
    }
    return Array.from(entries.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return permissions.filter((permission) => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(permission.categoryKey)) {
        return false;
      }
      if (!term) return true;
      const haystacks = [
        permission.key,
        permission.label,
        permission.description ?? "",
        permission.categoryLabel,
      ].map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(term));
    });
  }, [permissions, searchTerm, selectedCategories]);

  const groupedPermissions = useMemo<GroupedPermission[]>(() => {
    const groups = new Map<string, GroupedPermission>();
    for (const permission of filteredPermissions) {
      if (!groups.has(permission.categoryKey)) {
        groups.set(permission.categoryKey, {
          categoryKey: permission.categoryKey,
          label: permission.categoryLabel,
          permissions: [],
        });
      }
      groups.get(permission.categoryKey)!.permissions.push(permission);
    }
    return Array.from(groups.values());
  }, [filteredPermissions]);

  const roleAssignmentStats = useMemo(() => {
    const totals = Object.values(roleGrants).reduce(
      (accumulator, grants) => {
        const size = grants.size;
        return {
          assignments: accumulator.assignments + size,
          populatedTargets: accumulator.populatedTargets + (size > 0 ? 1 : 0),
        };
      },
      { assignments: 0, populatedTargets: 0 },
    );
    const potential = permissions.length * roles.length;
    const coverage = potential > 0 ? totals.assignments / potential : 0;
    const average = roles.length > 0 ? totals.assignments / roles.length : 0;
    return { ...totals, coverage, average };
  }, [permissions.length, roleGrants, roles.length]);

  const departmentAssignmentStats = useMemo(() => {
    const totals = Object.values(departmentGrants).reduce(
      (accumulator, grants) => {
        const size = grants.size;
        return {
          assignments: accumulator.assignments + size,
          populatedTargets: accumulator.populatedTargets + (size > 0 ? 1 : 0),
        };
      },
      { assignments: 0, populatedTargets: 0 },
    );
    const potential = permissions.length * departments.length;
    const coverage = potential > 0 ? totals.assignments / potential : 0;
    const average = departments.length > 0 ? totals.assignments / departments.length : 0;
    return { ...totals, coverage, average };
  }, [departmentGrants, departments.length, permissions.length]);

  const hasActiveFilter = selectedCategories.length > 0 || searchTerm.trim().length > 0;

  const toggleCategory = (categoryKey: string) => {
    setSelectedCategories((current) =>
      current.includes(categoryKey)
        ? current.filter((value) => value !== categoryKey)
        : [...current, categoryKey],
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategories([]);
  };

  const formatPercent = (value: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const updatePendingCells = (cellKey: string, pending: boolean) => {
    setPendingCells((current) => {
      const next = new Set(current);
      if (pending) next.add(cellKey);
      else next.delete(cellKey);
      return next;
    });
  };

  const mutateGrant = async (
    targetType: MatrixTarget,
    targetId: string,
    permissionKey: string,
    grant: boolean,
  ) => {
    const state: MutableGrantState = (targetType === "role" ? roleGrants : departmentGrants) as MutableGrantState;
    const setState: Dispatch<SetStateAction<MutableGrantState>> =
      targetType === "role"
        ? (setRoleGrants as Dispatch<SetStateAction<MutableGrantState>>)
        : (setDepartmentGrants as Dispatch<SetStateAction<MutableGrantState>>);

    const previous = new Set(state[targetId] ?? []);
    const cellKey = makeCellKey(targetType, targetId, permissionKey);

    setState((current) => {
      const next: MutableGrantState = { ...current };
      const updated = new Set(current[targetId] ?? []);
      if (grant) {
        updated.add(permissionKey);
      } else {
        updated.delete(permissionKey);
      }
      next[targetId] = updated;
      return next;
    });

    updatePendingCells(cellKey, true);

    try {
      const response = await fetch("/api/permissions/definitions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, permissionKey, grant }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Speichern fehlgeschlagen");
      }
    } catch (error) {
      setState((current) => {
        const next: MutableGrantState = { ...current };
        next[targetId] = previous;
        return next;
      });
      toast.error("Änderung konnte nicht gespeichert werden", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      updatePendingCells(cellKey, false);
    }
  };

  const renderMatrix = (
    targetType: MatrixTarget,
    title: string,
    description: string,
    emptyMessage: string,
  ) => {
    const columns = targetType === "role" ? roles : departments;

    return (
      <section key={targetType} className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {columns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : groupedPermissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            Keine Rechte passen zu deiner Suche.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/70 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted/40">
                    <th
                      scope="col"
                      className="sticky left-0 z-20 min-w-[260px] bg-muted/40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Recht
                    </th>
                    {columns.map((column) => (
                      <th
                        key={column.id}
                        scope="col"
                        className="min-w-[150px] border-l border-border/60 px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        {targetType === "role" ? (
                          <div className="flex flex-col items-center gap-1 text-center">
                            <span className="font-medium">{(column as PermissionWorkbenchRole).name}</span>
                            {(column as PermissionWorkbenchRole).systemRole ? (
                              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                {(column as PermissionWorkbenchRole).systemRole}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-center">
                            <span className="font-medium">{(column as PermissionWorkbenchDepartment).name}</span>
                            {(column as PermissionWorkbenchDepartment).slug ? (
                              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                                {(column as PermissionWorkbenchDepartment).slug}
                              </span>
                            ) : null}
                            {(column as PermissionWorkbenchDepartment).requiresJoinApproval ? (
                              <Badge variant="warning" size="sm">
                                Zustimmung nötig
                              </Badge>
                            ) : null}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedPermissions.map((group) => (
                    <Fragment key={`${targetType}-${group.categoryKey}`}>
                      <tr>
                        <th
                          scope="colgroup"
                          colSpan={columns.length + 1}
                          className="bg-muted/60 px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                        >
                          {group.label}
                        </th>
                      </tr>
                      {group.permissions.map((permission) => (
                        <tr key={`${targetType}-${permission.key}`} className="bg-background">
                          <th
                            scope="row"
                            className="sticky left-0 z-10 bg-background px-4 py-3 text-left align-top text-sm"
                          >
                            <div className="space-y-1">
                              <span className="font-medium">{permission.label}</span>
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <span className="font-mono uppercase tracking-[0.2em] text-muted-foreground/80">
                                  {permission.key}
                                </span>
                                {permission.description ? (
                                  <p className="leading-relaxed text-foreground/80">{permission.description}</p>
                                ) : null}
                              </div>
                            </div>
                          </th>
                          {columns.map((column) => {
                            if (targetType === "role") {
                              const role = column as PermissionWorkbenchRole;
                              const granted = roleGrants[role.id]?.has(permission.key) ?? false;
                              const pending = pendingCells.has(makeCellKey("role", role.id, permission.key));
                              return (
                                <td
                                  key={role.id}
                                  className="border-l border-border/60 px-3 py-2 text-center align-middle"
                                >
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={granted ? "default" : "outline"}
                                    className={cn(
                                      "h-9 w-full whitespace-normal text-xs",
                                      pending && "opacity-60",
                                    )}
                                    aria-pressed={granted}
                                    aria-label={`${permission.label} für ${role.name} ${
                                      granted ? "deaktivieren" : "aktivieren"
                                    }`}
                                    title={granted ? "Recht entziehen" : "Recht gewähren"}
                                    disabled={pending}
                                    onClick={() => void mutateGrant("role", role.id, permission.key, !granted)}
                                  >
                                    {granted ? "Aktiv" : "Inaktiv"}
                                  </Button>
                                </td>
                              );
                            }
                            const department = column as PermissionWorkbenchDepartment;
                            const granted = departmentGrants[department.id]?.has(permission.key) ?? false;
                            const pending = pendingCells.has(
                              makeCellKey("department", department.id, permission.key),
                            );
                            return (
                              <td
                                key={department.id}
                                className="border-l border-border/60 px-3 py-2 text-center align-middle"
                              >
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={granted ? "secondary" : "outline"}
                                  className={cn(
                                    "h-9 w-full whitespace-normal text-xs",
                                    pending && "opacity-60",
                                  )}
                                  aria-pressed={granted}
                                  aria-label={`${permission.label} für ${department.name} ${
                                    granted ? "deaktivieren" : "aktivieren"
                                  }`}
                                  title={granted ? "Recht entziehen" : "Recht gewähren"}
                                  disabled={pending}
                                  onClick={() =>
                                    void mutateGrant("department", department.id, permission.key, !granted)
                                  }
                                >
                                  {granted ? "Aktiv" : "Inaktiv"}
                                </Button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">Rechte-Matrix</h2>
        <p className="text-sm text-muted-foreground">
          Schalte Rechte per Klick frei oder entziehe sie wieder. Die Matrix funktioniert auf allen Bildschirmgrößen
          dank horizontal scrollbarer Tabellen.
        </p>
      </header>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Systemrollen</h3>
          <p className="text-sm text-muted-foreground">
            Owner und Admin besitzen automatisch Vollzugriff und erscheinen deshalb nicht in der Matrix.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {systemRoles.length === 0 ? (
            <Badge variant="muted" size="sm">Keine Systemrollen registriert.</Badge>
          ) : (
            systemRoles.map((role) => {
              const label = role.systemRole
                ? ROLE_LABELS[role.systemRole as keyof typeof ROLE_LABELS] ?? role.name
                : role.name;
              return (
                <Badge key={role.id} variant="muted" size="sm" className="font-medium">
                  {label}
                </Badge>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Überblick</h3>
          <p className="text-sm text-muted-foreground">
            Nutze die Kennzahlen, um schnell zu sehen, wie stark Rollen und Gewerke bereits mit Rechten belegt sind.
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Rechte sichtbar</dt>
            <dd className="text-xl font-semibold">
              {filteredPermissions.length.toLocaleString("de-DE")}
            </dd>
            <dd className="text-xs text-muted-foreground">
              von insgesamt {permissions.length.toLocaleString("de-DE")} Definitionen
            </dd>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Rollenzuweisungen</dt>
            <dd className="text-xl font-semibold">
              {roleAssignmentStats.assignments.toLocaleString("de-DE")}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {roleAssignmentStats.populatedTargets.toLocaleString("de-DE")} von {roles.length.toLocaleString("de-DE")} Rollen aktiv · {formatPercent(roleAssignmentStats.coverage)} Abdeckung
            </dd>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Gewerkezuteilungen</dt>
            <dd className="text-xl font-semibold">
              {departmentAssignmentStats.assignments.toLocaleString("de-DE")}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {departmentAssignmentStats.populatedTargets.toLocaleString("de-DE")} von {departments.length.toLocaleString("de-DE")} Gewerken aktiv · {formatPercent(departmentAssignmentStats.coverage)} Abdeckung
            </dd>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Durchschnitt pro Ziel</dt>
            <dd className="text-xl font-semibold">
              {roleAssignmentStats.average.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
            </dd>
            <dd className="text-xs text-muted-foreground">
              Rechte pro Rolle · {departmentAssignmentStats.average.toLocaleString("de-DE", { maximumFractionDigits: 1 })} pro Gewerk
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Filter</span>
            <p className="text-sm text-muted-foreground">
              Suche nach Rechtstitel, Schlüssel oder Beschreibung oder schränke die Anzeige nach Kategorien ein.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:w-auto md:flex-row md:items-center">
            <Input
              placeholder="Rechte durchsuchen…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Rechte durchsuchen"
              className="md:w-72"
            />
            {hasActiveFilter ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Filter zurücksetzen
              </Button>
            ) : null}
          </div>
        </div>
        {categoryOptions.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((category) => {
              const active = selectedCategories.includes(category.key);
              return (
                <Button
                  key={category.key}
                  type="button"
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleCategory(category.key)}
                  aria-pressed={active}
                >
                  {category.label}
                </Button>
              );
            })}
          </div>
        ) : null}
      </section>

      {renderMatrix(
        "role",
        "Rollen-Matrix",
        "Aktiviere die benötigten Rechte für jede Rolle mit einem Klick.",
        "Noch keine eigenen Rollen angelegt.",
      )}

      {renderMatrix(
        "department",
        "Gewerke-Matrix",
        "Lege fest, welche Gewerke Zugriff auf einzelne Rechte erhalten.",
        "Keine Gewerke vorhanden.",
      )}
    </div>
  );
}

export default PermissionExplorer;
