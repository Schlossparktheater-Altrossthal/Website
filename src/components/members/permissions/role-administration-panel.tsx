"use client";

import { type Dispatch, type DragEvent, type SetStateAction, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Edit3, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  PermissionWorkbenchRole,
  RoleGrantState,
} from "@/components/members/permissions/permission-workbench-client";

const ROLE_ROW_CLASS =
  "flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2 shadow-sm transition hover:border-primary/40 hover:bg-primary/5";

function cloneRole(role: PermissionWorkbenchRole): PermissionWorkbenchRole {
  return { ...role };
}

type RoleAdministrationPanelProps = {
  roles: PermissionWorkbenchRole[];
  setRoles: Dispatch<SetStateAction<PermissionWorkbenchRole[]>>;
  roleGrants: RoleGrantState;
  setRoleGrants: Dispatch<SetStateAction<RoleGrantState>>;
};

type DropIndicator = {
  roleId: string;
  position: "before" | "after";
};

export function RoleAdministrationPanel({ roles, setRoles, roleGrants, setRoleGrants }: RoleAdministrationPanelProps) {
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);
  const [draggingRoleId, setDraggingRoleId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editRole, setEditRole] = useState<PermissionWorkbenchRole | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkClearing, setBulkClearing] = useState(false);

  const stats = useMemo(() => {
    const counts = roles.map((role) => roleGrants[role.id]?.size ?? 0);
    const totalAssignments = counts.reduce((sum, value) => sum + value, 0);
    const withAssignments = counts.filter((value) => value > 0).length;
    const avgAssignments = roles.length > 0 ? totalAssignments / roles.length : 0;
    const maxAssignments = counts.length ? Math.max(...counts) : 0;
    return { totalAssignments, withAssignments, avgAssignments, maxAssignments };
  }, [roles, roleGrants]);

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter((role) => role.name.toLowerCase().includes(term));
  }, [roles, search]);

  const reorderRoles = (
    current: PermissionWorkbenchRole[],
    draggedId: string,
    targetId: string,
    placeAfter: boolean,
  ): PermissionWorkbenchRole[] | null => {
    if (draggedId === targetId) return null;
    const dragged = current.find((role) => role.id === draggedId);
    if (!dragged) return null;
    const withoutDragged = current.filter((role) => role.id !== draggedId);
    const targetIndex = withoutDragged.findIndex((role) => role.id === targetId);
    if (targetIndex === -1) return null;
    const insertIndex = placeAfter ? targetIndex + 1 : targetIndex;
    withoutDragged.splice(insertIndex, 0, dragged);
    return withoutDragged.map((role, index) => ({ ...role, sortIndex: index }));
  };

  const persistOrder = async (ordered: PermissionWorkbenchRole[], previousOrder: string[]) => {
    setOrderSaving(true);
    setOrderError(null);
    try {
      const response = await fetch("/api/permissions/roles/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: ordered.map((role) => role.id) }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setRoles((current) => {
          const map = new Map(current.map((role) => [role.id, role]));
          const restored: PermissionWorkbenchRole[] = [];
          for (const roleId of previousOrder) {
            const match = map.get(roleId);
            if (match) restored.push(cloneRole(match));
          }
          return restored;
        });
        setOrderError(payload?.error ?? "Reihenfolge konnte nicht gespeichert werden.");
      }
    } catch (error) {
      setRoles((current) => {
        const map = new Map(current.map((role) => [role.id, role]));
        const restored: PermissionWorkbenchRole[] = [];
        for (const roleId of previousOrder) {
          const match = map.get(roleId);
          if (match) restored.push(cloneRole(match));
        }
        return restored;
      });
      setOrderError(error instanceof Error ? error.message : "Reihenfolge konnte nicht gespeichert werden.");
    } finally {
      setOrderSaving(false);
      setDraggingRoleId(null);
      setDropIndicator(null);
    }
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, roleId: string) => {
    if (orderSaving) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", roleId);
    setDraggingRoleId(roleId);
    setDropIndicator(null);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>, roleId: string) => {
    if (!draggingRoleId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (draggingRoleId === roleId) {
      setDropIndicator(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const position: DropIndicator["position"] = event.clientY > rect.top + rect.height / 2 ? "after" : "before";
    setDropIndicator((current) => {
      if (current && current.roleId === roleId && current.position === position) return current;
      return { roleId, position };
    });
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>, roleId: string) => {
    if (!draggingRoleId) return;
    event.preventDefault();
    const draggedId = event.dataTransfer.getData("text/plain") || draggingRoleId;
    if (!draggedId || draggedId === roleId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const placeAfter = event.clientY > rect.top + rect.height / 2;
    const previousOrder = roles.map((role) => role.id);
    const next = reorderRoles(roles, draggedId, roleId, placeAfter);
    if (!next) return;
    setRoles(next.map(cloneRole));
    void persistOrder(next, previousOrder);
  };

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>, roleId: string) => {
    if (!draggingRoleId) return;
    const related = event.relatedTarget as Node | null;
    if (related && event.currentTarget.contains(related)) return;
    setDropIndicator((current) => (current?.roleId === roleId ? null : current));
  };

  const handleDragEnd = () => {
    setDraggingRoleId(null);
    setDropIndicator(null);
  };

  const handleCreateRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const response = await fetch("/api/permissions/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Rolle konnte nicht erstellt werden.");
      }
      const payload = (await response.json()) as { role: PermissionWorkbenchRole };
      const created = payload.role;
      setRoles((current) => [...current, created]);
      setRoleGrants((current) => ({ ...current, [created.id]: new Set() }));
      setNewRoleName("");
      toast.success(`Rolle „${created.name}“ angelegt.`);
    } catch (error) {
      toast.error("Rolle konnte nicht angelegt werden", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (role: PermissionWorkbenchRole) => {
    setEditRole(role);
    setEditName(role.name);
    setEditError(null);
    setEditOpen(true);
  };

  const closeEditDialog = () => {
    setEditOpen(false);
    setEditRole(null);
    setEditName("");
    setEditError(null);
    setSavingEdit(false);
    setDeleting(false);
  };

  const handleSaveEdit = async () => {
    if (!editRole) return;
    const name = editName.trim();
    if (!name) {
      setEditError("Name darf nicht leer sein.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const response = await fetch(`/api/permissions/roles/${editRole.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Aktualisierung fehlgeschlagen.");
      }
      const payload = (await response.json()) as { role: PermissionWorkbenchRole };
      const updated = payload.role;
      setRoles((current) => current.map((role) => (role.id === updated.id ? updated : role)));
      toast.success("Rolle aktualisiert.");
      closeEditDialog();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!editRole) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/permissions/roles/${editRole.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Löschen fehlgeschlagen.");
      }
      setRoles((current) => current.filter((role) => role.id !== editRole.id));
      setRoleGrants((current) => {
        const next = { ...current } as RoleGrantState;
        delete next[editRole.id];
        return next;
      });
      toast.success("Rolle gelöscht.");
      closeEditDialog();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkClearAssignments = async () => {
    if (filteredRoles.length === 0) return;
    setBulkClearing(true);
    try {
      for (const role of filteredRoles) {
        const grants = Array.from(roleGrants[role.id] ?? []);
        for (const permissionKey of grants) {
          const response = await fetch("/api/permissions/definitions", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetType: "role",
              targetId: role.id,
              permissionKey,
              grant: false,
            }),
          });
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error ?? "Bulk-Aktion fehlgeschlagen.");
          }
        }
      }
      setRoleGrants((current) => {
        const next: RoleGrantState = { ...current };
        for (const role of filteredRoles) {
          next[role.id] = new Set();
        }
        return next;
      });
      toast.success("Zuweisungen der gefilterten Rollen entfernt.");
    } catch (error) {
      toast.error("Bulk-Aktion fehlgeschlagen", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBulkClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">Rollen insgesamt</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{roles.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">Mit Rechten</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.withAssignments}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">Ø Rechte / Rolle</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.avgAssignments.toFixed(1)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground">Max. Rechte</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{stats.maxAssignments}</CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Rolle anlegen
            </label>
            <Input
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
              placeholder="Neue Rolle (z. B. PR-Team)"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateRole();
                }
              }}
            />
          </div>
          <Button
            type="button"
            onClick={() => void handleCreateRole()}
            disabled={creating}
            className="md:w-auto"
          >
            {creating ? "Legt an…" : "Rolle erstellen"}
          </Button>
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Rollen filtern
          </label>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rollen durchsuchen…"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {filteredRoles.length} von {roles.length} Rollen angezeigt
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={filteredRoles.length === 0 || bulkClearing}
          onClick={() => void handleBulkClearAssignments()}
        >
          {bulkClearing ? "Entferne Zuweisungen…" : "Zuweisungen entfernen"}
        </Button>
      </div>

      <div className="space-y-3">
        {filteredRoles.map((role) => {
          const assignmentCount = roleGrants[role.id]?.size ?? 0;
          const isDragging = draggingRoleId === role.id;
          const indicator = dropIndicator && dropIndicator.roleId === role.id ? dropIndicator.position : null;
          return (
            <div key={role.id} className="relative">
              {indicator === "before" ? <Separator className="absolute -top-1 h-0.5 w-full bg-primary" /> : null}
              <button
                type="button"
                draggable
                onDragStart={(event) => handleDragStart(event, role.id)}
                onDragOver={(event) => handleDragOver(event, role.id)}
                onDragLeave={(event) => handleDragLeave(event, role.id)}
                onDrop={(event) => handleDrop(event, role.id)}
                onDragEnd={handleDragEnd}
                className={cn(ROLE_ROW_CLASS, isDragging && "opacity-70")}
                aria-label={`Rolle ${role.name} bearbeiten`}
                onClick={() => openEditDialog(role)}
              >
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-semibold text-foreground">{role.name}</span>
                    <span className="text-xs text-muted-foreground">{assignmentCount} Rechte</span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={assignmentCount > 0 ? "default" : "muted"} size="sm">
                    {assignmentCount > 0 ? "aktiv" : "leer"}
                  </Badge>
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                </span>
              </button>
              {indicator === "after" ? <Separator className="absolute -bottom-1 h-0.5 w-full bg-primary" /> : null}
            </div>
          );
        })}
        {filteredRoles.length === 0 ? (
          <Card className="border-dashed bg-muted/40 text-center text-sm text-muted-foreground">
            <CardContent className="py-6">Keine Rollen gefunden.</CardContent>
          </Card>
        ) : null}
      </div>

      {orderError ? <p className="text-sm text-destructive">{orderError}</p> : null}
      {orderSaving ? <p className="text-xs text-muted-foreground">Reihenfolge wird gespeichert…</p> : null}

      <Dialog open={editOpen} onOpenChange={(open) => (!open ? closeEditDialog() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rolle bearbeiten</DialogTitle>
            <DialogDescription>Aktualisiere den Namen oder lösche die Rolle vollständig.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="role-name">
                Rollenname
              </label>
              <Input
                id="role-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="z. B. PR-Team"
              />
            </div>
            {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
          </div>
          <DialogFooter className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Trash2 className="h-4 w-4" />
              <span>Das Löschen entfernt auch alle zugewiesenen Rechte.</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={closeEditDialog} disabled={savingEdit || deleting}>
                Abbrechen
              </Button>
              <Button onClick={() => void handleSaveEdit()} disabled={savingEdit || deleting}>
                {savingEdit ? "Speichert…" : "Speichern"}
              </Button>
            </div>
          </DialogFooter>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteRole()}
              disabled={deleting || savingEdit}
            >
              {deleting ? "Lösche…" : "Rolle löschen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RoleAdministrationPanel;
