"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ActionDropdownMenu } from "@/components/ui/action-dropdown-menu";
import {
  EditIcon,
  EyeIcon,
  LoadingIcon,
  SearchIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserCheckIcon,
  UserXIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ROLES, type Role } from "@/lib/roles";
import { RoleChips } from "@/components/members/role-chips";
import { RoleManager } from "@/components/members/role-manager";
import { UserAvatar } from "@/components/user-avatar";
import type { AvatarSource } from "@/components/user-avatar";
import { combineNameParts } from "@/lib/names";
import { ROLE_LABELS } from "@/lib/roles";
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
  /** Konto ist mit Authentik verknüpft (Login bzw. Passwort-Übernahme hat geklappt). */
  hasAuthentikAccount: boolean;
  /** Mitgliedschaft in der gerade gewählten Produktion (null = nicht dabei). */
  production?: { roles: Role[]; function: string | null; pending: boolean } | null;
};

type StatusFilter = "active" | "deactivated" | "all";
type ProductionFilter = "all" | "in" | "out";

function getDisplayName(user: MembersTableUser): string {
  return combineNameParts(user.firstName, user.lastName) ?? user.name ?? "";
}

/** „Ensemble · Phileas Fogg“ bzw. „eingeladen“ für die Produktionsspalte. */
function describeProduction(user: MembersTableUser): string | null {
  const membership = user.production;
  if (!membership) return null;
  const parts = [
    membership.roles.map((role) => ROLE_LABELS[role] ?? role).join(", "),
    membership.function,
  ].filter(Boolean);
  const text = parts.join(" · ") || "Dabei";
  return membership.pending ? `${text} (Onboarding offen)` : text;
}

function AuthentikMark({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <ShieldCheckIcon
      className="h-3.5 w-3.5 shrink-0 text-success"
      aria-label="Anmeldung über Theater-Konto (Authentik) eingerichtet"
    >
      <title>Anmeldung über Theater-Konto (Authentik) eingerichtet</title>
    </ShieldCheckIcon>
  );
}

