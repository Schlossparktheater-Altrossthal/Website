"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, ROLES, sortRoles, type Role } from "@/lib/roles";
import { RoleManager } from "@/components/members/role-manager";
import { UserAvatar } from "@/components/user-avatar";
import type { AvatarSource } from "@/components/user-avatar";
import { combineNameParts } from "@/lib/names";
import { cn } from "@/lib/utils";

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
  isDeactivated: boolean;
  deactivatedAt?: string | null;
};

function getDisplayName(user: MembersTableUser): string {
  return combineNameParts(user.firstName, user.lastName) ?? user.name ?? "";
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
  const [roleFilter, setRoleFilter] = useState<Role | null>(null);
  const [statusTarget, setStatusTarget] = useState<MembersTableUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MembersTableUser | null>(null);

  // keep local rows in sync when server re-fetches
  useEffect(() => {
    setRows(users);
  }, [users]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const name = getDisplayName(r).toLowerCase();
      const email = (r.email ?? "").toLowerCase();
      const matchesQuery = !q || name.includes(q) || email.includes(q);
      const matchesRole = !roleFilter || r.roles.includes(roleFilter);
      return matchesQuery && matchesRole;
    });
  }, [rows, query, roleFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Badge
          asChild
          variant="outline"
          className={cn(
            "cursor-pointer transition",
            !roleFilter
              ? "border-primary/60 bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/40",
          )}
        >
          <button type="button" onClick={() => setRoleFilter(null)}>
            Alle Rollen
          </button>
        </Badge>
        {ROLES.map((role) => (
          <Badge
            key={role}
            asChild
            variant="outline"
            className={cn(
              "cursor-pointer transition",
              roleFilter === role
                ? ROLE_BADGE_VARIANTS[role]
                : "text-muted-foreground hover:bg-muted/40",
            )}
          >
            <button
              type="button"
              onClick={() => setRoleFilter((prev) => (prev === role ? null : role))}
            >
              {ROLE_LABELS[role] ?? role}
            </button>
          </Badge>
        ))}
      </div>

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
          <div className="space-y-4 sm:hidden">
            {filteredRows.map((u) => {
              const sorted = sortRoles(u.roles);
              const displayName = getDisplayName(u);
              const profileHref = `/mitglieder/mitgliederverwaltung/${u.id}`;
              return (
                <div
                  key={u.id}
                  className={cn("rounded-md border bg-card p-3", u.isDeactivated && "border-dashed bg-muted/40")}
                >
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
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          <span>{displayName || "—"}</span>
                          {u.isDeactivated && (
                            <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
                              Deaktiviert
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {sorted.map((r) => (
                            <span
                              key={r}
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ROLE_BADGE_VARIANTS[r]}`}
                            >
                              {ROLE_LABELS[r] ?? r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <MemberActionButtons
                        user={u}
                        profileHref={profileHref}
                        onEdit={() => setOpenFor(u.id)}
                        onToggleStatus={() => setStatusTarget(u)}
                        onDelete={() => setDeleteTarget(u)}
                        className="justify-end"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
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
                  {filteredRows.map((u) => {
                    const sorted = sortRoles(u.roles);
                    const displayName = getDisplayName(u);
                    const profileHref = `/mitglieder/mitgliederverwaltung/${u.id}`;
                    return (
                      <tr key={u.id} className={cn("border-b hover:bg-accent/10", u.isDeactivated && "bg-muted/40")}>
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
                              <div className="flex flex-wrap items-center gap-2 font-medium">
                                <span>{displayName || "—"}</span>
                                {u.isDeactivated && (
                                  <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
                                    Deaktiviert
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{u.email || "—"}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {sorted.map((r) => (
                              <span
                                key={r}
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ROLE_BADGE_VARIANTS[r]}`}
                              >
                                {ROLE_LABELS[r] ?? r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {u.customRoles.length ? (
                            <div className="flex flex-wrap gap-1">
                              {u.customRoles.map((cr) => (
                                <Badge key={cr.id} variant="secondary">
                                  {cr.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <MemberActionButtons
                            user={u}
                            profileHref={profileHref}
                            onEdit={() => setOpenFor(u.id)}
                            onToggleStatus={() => setStatusTarget(u)}
                            onDelete={() => setDeleteTarget(u)}
                            className="ml-auto justify-end"
                          />
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
                                          customRoles: availableCustomRoles.filter((cr) =>
                                            customRoleIds.includes(cr.id),
                                          ),
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
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <MemberStatusModal
        user={statusTarget}
        onClose={() => setStatusTarget(null)}
        onStatusChange={(id, deactivatedAt) => {
          setRows((prev) =>
            prev.map((row) =>
              row.id === id
                ? {
                    ...row,
                    isDeactivated: Boolean(deactivatedAt),
                    deactivatedAt,
                  }
                : row,
            ),
          );
          if (openFor === id && Boolean(deactivatedAt)) {
            setOpenFor(null);
          }
        }}
      />
      <MemberDeleteModal
        user={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => {
          setRows((prev) => prev.filter((row) => row.id !== id));
          setOpenFor((prev) => (prev === id ? null : prev));
        }}
      />
    </div>
  );
}

type MemberActionButtonsProps = {
  user: MembersTableUser;
  profileHref: string;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  className?: string;
};

function MemberActionButtons({
  user,
  profileHref,
  onEdit,
  onToggleStatus,
  onDelete,
  className,
}: MemberActionButtonsProps) {
  const displayName = getDisplayName(user);
  const actionTarget = displayName || user.email || "dieses Mitglied";
  const statusLabel = user.isDeactivated ? "Aktivieren" : "Deaktivieren";
  const statusTitle = user.isDeactivated
    ? `${actionTarget} reaktivieren`
    : `${actionTarget} deaktivieren`;
  const StatusIcon = user.isDeactivated ? UserCheck : UserX;
  const baseButtonClass = "rounded-full border shadow-sm";
  const statusButtonClass = user.isDeactivated
    ? "border-success/60 bg-success/10 text-success hover:bg-success/20 hover:text-success-foreground"
    : "border-warning/60 bg-warning/10 text-warning hover:bg-warning/20 hover:text-warning-foreground";

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Button
        asChild
        size="icon"
        variant="ghost"
        className={cn(
          baseButtonClass,
          "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
        )}
      >
        <Link
          href={profileHref}
          aria-label={`Profil von ${actionTarget} öffnen`}
          title={`Profil von ${actionTarget} öffnen`}
        >
          <Eye className="h-4 w-4" aria-hidden />
          <span className="sr-only">Profil</span>
        </Link>
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(
          baseButtonClass,
          "border-border/60 bg-muted/40 text-foreground/70 hover:bg-muted/60 hover:text-foreground",
        )}
        onClick={onEdit}
        aria-label={`${actionTarget} bearbeiten`}
        title={`${actionTarget} bearbeiten`}
      >
        <Pencil className="h-4 w-4" aria-hidden />
        <span className="sr-only">Bearbeiten</span>
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(baseButtonClass, statusButtonClass)}
        onClick={onToggleStatus}
        aria-label={`${statusLabel} ${actionTarget}`}
        title={statusTitle}
      >
        <StatusIcon className="h-4 w-4" aria-hidden />
        <span className="sr-only">{statusLabel}</span>
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(
          baseButtonClass,
          "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20",
        )}
        onClick={onDelete}
        aria-label={`${actionTarget} löschen`}
        title={`${actionTarget} löschen`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        <span className="sr-only">Löschen</span>
      </Button>
    </div>
  );
}

type MemberStatusModalProps = {
  user: MembersTableUser | null;
  onClose: () => void;
  onStatusChange: (id: string, deactivatedAt: string | null) => void;
};

function MemberStatusModal({ user, onClose, onStatusChange }: MemberStatusModalProps) {
  const [loading, setLoading] = useState(false);
  const open = Boolean(user);

  if (!user) {
    return null;
  }

  const displayName = getDisplayName(user) || user.email || "Unbekanntes Mitglied";
  const targetWillDeactivate = !user.isDeactivated;
  const title = targetWillDeactivate ? "Mitglied deaktivieren" : "Mitglied reaktivieren";
  const description = targetWillDeactivate
    ? "Das Mitglied kann sich nach der Deaktivierung nicht mehr anmelden. Alle aktiven Sitzungen werden beendet."
    : "Das Mitglied erhält wieder Zugriff auf den Mitgliederbereich und kann sich erneut anmelden.";

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/members/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deactivated: targetWillDeactivate }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        user?: { deactivatedAt?: string | null };
      };

      if (!response.ok) {
        throw new Error(data?.error ?? "Aktualisierung fehlgeschlagen");
      }

      const nextDeactivatedAt = data?.user?.deactivatedAt ?? null;
      onStatusChange(user.id, nextDeactivatedAt);
      toast.success(targetWillDeactivate ? "Mitglied deaktiviert" : "Mitglied reaktiviert");
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title={title} description={description} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
          <div className="font-medium text-foreground">{displayName}</div>
          <div className="text-xs text-muted-foreground">{user.email || "Keine E-Mail hinterlegt"}</div>
        </div>
        {targetWillDeactivate ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Deaktivierte Profile bleiben in Listen sichtbar, verfügen jedoch über keinerlei Rechte mehr. Die
            Reaktivierung ist jederzeit möglich.
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            Das Mitglied kann nach der Reaktivierung sofort wieder alle zugewiesenen Funktionen nutzen.
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button
            type="button"
            variant={targetWillDeactivate ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {targetWillDeactivate ? "Deaktivieren" : "Aktivieren"}
              </span>
            ) : (
              targetWillDeactivate ? "Deaktivieren" : "Aktivieren"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type MemberUsageItem = { key: string; label: string; count: number; href?: string | null };
type MemberUsageSection = { key: string; title: string; total: number; items: MemberUsageItem[] };

type MemberUsageResponse = {
  total: number;
  sections: MemberUsageSection[];
  user?: { id: string; name?: string | null; email?: string | null; deactivatedAt?: string | null };
  error?: string;
};

type MemberDeleteModalProps = {
  user: MembersTableUser | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
};

function MemberDeleteModal({ user, onClose, onDeleted }: MemberDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<MemberUsageResponse | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const open = Boolean(user);

  useEffect(() => {
    if (!user) {
      setUsage(null);
      setUsageError(null);
      setLoadingUsage(false);
      return;
    }

    let cancelled = false;
    setLoadingUsage(true);
    setUsageError(null);

    const load = async () => {
      try {
        const response = await fetch(`/api/members/${user.id}/usage`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as MemberUsageResponse;
        if (cancelled) return;
        if (!response.ok) {
          setUsage(null);
          setUsageError(data?.error ?? "Übersicht konnte nicht geladen werden");
        } else {
          setUsage(data);
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Übersicht konnte nicht geladen werden";
        setUsage(null);
        setUsageError(message);
      } finally {
        if (!cancelled) {
          setLoadingUsage(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return null;
  }

  const displayName = getDisplayName(user) || user.email || "Unbekanntes Mitglied";
  const usageTotal = usage?.total ?? 0;

  const handleDelete = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/members/${user.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data?.error ?? "Löschen fehlgeschlagen");
      }
      toast.success("Mitglied erfolgreich gelöscht");
      onDeleted(user.id);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Löschen fehlgeschlagen";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Mitglied löschen"
      description="Prüfe vor dem Löschen, in welchen Bereichen dieses Profil eingebunden ist."
      onClose={onClose}
      allowContentOverflow
    >
      <div className="space-y-4">
        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
          <div className="font-medium text-foreground">{displayName}</div>
          <div className="text-xs text-muted-foreground">{user.email || "Keine E-Mail hinterlegt"}</div>
          {user.isDeactivated && (
            <Badge variant="outline" className="mt-2 text-[10px] uppercase tracking-wide text-destructive">
              Bereits deaktiviert
            </Badge>
          )}
        </div>

        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          Dieser Vorgang kann nicht rückgängig gemacht werden. Alle verknüpften Daten werden entsprechend den
          hinterlegten Löschregeln entfernt oder anonymisiert.
        </div>

        {loadingUsage ? (
          <div className="flex items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Lade Zuordnungen …
          </div>
        ) : usageError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {usageError}
          </div>
        ) : usage && usage.sections.length > 0 ? (
          <div className="space-y-3">
            {usage.sections.map((section) => (
              <div key={section.key} className="rounded-md border border-border/60 bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{section.title}</span>
                  <span className="text-xs text-muted-foreground">{section.total} Einträge</span>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item.key} className="flex items-center justify-between">
                      <span>{item.label}</span>
                      <span className="font-medium text-foreground">{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Keine verknüpften Datensätze gefunden. Das Profil kann sicher gelöscht werden.
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {usageTotal > 0 && !usageError && !loadingUsage && (
            <div className="text-xs text-muted-foreground">
              Insgesamt {usageTotal} Verknüpfungen werden entfernt oder neutralisiert.
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Abbrechen
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Löschen
                </span>
              ) : (
                "Endgültig löschen"
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
