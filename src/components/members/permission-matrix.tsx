"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Role = { id: string; name: string; isSystem: boolean; systemRole?: string | null };
type Permission = { id: string; key: string; label?: string | null };

export function PermissionMatrix() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [grants, setGrants] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newPermKey, setNewPermKey] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/permissions/definitions");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Laden fehlgeschlagen");
      setRoles(data.roles);
      setPerms(data.permissions);
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

  const addPerm = async () => {
    if (!newPermKey.trim()) return;
    const res = await fetch("/api/permissions/definitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newPermKey.trim() }),
    });
    if (res.ok) {
      setNewPermKey("");
      await load();
    }
  };

  if (loading) return <div>Laden…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className="border px-2 py-1 rounded" placeholder="Neue Rolle" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
        <Button size="sm" onClick={addRole}>Rolle anlegen</Button>
        <input className="border px-2 py-1 rounded ml-6" placeholder="Neues Recht (key)" value={newPermKey} onChange={(e) => setNewPermKey(e.target.value)} />
        <Button size="sm" onClick={addPerm}>Recht anlegen</Button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2 border-b">Recht</th>
              {roles.map((r) => (
                <th key={r.id} className="text-left p-2 border-b">
                  {r.name}{r.systemRole ? " (System)" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perms.map((p) => (
              <tr key={p.id}>
                <td className="p-2 border-b font-medium">{p.key}</td>
                {roles.map((r) => {
                  const granted = grants[r.id]?.has(p.key) ?? false;
                  const disabled = r.systemRole === "owner" || r.systemRole === "admin";
                  return (
                    <td key={r.id} className="p-2 border-b">
                      <input type="checkbox" checked={granted} disabled={disabled} onChange={(e) => toggle(r.id, p.key, e.target.checked)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

