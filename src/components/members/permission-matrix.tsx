"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EditIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";

type Role = { id: string; name: string; isSystem: boolean; systemRole?: string | null };
type Permission = { id: string; key: string; label?: string | null; description?: string | null };

export function PermissionMatrix() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [grants, setGrants] = useState<Record<string, Set<string>>>({});
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/permissions/definitions");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Laden fehlgeschlagen");
      const fetchedRoles = Array.isArray(data.roles) ? (data.roles as Role[]) : [];
      setRoles(fetchedRoles.filter((role) => !role.isSystem));
      const fetchedPermissions = Array.isArray(data.permissions)
        ? (data.permissions as Permission[])
        : [];
      setPerms(fetchedPermissions);
      const m: Record<string, Set<string>> = {};
      for (const r of data.roles as Role[]) m[r.id] = new Set<string>();
      for (const roleId of Object.keys(data.grants || {})) m[roleId] = new Set<string>(data.grants[roleId]);
      setGrants(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const toggle = async (roleId: string, key: string, grant: boolean) => {
    const old = new Set(grants[roleId] || new Set());
    const optimistic = new Set(old);
    if (grant) optimistic.add(key); else optimistic.delete(key);
    setGrants({ ...grants, [roleId]: optimistic });
    const res = await fetch("/api/permissions/definitions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId, permissionKey: key, grant }),
    });
    if (!res.ok) {
      setGrants({ ...grants, [roleId]: old });
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
      const data = await res.json().catch(() => ({}));
      const updated = data?.role as Role | undefined;
      if (updated) {
        setRoles((prev) => prev.map((r) => (r.id === updated.id ? { ...r, name: updated.name } : r)));
      }
      closeEdit();
    } else {
      const payload = await res.json().catch(() => ({} as any));
      setEditError(payload?.error || "Aktualisierung fehlgeschlagen");
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
      setGrants((prev) => {
        const next = { ...prev } as Record<string, Set<string>>;
        delete next[rid];
        return next;
      });
      closeEdit();
    } else {
      const payload = await res.json().catch(() => ({} as any));
      setEditError(payload?.error || "Löschen fehlgeschlagen");
    }
    setDeleting(false);
  };

  if (loading) return <div>Laden…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="border px-2 py-1 rounded"
          placeholder="Neue Rolle"
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
        />
        <Button size="sm" onClick={addRole}>Rolle anlegen</Button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2 border-b">Recht</th>
              {roles.map((r) => (
                <th key={r.id} className="text-left p-2 border-b align-top">
                  <button
                    type="button"
                    title="Zum Bearbeiten klicken"
                    onClick={() => openEdit(r)}
                    className="group inline-flex max-w-[14rem] items-center gap-1 truncate text-left text-sm font-medium underline-offset-2 hover:underline"
                  >
                    <span className="truncate">{r.name}</span>
                    <EditIcon className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-80 text-foreground/60" aria-hidden />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perms.map((p) => (
              <tr key={p.key}>
                <td className="p-2 border-b align-top">
                  <div className="font-medium">{p.label ?? p.key}</div>
                  {p.label && p.label !== p.key ? (
                    <div className="text-xs text-muted-foreground">{p.key}</div>
                  ) : null}
                  {p.description ? (
                    <div className="text-xs text-muted-foreground">{p.description}</div>
                  ) : null}
                </td>
                {roles.map((r) => {
                  const granted = grants[r.id]?.has(p.key) ?? false;
                  return (
                    <td key={r.id} className="p-2 border-b">
                      <input
                        type="checkbox"
                        checked={granted}
                        onChange={(e) => toggle(r.id, p.key, e.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={editOpen}
        onClose={closeEdit}
        title="Rolle bearbeiten"
        description="Passe den Namen der Rolle an oder lösche sie."
      >
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Systemrollen können nicht bearbeitet oder gelöscht werden.
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={closeEdit} disabled={saving || deleting}>Abbrechen</Button>
              <Button onClick={saveEdit} disabled={saving || deleting}>{saving ? "Speichern…" : "Speichern"}</Button>
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              {!deleteConfirm ? (
                <Button variant="destructive" onClick={() => setDeleteConfirm(true)} disabled={saving || deleting}>Rolle löschen…</Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Sicher?</span>
                  <Button variant="destructive" onClick={deleteRole} disabled={deleting}>{deleting ? "Lösche…" : "Ja, endgültig löschen"}</Button>
                  <Button variant="ghost" onClick={() => setDeleteConfirm(false)} disabled={deleting}>Abbrechen</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
