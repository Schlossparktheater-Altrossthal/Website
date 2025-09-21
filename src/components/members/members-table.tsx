"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, ROLES, sortRoles, type Role } from "@/lib/roles";
import { RoleManager } from "@/components/members/role-manager";
import { UserAvatar } from "@/components/user-avatar";
import type { AvatarSource } from "@/components/user-avatar";
import { combineNameParts } from "@/lib/names";

export type MembersTableUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  roles: Role[];
  customRoles: { id: string; name: string }[];
  avatarSource?: AvatarSource | null;
  avatarUpdatedAt?: string | number | Date | null;
};

function getDisplayName(user: MembersTableUser): string {
  return combineNameParts(user.firstName, user.lastName) ?? user.name ?? "";
}

function formatMemberCount(count: number) {
  return count === 1 ? "1 Mitglied" : `${count} Mitglieder`;
}

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
      const name = getDisplayName(r).toLowerCase();
      const email = (r.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [rows, query]);

  const groupedByRole = useMemo(
    () =>
      ROLES.map((role) => ({
        role,
        members: filteredRows.filter((member) => member.roles.includes(role)),
      })).filter((group) => group.members.length > 0),
    [filteredRows],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
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

      {!filteredRows.length ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Keine Mitglieder gefunden.
        </div>
      ) : (
        <>
          <div className="space-y-6 sm:hidden">
            {groupedByRole.map(({ role, members }) => (
              <section key={role} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{ROLE_LABELS[role] ?? role}</h2>
                  <span className="text-xs text-muted-foreground">{formatMemberCount(members.length)}</span>
                </div>
                {members.map((u) => {
                  const sorted = sortRoles(u.roles);
                  const displayName = getDisplayName(u);
                  const profileHref = `/mitglieder/mitgliederverwaltung/${u.id}`;
                  return (
                    <div key={`${role}-${u.id}`} className="rounded-md border bg-card p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            userId={u.id}
                            email={u.email}
                            firstName={u.firstName}
                            lastName={u.lastName}
                            name={displayName}
                            size={40}
                            className="h-10 w-10"
                            avatarSource={u.avatarSource}
                            avatarUpdatedAt={u.avatarUpdatedAt}
                          />
                          <div>
                            <div className="font-medium">{displayName || "—"}</div>
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
                          <div className="flex flex-wrap gap-2">
                            <Button
                              asChild
                              size="sm"
                              variant="secondary"
                              className="gap-1.5"
                            >
                              <Link href={profileHref} title={`Profil von ${displayName} ansehen`}>
                                <Eye className="h-4 w-4" aria-hidden />
                                Profil
                              </Link>
                            </Button>
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
              </section>
            ))}
          </div>

          <div className="hidden sm:block">
            <div className="overflow-x-auto rounded-md border">
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
                  {groupedByRole.map(({ role, members }) => (
                    <Fragment key={role}>
                      <tr className="border-b bg-muted/20">
                        <td colSpan={5} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {ROLE_LABELS[role] ?? role}
                          <span className="ml-2 font-normal normal-case text-muted-foreground/80">
                            {formatMemberCount(members.length)}
                          </span>
                        </td>
                      </tr>
                      {members.map((u) => {
                        const sorted = sortRoles(u.roles);
                        const displayName = getDisplayName(u);
                        const profileHref = `/mitglieder/mitgliederverwaltung/${u.id}`;
                        return (
                          <tr key={`${role}-${u.id}`} className="border-b hover:bg-accent/10">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <UserAvatar
                                  userId={u.id}
                                  email={u.email}
                                  firstName={u.firstName}
                                  lastName={u.lastName}
                                  name={displayName}
                                  size={32}
                                  className="h-8 w-8"
                                  avatarSource={u.avatarSource}
                                  avatarUpdatedAt={u.avatarUpdatedAt}
                                />
                                <div>
                                  <div className="font-medium">{displayName || "—"}</div>
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
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                  asChild
                                  size="sm"
                                  variant="secondary"
                                  className="gap-1.5"
                                >
                                  <Link href={profileHref} title={`Profil von ${displayName} ansehen`}>
                                    <Eye className="h-4 w-4" aria-hidden />
                                    Profil
                                  </Link>
                                </Button>
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
                                allowContentOverflow
                              >
                                <RoleManager
                                  userId={u.id}
                                  email={u.email}
                                  firstName={u.firstName}
                                  lastName={u.lastName}
                                  name={displayName}
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
                                  onUserUpdated={({ email, firstName, lastName, name }) => {
                                    setRows((prev) =>
                                      prev.map((row) =>
                                        row.id === u.id
                                          ? {
                                              ...row,
                                              email: email ?? row.email,
                                              firstName: firstName !== undefined ? firstName : row.firstName,
                                              lastName: lastName !== undefined ? lastName : row.lastName,
                                              name:
                                                name ??
                                                combineNameParts(
                                                  firstName !== undefined ? firstName : row.firstName,
                                                  lastName !== undefined ? lastName : row.lastName,
                                                ) ?? row.name,
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
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