export function MembersTable({
  users,
  canEditOwner,
  availableCustomRoles,
  productionTitle = null,
  addMemberSlot,
}: {
  users: MembersTableUser[];
  canEditOwner: boolean;
  availableCustomRoles: { id: string; name: string }[];
  /** Titel der gewählten Produktion; ohne Produktion entfällt die Spalte. */
  productionTitle?: string | null;
  addMemberSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<MembersTableUser[]>(users);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [productionFilter, setProductionFilter] = useState<ProductionFilter>("all");
  const [statusTarget, setStatusTarget] = useState<MembersTableUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MembersTableUser | null>(null);

  // keep local rows in sync when server re-fetches
  useEffect(() => {
    setRows(users);
  }, [users]);

  const counts = useMemo(() => {
    const deactivated = rows.filter((r) => r.isDeactivated).length;
    return { all: rows.length, deactivated, active: rows.length - deactivated };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "active" && r.isDeactivated) return false;
      if (statusFilter === "deactivated" && !r.isDeactivated) return false;
      if (productionFilter === "in" && !r.production) return false;
      if (productionFilter === "out" && r.production) return false;
      if (roleFilter !== "all") {
        const matchesRole = roleFilter.startsWith("custom:")
          ? r.customRoles.some((cr) => `custom:${cr.id}` === roleFilter)
          : r.roles.includes(roleFilter as Role);
        if (!matchesRole) return false;
      }
      if (!q) return true;
      const name = getDisplayName(r).toLowerCase();
      const email = (r.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [rows, query, roleFilter, statusFilter, productionFilter]);

  const hasExtraFilters = roleFilter !== "all" || productionFilter !== "all" || query !== "";
  const resetFilters = () => {
    setQuery("");
    setRoleFilter("all");
    setProductionFilter("all");
    setStatusFilter("active");
  };

  const editUser = rows.find((row) => row.id === openFor) ?? null;

  const actionsFor = (u: MembersTableUser) => {
    const profileHref = `/mitglieder/mitgliederverwaltung/${u.id}`;
    return (
      <ActionDropdownMenu
        label={`Aktionen für ${getDisplayName(u) || u.email || "Mitglied"}`}
        className="h-8 w-8 border-transparent bg-transparent shadow-none"
        items={[
          {
            label: "Profil öffnen",
            icon: <EyeIcon className="h-4 w-4" aria-hidden />,
            onSelect: () => router.push(profileHref),
          },
          {
            label: "Rollen & Daten bearbeiten",
            icon: <EditIcon className="h-4 w-4" aria-hidden />,
            onSelect: () => setOpenFor(u.id),
          },
          {
            label: u.isDeactivated ? "Reaktivieren" : "Deaktivieren",
            icon: u.isDeactivated ? (
              <UserCheckIcon className="h-4 w-4" aria-hidden />
            ) : (
              <UserXIcon className="h-4 w-4" aria-hidden />
            ),
            onSelect: () => setStatusTarget(u),
          },
          {
            label: "Löschen …",
            icon: <TrashIcon className="h-4 w-4" aria-hidden />,
            variant: "destructive",
            onSelect: () => setDeleteTarget(u),
          },
        ]}
      />
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Name oder E-Mail suchen"
            aria-label="Mitglieder durchsuchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="sm:w-44" aria-label="Nach Rolle filtern">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Rollen</SelectItem>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role] ?? role}
                </SelectItem>
              ))}
              {availableCustomRoles.map((cr) => (
                <SelectItem key={cr.id} value={`custom:${cr.id}`}>
                  {cr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {productionTitle ? (
            <Select
              value={productionFilter}
              onValueChange={(value) => setProductionFilter(value as ProductionFilter)}
            >
              <SelectTrigger className="sm:w-52" aria-label="Nach Produktion filtern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Produktionen</SelectItem>
                <SelectItem value="in">In „{productionTitle}“</SelectItem>
                <SelectItem value="out">Nicht in „{productionTitle}“</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          {addMemberSlot ? <div className="col-span-2 sm:col-span-1">{addMemberSlot}</div> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          aria-label="Status"
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: "active", label: `Aktiv ${counts.active}` },
            { value: "deactivated", label: `Deaktiviert ${counts.deactivated}` },
            { value: "all", label: `Alle ${counts.all}` },
          ]}
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span aria-live="polite">
            {filteredRows.length} {filteredRows.length === 1 ? "Mitglied" : "Mitglieder"}
          </span>
          {hasExtraFilters ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={resetFilters}
            >
              Filter zurücksetzen
            </Button>
          ) : null}
        </div>
      </div>

      {!filteredRows.length ? (
        <div className="space-y-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          <p>Keine Mitglieder gefunden.</p>
          {hasExtraFilters || statusFilter !== "active" ? (
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              Filter zurücksetzen
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="divide-y rounded-md border bg-card md:hidden">
            {filteredRows.map((u) => {
              const displayName = getDisplayName(u);
              const productionText = describeProduction(u);
              return (
                <li key={u.id} className="flex items-center gap-3 px-3 py-2">
                  <Link
                    href={`/mitglieder/mitgliederverwaltung/${u.id}`}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-3"
                  >
                    <UserAvatar
                      userId={u.id}
                      email={u.email}
                      firstName={u.firstName}
                      lastName={u.lastName}
                      name={displayName}
                      size={36}
                      className={cn("h-9 w-9 shrink-0", u.isDeactivated && "opacity-50")}
                      avatarSource={u.avatarSource}
                      avatarUpdatedAt={u.avatarUpdatedAt}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span
                          className={cn("truncate", u.isDeactivated && "text-muted-foreground")}
                        >
                          {displayName || u.email || "—"}
                        </span>
                        <AuthentikMark show={u.hasAuthentikAccount} />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {u.isDeactivated
                          ? "Deaktiviert"
                          : [productionText, ...u.customRoles.map((cr) => cr.name)]
                              .filter(Boolean)
                              .join(" · ") || u.email}
                      </span>
                    </span>
                  </Link>
                  <RoleChips roles={u.roles} max={1} hideMember className="shrink-0" />
                  {actionsFor(u)}
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Name</th>
                  {productionTitle ? (
                    <th className="px-3 py-2 font-medium">{productionTitle}</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium">Rollen</th>
                  <th className="px-3 py-2">
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((u) => {
                  const displayName = getDisplayName(u);
                  const productionText = describeProduction(u);
                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        "border-b last:border-b-0 hover:bg-accent/10",
                        u.isDeactivated && "text-muted-foreground",
                      )}
                    >
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/mitglieder/mitgliederverwaltung/${u.id}`}
                          className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <UserAvatar
                            userId={u.id}
                            email={u.email}
                            firstName={u.firstName}
                            lastName={u.lastName}
                            name={displayName}
                            size={28}
                            className={cn("h-7 w-7 shrink-0", u.isDeactivated && "opacity-50")}
                            avatarSource={u.avatarSource}
                            avatarUpdatedAt={u.avatarUpdatedAt}
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 font-medium text-foreground hover:underline">
                              <span className={cn(u.isDeactivated && "text-muted-foreground")}>
                                {displayName || "—"}
                              </span>
                              <AuthentikMark show={u.hasAuthentikAccount} />
                              {u.isDeactivated ? (
                                <Badge
                                  variant="outline"
                                  className="px-1.5 py-0 text-[10px] font-normal"
                                >
                                  deaktiviert
                                </Badge>
                              ) : null}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {u.email || "keine E-Mail"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      {productionTitle ? (
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {productionText ?? <span aria-label="nicht dabei">—</span>}
                        </td>
                      ) : null}
                      <td className="px-3 py-1.5">
                        <RoleChips roles={u.roles} customRoles={u.customRoles} hideMember />
                      </td>
                      <td className="w-10 px-2 py-1.5 text-right">{actionsFor(u)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Dialog
        open={Boolean(editUser)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setOpenFor(null);
        }}
      >
        {editUser ? (
          <DialogContent className="sm:max-w-3xl overflow-visible">
            <DialogHeader>
              <DialogTitle>{getDisplayName(editUser) || "Mitglied"} bearbeiten</DialogTitle>
              <DialogDescription>Rollen und Kontaktdaten</DialogDescription>
            </DialogHeader>
            <RoleManager
              userId={editUser.id}
              email={editUser.email}
              firstName={editUser.firstName}
              lastName={editUser.lastName}
              name={getDisplayName(editUser)}
              initialRoles={editUser.roles}
              canEditOwner={canEditOwner}
              availableCustomRoles={availableCustomRoles}
              initialCustomRoleIds={editUser.customRoles.map((r) => r.id)}
              onSaved={({ roles, customRoleIds }) => {
                setRows((prev) =>
                  prev.map((row) =>
                    row.id === editUser.id
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
                    row.id === editUser.id
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
                            ) ??
                            row.name,
                        }
                      : row,
                  ),
                );
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">{displayName}</div>
            <div className="text-xs text-muted-foreground">
              {user.email || "Keine E-Mail hinterlegt"}
            </div>
          </div>
          {targetWillDeactivate ? (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
              Deaktivierte Profile bleiben in Listen sichtbar, verfügen jedoch über keinerlei Rechte
              mehr. Die Reaktivierung ist jederzeit möglich.
            </div>
          ) : (
            <div className="rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success-foreground">
              Das Mitglied kann nach der Reaktivierung sofort wieder alle zugewiesenen Funktionen
              nutzen.
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:space-x-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <AsyncButton
            type="button"
            variant={targetWillDeactivate ? "destructive" : "default"}
            onClick={handleSubmit}
            isLoading={loading}
            loadingText={targetWillDeactivate ? "Deaktivieren" : "Aktivieren"}
          >
            {targetWillDeactivate ? "Deaktivieren" : "Aktivieren"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        const message =
          error instanceof Error ? error.message : "Übersicht konnte nicht geladen werden";
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
  const showUsageNotice = usageTotal > 0 && !usageError && !loadingUsage;

  const handleDelete = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/members/${user.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        anonymized?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data?.error ?? "Löschen fehlgeschlagen");
      }
      toast.success(
        data.anonymized
          ? "Mitglied anonymisiert (verknüpfte Vereinsdaten bleiben erhalten)"
          : "Mitglied erfolgreich gelöscht",
      );
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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mitglied löschen</DialogTitle>
          <DialogDescription>
            Prüfe vor dem Löschen, in welchen Bereichen dieses Profil eingebunden ist.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="font-medium text-foreground">{displayName}</div>
            <div className="text-xs text-muted-foreground">
              {user.email || "Keine E-Mail hinterlegt"}
            </div>
            {user.isDeactivated && (
              <Badge
                variant="outline"
                className="mt-2 text-[10px] uppercase tracking-wide text-destructive"
              >
                Bereits deaktiviert
              </Badge>
            )}
          </div>

          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            Dieser Vorgang kann nicht rückgängig gemacht werden. Alle verknüpften Daten werden
            entsprechend den hinterlegten Löschregeln entfernt oder anonymisiert.
          </div>

          {loadingUsage ? (
            <div className="flex items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <LoadingIcon className="h-4 w-4" aria-hidden />
              Lade Zuordnungen …
            </div>
          ) : usageError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {usageError}
            </div>
          ) : usage && usage.sections.length > 0 ? (
            <div className="space-y-3">
              {usage.sections.map((section) => (
                <div
                  key={section.key}
                  className="rounded-md border border-border/60 bg-background p-3"
                >
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
        </div>
        <DialogFooter
          className={cn(
            "mt-4 flex-col gap-3 sm:flex-row sm:items-center",
            showUsageNotice ? "sm:justify-between" : "sm:justify-end",
          )}
        >
          {showUsageNotice ? (
            <div className="text-xs text-muted-foreground">
              Insgesamt {usageTotal} Verknüpfungen werden entfernt oder neutralisiert.
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Abbrechen
            </Button>
            <AsyncButton
              type="button"
              variant="destructive"
              onClick={handleDelete}
              isLoading={loading}
              loadingText="Löschen"
            >
              Endgültig löschen
            </AsyncButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
