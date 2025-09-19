"use client";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, sortRoles, type Role } from "@/lib/roles";
import { RoleManager } from "@/components/members/role-manager";

export type MembersTableUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  roles: Role[];
  customRoles: { id: string; name: string }[];
};

export function MembersTable({
  users,
  canEditOwner,
  availableCustomRoles,
}: {
  users: MembersTableUser[];
  canEditOwner: boolean;
  availableCustomRoles: { id: string; name: string }[];
}) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<MembersTableUser[]>(users);

  // keep local rows in sync when server re-fetches
  useEffect(() => {
    setRows(users);
  }, [users]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.name ?? "";
      const email = r.email ?? "";
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
    });
  }, [rows, query]);

  const initials = (name?: string | null, email?: string | null) => {
    const source = (name && name.trim()) || (email && email.split("@")[0]) || "?";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Suche nach Name oder E-Mail..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="text-sm text-muted-foreground">{filteredRows.length} von {rows.length} Mitgliedern</div>
      </div>
      {/* Mobile: card list */}
      <div className="space-y-2 sm:hidden">
        {filteredRows.map((u) => {
          const sorted = sortRoles(u.roles);
          return (
            <div key={u.id} className="rounded-md border bg-card p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                    {initials(u.name, u.email)}
                  </div>
                  <div>
                    <div className="font-medium">{u.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sorted.map((r) => (
                        <span key={r} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ROLE_BADGE_VARIANTS[r]}`}>
                          {ROLE_LABELS[r] ?? r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setOpenFor(u.id)}>
                      Bearbeiten
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => alert('Löschen noch nicht implementiert')}>
                      Löschen
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block">
        <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/30 text-left">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">E-Mail</th>
            <th className="px-3 py-2 font-medium">Rollen</th>
            <th className="px-3 py-2 font-medium">Zusätzliche Rollen</th>
            <th className="px-3 py-2 font-medium text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((u) => {
            const sorted = sortRoles(u.roles);
            return (
              <tr key={u.id} className="border-b hover:bg-accent/10">
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                      {initials(u.name, u.email)}
                    </div>
                    <div>
                      <div className="font-medium">{u.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{u.email || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {sorted.map((r) => (
                      <span key={r} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ROLE_BADGE_VARIANTS[r]}`}>
                        {ROLE_LABELS[r] ?? r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {u.customRoles.length ? (
                    <div className="flex flex-wrap gap-1">
                      {u.customRoles.map((cr) => (
                        <Badge key={cr.id} variant="secondary">{cr.name}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setOpenFor(u.id)}>
                      Bearbeiten
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => alert('Löschen noch nicht implementiert')}>
                      Löschen
                    </Button>
                  </div>
                  <Modal
                    open={openFor === u.id}
                    title="Benutzer bearbeiten"
                    description="Rollen und Daten bearbeiten"
                    onClose={() => setOpenFor(null)}
                  >
                    <RoleManager
                      userId={u.id}
                      email={u.email}
                      name={u.name}
                      initialRoles={u.roles}
                      canEditOwner={canEditOwner}
                      availableCustomRoles={availableCustomRoles}
                      initialCustomRoleIds={u.customRoles.map((r) => r.id)}
                      onSaved={({ roles, customRoleIds }) => {
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === u.id
                              ? {
                                  ...row,
                                  roles,
                                  customRoles: availableCustomRoles.filter((cr) => customRoleIds.includes(cr.id)),
                                }
                              : row,
                          ),
                        );
                      }}
                      onUserUpdated={({ email, name }) => {
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === u.id
                              ? {
                                  ...row,
                                  email: email ?? row.email,
                                  name: name ?? row.name,
                                }
                              : row,
                          ),
                        );
                      }}
                    />
                  </Modal>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
