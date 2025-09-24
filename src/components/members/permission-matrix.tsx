"use client";
import { useEffect, useMemo, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EditIcon } from "@/components/ui/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = {
  id: string;
  name: string;
  isSystem: boolean;
  systemRole?: string | null;
  sortIndex: number;
};
type Department = {
  id: string;
  name: string;
  slug: string | null;
  requiresJoinApproval: boolean;
};
type Permission = {
  id: string;
  key: string;
  label: string | null;
  description: string | null;
  categoryKey: string;
  categoryLabel: string;
};

export function PermissionMatrix() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [roleGrants, setRoleGrants] = useState<Record<string, Set<string>>>({});
  const [departmentGrants, setDepartmentGrants] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [draggingRoleId, setDraggingRoleId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    roleId: string;
    position: "before" | "after";
  } | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<"roles" | "departments">("roles");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/permissions/definitions");
      const rawBody = await res.text();
      let parsedBody: unknown = null;

      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          if (res.ok) {
            throw new Error("Server lieferte eine ungültige Antwort.");
          }
        }
      }

      if (!res.ok) {
        let errorMessage = rawBody || `Laden fehlgeschlagen (Status ${res.status})`;
        if (
          parsedBody &&
          typeof parsedBody === "object" &&
          "error" in parsedBody &&
          typeof (parsedBody as { error?: unknown }).error === "string"
        ) {
          errorMessage = (parsedBody as { error: string }).error;
        }
        throw new Error(errorMessage);
      }

      if (!parsedBody || typeof parsedBody !== "object") {
        throw new Error("Server lieferte eine ungültige Antwort.");
      }

      const data = parsedBody as Record<string, unknown>;
      const fetchedRoles = Array.isArray(data.roles)
        ? (data.roles as Role[]).map((role, index) => ({
            ...role,
            sortIndex: typeof role.sortIndex === "number" ? role.sortIndex : index,
          }))
        : [];
      const nonSystemRoles = fetchedRoles
        .filter((role) => !role.isSystem)
        .sort((a, b) => {
          if (a.sortIndex === b.sortIndex) {
            return a.name.localeCompare(b.name, "de");
          }
          return a.sortIndex - b.sortIndex;
        });
      setRoles(nonSystemRoles);
      setOrderError(null);
      const fetchedDepartments: Department[] = Array.isArray(data.departments)
        ? (data.departments as Array<Record<string, unknown>>)
            .map((entry) => {
              if (!entry || typeof entry !== "object") return null;
              const id = typeof entry.id === "string" ? entry.id : null;
              const name = typeof entry.name === "string" ? entry.name : null;
              if (!id || !name) return null;
              const slug = typeof entry.slug === "string" ? entry.slug : null;
              const requiresJoinApproval = Boolean(entry.requiresJoinApproval);
              return { id, name, slug, requiresJoinApproval } satisfies Department;
            })
            .filter((value): value is Department => Boolean(value))
        : [];
      setDepartments(fetchedDepartments);
      const fetchedPermissions: Permission[] = Array.isArray(data.permissions)
        ? (data.permissions as Array<Record<string, unknown>>)
            .map((entry) => {
              if (!entry || typeof entry !== "object") return null;
              const key = typeof entry.key === "string" ? entry.key : null;
              const categoryKey = typeof entry.categoryKey === "string" ? entry.categoryKey : null;
              if (!key || !categoryKey) return null;
              const id = typeof entry.id === "string" ? entry.id : key;
              const label = typeof entry.label === "string" ? entry.label : null;
              const description = typeof entry.description === "string" ? entry.description : null;
              const categoryLabel =
                typeof entry.categoryLabel === "string" ? entry.categoryLabel : categoryKey;
              return {
                id,
                key,
                label,
                description,
                categoryKey,
                categoryLabel,
              } as Permission;
            })
            .filter((value): value is Permission => Boolean(value))
        : [];
      setPerms(fetchedPermissions);
      const roleGrantMap: Record<string, Set<string>> = {};
      for (const role of fetchedRoles) {
        roleGrantMap[role.id] = new Set<string>();
      }
      if (data.grants && typeof data.grants === "object") {
        for (const [roleId, values] of Object.entries(data.grants as Record<string, unknown>)) {
          if (!roleGrantMap[roleId]) {
            roleGrantMap[roleId] = new Set<string>();
          }
          if (Array.isArray(values)) {
            for (const value of values) {
              if (typeof value === "string") {
                roleGrantMap[roleId].add(value);
              }
            }
          }
        }
      }
      setRoleGrants(roleGrantMap);

      const departmentGrantMap: Record<string, Set<string>> = {};
      for (const department of fetchedDepartments) {
        departmentGrantMap[department.id] = new Set<string>();
      }
      if (data.departmentGrants && typeof data.departmentGrants === "object") {
        for (const [departmentId, values] of Object.entries(
          data.departmentGrants as Record<string, unknown>,
        )) {
          if (!departmentGrantMap[departmentId]) {
            departmentGrantMap[departmentId] = new Set<string>();
          }
          if (Array.isArray(values)) {
            for (const value of values) {
              if (typeof value === "string") {
                departmentGrantMap[departmentId].add(value);
              }
            }
          }
        }
      }
      setDepartmentGrants(departmentGrantMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
      setDraggingRoleId(null);
      setDropIndicator(null);
      setOrderSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredPerms = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return perms;
    return perms.filter((perm) => {
      if (perm.label && perm.label.toLowerCase().includes(query)) return true;
      if (perm.key.toLowerCase().includes(query)) return true;
      if (perm.description && perm.description.toLowerCase().includes(query)) return true;
      if (perm.categoryLabel.toLowerCase().includes(query)) return true;
      if (perm.categoryKey.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [perms, searchTerm]);

  const reorderRolesList = (
    current: Role[],
    draggedId: string,
    targetId: string,
    placeAfter: boolean,
  ): Role[] | null => {
    if (draggedId === targetId) return null;
    const dragged = current.find((role) => role.id === draggedId);
    if (!dragged) return null;
    const withoutDragged = current.filter((role) => role.id !== draggedId);
    const targetIndex = withoutDragged.findIndex((role) => role.id === targetId);
    if (targetIndex === -1) return null;
    const insertIndex = placeAfter ? targetIndex + 1 : targetIndex;
    withoutDragged.splice(insertIndex, 0, dragged);
    const sameOrder = withoutDragged.every((role, index) => role.id === current[index]?.id);
    if (sameOrder) return null;
    return withoutDragged.map((role, index) => ({ ...role, sortIndex: index }));
  };

  const revertRoleOrder = (previousOrder: string[]) => {
    setRoles((current) => {
      const map = new Map(current.map((role) => [role.id, role]));
      const restored: Role[] = [];
      previousOrder.forEach((id, index) => {
        const match = map.get(id);
        if (match) {
          restored.push({ ...match, sortIndex: index });
          map.delete(id);
        }
      });
      if (map.size > 0) {
        const remaining = Array.from(map.values()).sort((a, b) => a.sortIndex - b.sortIndex);
        const baseIndex = restored.length;
        remaining.forEach((role, idx) => {
          restored.push({ ...role, sortIndex: baseIndex + idx });
        });
      }
      return restored;
    });
  };

  const persistRoleOrder = async (ordered: Role[], previousOrder: string[]) => {
    setOrderSaving(true);
    setOrderError(null);
    try {
      const res = await fetch("/api/permissions/roles/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: ordered.map((role) => role.id) }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        revertRoleOrder(previousOrder);
        setOrderError(payload?.error ?? "Reihenfolge konnte nicht gespeichert werden");
      }
    } catch {
      revertRoleOrder(previousOrder);
      setOrderError("Reihenfolge konnte nicht gespeichert werden");
    } finally {
      setOrderSaving(false);
    }
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, roleId: string) => {
    if (orderSaving) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", roleId);
    setDraggingRoleId(roleId);
    setDropIndicator(null);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, roleId: string) => {
    if (!draggingRoleId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (draggingRoleId === roleId) {
      setDropIndicator(null);
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position: "before" | "after" = event.clientX > rect.left + rect.width / 2 ? "after" : "before";
    setDropIndicator((current) => {
      if (current && current.roleId === roleId && current.position === position) {
        return current;
      }
      return { roleId, position };
    });
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>, roleId: string) => {
    if (!draggingRoleId) return;
    const related = event.relatedTarget as Node | null;
    if (related && (event.currentTarget as HTMLElement).contains(related)) return;
    setDropIndicator((current) => (current?.roleId === roleId ? null : current));
  };

  const handleDrop = (event: DragEvent<HTMLElement>, roleId: string) => {
    if (!draggingRoleId) return;
    event.preventDefault();
    event.stopPropagation();
    const draggedId = event.dataTransfer.getData("text/plain") || draggingRoleId;
    setDropIndicator(null);
    setDraggingRoleId(null);
    if (!draggedId || draggedId === roleId) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const placeAfter = event.clientX > rect.left + rect.width / 2;
    const previousOrder = roles.map((role) => role.id);
    const next = reorderRolesList(roles, draggedId, roleId, placeAfter);
    if (!next) return;
    setRoles(next);
    setOrderError(null);
    void persistRoleOrder(next, previousOrder);
  };

  const handleDragEnd = () => {
    setDraggingRoleId(null);
    setDropIndicator(null);
  };

  const toggleRole = async (roleId: string, key: string, grant: boolean) => {
    const old = new Set(roleGrants[roleId] || new Set());
    const optimistic = new Set(old);
    if (grant) optimistic.add(key);
    else optimistic.delete(key);
    setRoleGrants({ ...roleGrants, [roleId]: optimistic });
    const res = await fetch("/api/permissions/definitions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "role", targetId: roleId, permissionKey: key, grant }),
    });
    if (!res.ok) {
      setRoleGrants({ ...roleGrants, [roleId]: old });
    }
  };

  const toggleDepartment = async (departmentId: string, key: string, grant: boolean) => {
    const old = new Set(departmentGrants[departmentId] || new Set());
    const optimistic = new Set(old);
    if (grant) optimistic.add(key);
    else optimistic.delete(key);
    setDepartmentGrants({ ...departmentGrants, [departmentId]: optimistic });
    const res = await fetch("/api/permissions/definitions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "department",
        targetId: departmentId,
        permissionKey: key,
        grant,
      }),
    });
    if (!res.ok) {
      setDepartmentGrants({ ...departmentGrants, [departmentId]: old });
    }
  };

  const addRole = async () => {
    if (!newRoleName.trim()) return;
    const res = await fetch("/api/permissions/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoleName.trim() }),
    });
    if (res.ok) {
      setNewRoleName("");
      await load();
    }
  };

  const openEdit = (role: Role) => {
    setEditRoleId(role.id);
    setEditRoleName(role.name);
    setDeleteConfirm(false);
    setEditError(null);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditRoleId(null);
    setEditRoleName("");
    setDeleteConfirm(false);
    setEditError(null);
    setSaving(false);
    setDeleting(false);
  };

  const saveEdit = async () => {
    if (!editRoleId) return;
    const name = editRoleName.trim();
    if (!name) {
      setEditError("Name darf nicht leer sein");
      return;
    }
    setSaving(true);
    setEditError(null);
    const res = await fetch(`/api/permissions/roles/${editRoleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { role?: Role };
      const updated = data?.role;
      if (updated) {
        setRoles((prev) => prev.map((r) => (r.id === updated.id ? { ...r, name: updated.name } : r)));
      }
      closeEdit();
    } else {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setEditError(payload?.error ?? "Aktualisierung fehlgeschlagen");
    }
    setSaving(false);
  };

  const deleteRole = async () => {
    if (!editRoleId) return;
    setDeleting(true);
    setEditError(null);
    const res = await fetch(`/api/permissions/roles/${editRoleId}`, { method: "DELETE" });
    if (res.ok) {
      const rid = editRoleId;
      setRoles((prev) => prev.filter((r) => r.id !== rid));
      setRoleGrants((prev) => {
        const next = { ...prev } as Record<string, Set<string>>;
        delete next[rid];
        return next;
      });
      closeEdit();
    } else {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setEditError(payload?.error ?? "Löschen fehlgeschlagen");
    }
    setDeleting(false);
  };

  if (loading) return <div>Laden…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  const hasSearch = searchTerm.trim().length > 0;

  const renderRoleMatrix = () => {
    const totalColumns = roles.length + 1;
    const rows: ReactNode[] = [];
    let lastCategoryKey: string | null = null;
    let categorySequence = 0;
    let rowIndexWithinCategory = 0;

    for (const perm of filteredPerms) {
      if (perm.categoryKey !== lastCategoryKey) {
        lastCategoryKey = perm.categoryKey;
        rowIndexWithinCategory = 0;
        const categoryKey = `category-${perm.categoryKey}-${categorySequence}`;
        categorySequence += 1;
        rows.push(
          <tr key={categoryKey} className="bg-muted/50">
            <th
              scope="colgroup"
              colSpan={totalColumns}
              className="border-y border-border/70 px-3 py-3 text-left text-muted-foreground"
            >
              <div className="flex items-center gap-3">
                <span className="hidden h-px flex-1 bg-border/60 sm:block" aria-hidden />
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em]">
                  {perm.categoryLabel}
                </span>
                <span className="hidden h-px flex-1 bg-border/60 sm:block" aria-hidden />
              </div>
            </th>
          </tr>,
        );
      }

      const isEvenRow = rowIndexWithinCategory % 2 === 0;
      rowIndexWithinCategory += 1;

      rows.push(
        <tr key={perm.key} className={isEvenRow ? "bg-muted/30" : undefined}>
          <td className="sticky left-0 z-0 bg-inherit p-3 align-top shadow-[inset_-1px_0_0_0_var(--border)]">
            <div className="font-medium">{perm.label ?? perm.key}</div>
            {perm.label && perm.label !== perm.key ? (
              <div className="text-xs text-muted-foreground">{perm.key}</div>
            ) : null}
            {perm.description ? (
              <div className="text-xs text-muted-foreground">{perm.description}</div>
            ) : null}
          </td>
          {roles.map((r) => {
            const granted = roleGrants[r.id]?.has(perm.key) ?? false;
            return (
              <td
                key={r.id}
                data-role-id={r.id}
                className="p-3 align-middle"
                onDragOver={(event) => handleDragOver(event, r.id)}
                onDrop={(event) => handleDrop(event, r.id)}
                onDragLeave={(event) => handleDragLeave(event, r.id)}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={granted}
                  onClick={() => toggleRole(r.id, perm.key, !granted)}
                  className={`perm-toggle ${granted ? "on" : "off"}`}
                >
                  <span className="sr-only">{granted ? "Entziehen" : "Gewähren"}</span>
                  <span className="knob" />
                </button>
              </td>
            );
          })}
        </tr>,
      );
    }

    if (rows.length === 0) {
      rows.push(
        <tr key="empty">
          <td colSpan={totalColumns} className="p-6 text-center text-sm text-muted-foreground">
            {hasSearch ? "Keine Rechte passen zu deiner Suche." : "Keine Rechte vorhanden."}
          </td>
        </tr>,
      );
    }

    return (
      <div className="overflow-auto rounded-xl border bg-card/40 shadow-sm">
        <table className="min-w-full text-sm" aria-busy={orderSaving}>
          <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <tr>
              <th className="sticky left-0 z-10 bg-background/80 p-3 text-left font-medium">Recht</th>
              {roles.map((r) => (
                <th
                  key={r.id}
                  data-role-id={r.id}
                  className={cn(
                    "relative p-3 text-left align-top",
                    dropIndicator?.roleId === r.id && dropIndicator.position === "before" &&
                      "before:absolute before:-left-1 before:top-1 before:bottom-1 before:w-1 before:rounded-full before:bg-primary before:content-['']",
                    dropIndicator?.roleId === r.id && dropIndicator.position === "after" &&
                      "after:absolute after:-right-1 after:top-1 after:bottom-1 after:w-1 after:rounded-full after:bg-primary after:content-['']",
                  )}
                  onDragOver={(event) => handleDragOver(event, r.id)}
                  onDrop={(event) => handleDrop(event, r.id)}
                  onDragLeave={(event) => handleDragLeave(event, r.id)}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      aria-label="Rolle verschieben"
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        orderSaving
                          ? "cursor-not-allowed opacity-50"
                          : draggingRoleId === r.id
                            ? "cursor-grabbing"
                            : "cursor-grab",
                      )}
                      draggable={!orderSaving}
                      aria-disabled={orderSaving}
                      tabIndex={orderSaving ? -1 : 0}
                      onDragStart={(event) => handleDragStart(event, r.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <GripVertical className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Rolle bearbeiten"
                      onClick={() => openEdit(r)}
                      className="group inline-flex max-w-[14rem] items-center gap-1 truncate text-left text-sm font-medium underline-offset-2 hover:underline"
                    >
                      <span className="truncate">{r.name}</span>
                      <EditIcon className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-80 text-foreground/60" aria-hidden />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  };

  const renderDepartmentMatrix = () => {
    if (!departments.length) {
      return (
        <div className="rounded-xl border bg-card/40 p-6 text-sm text-muted-foreground">
          Lege zuerst Gewerke an, um Rechte zuzuweisen.
        </div>
      );
    }

    const totalColumns = departments.length + 1;
    const rows: ReactNode[] = [];
    let lastCategoryKey: string | null = null;
    let categorySequence = 0;
    let rowIndexWithinCategory = 0;

    for (const perm of filteredPerms) {
      if (perm.categoryKey !== lastCategoryKey) {
        lastCategoryKey = perm.categoryKey;
        rowIndexWithinCategory = 0;
        const categoryKey = `department-category-${perm.categoryKey}-${categorySequence}`;
        categorySequence += 1;
        rows.push(
          <tr key={categoryKey} className="bg-muted/50">
            <th
              scope="colgroup"
              colSpan={totalColumns}
              className="border-y border-border/70 px-3 py-3 text-left text-muted-foreground"
            >
              <div className="flex items-center gap-3">
                <span className="hidden h-px flex-1 bg-border/60 sm:block" aria-hidden />
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em]">
                  {perm.categoryLabel}
                </span>
                <span className="hidden h-px flex-1 bg-border/60 sm:block" aria-hidden />
              </div>
            </th>
          </tr>,
        );
      }

      const isEvenRow = rowIndexWithinCategory % 2 === 0;
      rowIndexWithinCategory += 1;

      rows.push(
        <tr key={`department-${perm.key}`} className={isEvenRow ? "bg-muted/30" : undefined}>
          <td className="sticky left-0 z-0 bg-inherit p-3 align-top shadow-[inset_-1px_0_0_0_var(--border)]">
            <div className="font-medium">{perm.label ?? perm.key}</div>
            {perm.label && perm.label !== perm.key ? (
              <div className="text-xs text-muted-foreground">{perm.key}</div>
            ) : null}
            {perm.description ? (
              <div className="text-xs text-muted-foreground">{perm.description}</div>
            ) : null}
          </td>
          {departments.map((department) => {
            const granted = departmentGrants[department.id]?.has(perm.key) ?? false;
            return (
              <td key={department.id} className="p-3 align-middle">
                <button
                  type="button"
                  role="switch"
                  aria-checked={granted}
                  onClick={() => toggleDepartment(department.id, perm.key, !granted)}
                  className={`perm-toggle ${granted ? "on" : "off"}`}
                >
                  <span className="sr-only">{granted ? "Entziehen" : "Gewähren"}</span>
                  <span className="knob" />
                </button>
              </td>
            );
          })}
        </tr>,
      );
    }

    if (rows.length === 0) {
      rows.push(
        <tr key="empty">
          <td colSpan={totalColumns} className="p-6 text-center text-sm text-muted-foreground">
            {hasSearch ? "Keine Rechte passen zu deiner Suche." : "Keine Rechte vorhanden."}
          </td>
        </tr>,
      );
    }

    return (
      <div className="overflow-auto rounded-xl border bg-card/40 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <tr>
              <th className="sticky left-0 z-10 bg-background/80 p-3 text-left font-medium">Recht</th>
              {departments.map((department) => (
                <th key={department.id} className="p-3 text-left align-top">
                  <div className="space-y-1">
                    <span className="text-sm font-medium leading-tight text-foreground">
                      {department.name}
                    </span>
                    {department.slug ? (
                      <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                        {department.slug}
                      </span>
                    ) : null}
                    {department.requiresJoinApproval ? (
                      <span className="inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                        Zustimmung nötig
                      </span>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  };

  const headerTitle =
    activeView === "roles" ? "Rollen & Rechte" : "Gewerke & Rechte";
  const headerDescription =
    activeView === "roles"
      ? "Weise vorhandene Website‑Rechte deinen eigenen Rollen zu."
      : "Aktiviere Rechte für Teams, damit Mitglieder ihrer Gewerke Zugriff erhalten.";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">{headerTitle}</h3>
              <p className="text-sm text-muted-foreground">{headerDescription}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1">
                <button
                  type="button"
                  onClick={() => setActiveView("roles")}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    activeView === "roles"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Rollen
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("departments")}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    activeView === "departments"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Gewerke
                </button>
              </div>
              {activeView === "roles" ? (
                <div className="flex gap-2">
                  <input
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Neue Rolle (z. B. PR-Team)"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                  <Button size="sm" onClick={addRole}>
                    Rolle anlegen
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex w-full justify-end">
            <div className="w-full sm:w-72">
              <Input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Rechte durchsuchen…"
                aria-label="Rechte durchsuchen"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>

      {activeView === "roles" ? renderRoleMatrix() : renderDepartmentMatrix()}

      {activeView === "roles" && orderError ? (
        <p className="text-sm text-destructive">{orderError}</p>
      ) : null}
      {activeView === "roles" && orderSaving ? (
        <p className="text-xs text-muted-foreground">Reihenfolge wird gespeichert…</p>
      ) : null}
      <Dialog
        open={editOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeEdit();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rolle bearbeiten</DialogTitle>
            <DialogDescription>Passe den Namen der Rolle an oder lösche sie.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input
                value={editRoleName}
                onChange={(e) => setEditRoleName(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                placeholder="z. B. PR-Team"
              />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter className="mt-4 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Systemrollen können nicht bearbeitet oder gelöscht werden.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={closeEdit} disabled={saving || deleting}>
                Abbrechen
              </Button>
              <Button onClick={saveEdit} disabled={saving || deleting}>
                {saving ? "Speichern…" : "Speichern"}
              </Button>
            </div>
          </DialogFooter>
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              {!deleteConfirm ? (
                <Button variant="destructive" onClick={() => setDeleteConfirm(true)} disabled={saving || deleting}>
                  Rolle löschen…
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Sicher?</span>
                  <Button variant="destructive" onClick={deleteRole} disabled={deleting}>
                    {deleting ? "Lösche…" : "Ja, endgültig löschen"}
                  </Button>
                  <Button variant="ghost" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                    Abbrechen
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <style jsx global>{`
        .perm-toggle { position: relative; width: 40px; height: 22px; border-radius: 999px; border: 1px solid var(--border); background: color-mix(in oklab, var(--muted), transparent 20%); transition: background .2s ease, border-color .2s ease, box-shadow .2s ease; }
        .perm-toggle .knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--background); box-shadow: 0 1px 2px rgba(0,0,0,.15); transition: transform .2s ease; }
        .perm-toggle.on { background: color-mix(in oklab, var(--primary), transparent 65%); border-color: color-mix(in oklab, var(--primary), var(--border) 65%); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--primary), transparent 75%); }
        .perm-toggle.on .knob { transform: translateX(18px); }
        .perm-toggle:hover { box-shadow: 0 0 0 4px color-mix(in oklab, var(--ring), transparent 85%); }
        .dark .perm-toggle { background: color-mix(in oklab, var(--muted), transparent 40%); }
        .dark .perm-toggle.on { background: color-mix(in oklab, var(--primary), transparent 70%); }
      `}</style>
    </div>
  );
}
