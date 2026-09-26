"use client";

import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { ChevronDownIcon, LockIcon, PlusIcon, SearchIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { PermissionToggle } from "@/components/ui/permission-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ROLE_LABELS, type Role } from "@/lib/roles";

import type {
  PermissionWorkbenchPermission,
  PermissionWorkbenchRole,
  RoleGrantState,
} from "@/components/members/permissions/permission-workbench-types";

const CATEGORY_ORDER = [
  "base",
  "rehearsal",
  "department",
  "pages",
  "admin",
  "communication",
  "analytics",
] as const;
type PermissionGroup = {
  id: string;
  category: string;
  label: string;
  description: string;
  keys: string[];
};
const GROUPS: PermissionGroup[] = [
  {
    id: "group-base-access",
    category: "base",
    label: "Allgemeiner Zugang",
    description: "Steuert den grundlegenden Mitgliederzugang.",
    keys: ["PRIVATE.DASHBOARD.OVERVIEW.VIEW", "PRIVATE.PROFILE.OWN.VIEW"],
  },
  {
    id: "group-department-costume",
    category: "department",
    label: "Kostüm & Verpflegung",
    description: "Bündelt Freigaben für Maße, Größen und Ernährung.",
    keys: [
      "PRIVATE.PROFILE.MEASUREMENTS.MANAGE",
      "PRIVATE.PROFILE.SIZES.MANAGE",
      "PRIVATE.PROFILE.DIETARY.MANAGE",
    ],
  },
];

/** Eine Zeile der Matrix: ein einzelnes Recht oder eine Gruppe, die gemeinsam geschaltet wird. */
type MatrixRow = {
  id: string;
  label: string;
  description: string;
  keys: string[];
};

type MatrixCategory = { key: string; label: string; rows: MatrixRow[] };

function toGrantState(record: Record<string, string[]>) {
  const next: RoleGrantState = {};
  for (const [key, values] of Object.entries(record)) next[key] = new Set(values);
  return next;
}

function roleLabel(role: PermissionWorkbenchRole) {
  return role.systemRole ? (ROLE_LABELS[role.systemRole as Role] ?? role.name) : role.name;
}

function grantState(granted: Set<string> | undefined, keys: string[]) {
  const count = keys.filter((key) => granted?.has(key)).length;
  if (count === 0) return false;
  return count === keys.length ? true : ("indeterminate" as const);
}

export function PermissionWorkbenchClient({
  permissions,
  roles: initialRoles,
  systemRoles,
  roleGrants: initialRoleGrants,
  memberCounts = {},
}: {
  permissions: PermissionWorkbenchPermission[];
  roles: PermissionWorkbenchRole[];
  systemRoles: PermissionWorkbenchRole[];
  departments: unknown[];
  roleGrants: Record<string, string[]>;
  departmentGrants: Record<string, string[]>;
  memberCounts?: Record<string, number>;
}) {
  const [roles, setRoles] = useState(initialRoles);
  const [roleGrants, setRoleGrants] = useState<RoleGrantState>(() =>
    toGrantState(initialRoleGrants),
  );
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<PermissionWorkbenchRole | null>(null);
  const [deleteRole, setDeleteRole] = useState<PermissionWorkbenchRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [mobileRoleId, setMobileRoleId] = useState<string>(initialRoles[0]?.id ?? "");

  const hasSearch = search.trim().length > 0;
  const mobileRole = roles.find((role) => role.id === mobileRoleId) ?? roles[0];

  const categories = useMemo<MatrixCategory[]>(() => {
    const term = search.trim().toLowerCase();
    const matches = (text: string) => !term || text.toLowerCase().includes(term);
    return CATEGORY_ORDER.map((categoryKey) => {
      const inCategory = permissions.filter((p) => p.categoryKey === categoryKey);
      const byKey = new Map(inCategory.map((p) => [p.key, p]));
      const groups = GROUPS.filter((g) => g.category === categoryKey);
      const grouped = new Set(groups.flatMap((g) => g.keys));
      const rows: MatrixRow[] = [
        ...groups
          .map((group) => {
            const members = group.keys
              .map((key) => byKey.get(key))
              .filter(Boolean) as PermissionWorkbenchPermission[];
            return {
              id: group.id,
              label: group.label,
              description: `${group.description} Umfasst: ${members.map((m) => m.label).join(", ")}.`,
              keys: members.map((m) => m.key),
              searchText: [group.label, ...members.map((m) => `${m.label} ${m.key}`)].join(" "),
            };
          })
          .filter((row) => row.keys.length > 0),
        ...inCategory
          .filter((p) => !grouped.has(p.key))
          .map((p) => ({
            id: p.key,
            label: p.label,
            description: p.description ?? "",
            keys: [p.key],
            searchText: `${p.label} ${p.key} ${p.description ?? ""}`,
          })),
      ].filter((row) => matches(row.searchText));
      return {
        key: categoryKey,
        label: inCategory[0]?.categoryLabel ?? categoryKey,
        rows,
      };
    }).filter((category) => category.rows.length > 0);
  }, [permissions, search]);

  const sendGrant = (roleId: string, permissionKey: string, grant: boolean) =>
    fetch("/api/permissions/definitions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionKey, roleId, grant }),
    }).then((response) => response.ok);

  const applyLocal = (roleId: string, keys: string[], grant: boolean) =>
    setRoleGrants((current) => {
      const next = new Set(current[roleId] ?? []);
      for (const key of keys) {
        if (grant) next.add(key);
        else next.delete(key);
      }
      return { ...current, [roleId]: next };
    });

  /** Speichert sofort; die Meldung bietet „Rückgängig“ statt einer Rückfrage. */
  const setRowGrant = async (
    role: PermissionWorkbenchRole,
    row: MatrixRow,
    grant: boolean,
    { undo = true } = {},
  ) => {
    const current = roleGrants[role.id];
    const changed = row.keys.filter((key) => Boolean(current?.has(key)) !== grant);
    if (!changed.length) return;
    applyLocal(role.id, changed, grant);
    const results = await Promise.all(changed.map((key) => sendGrant(role.id, key, grant)));
    const failed = changed.filter((_, index) => !results[index]);
    if (failed.length) {
      applyLocal(role.id, failed, !grant);
      toast.error("Rechte konnten nicht gespeichert werden", { duration: 5000 });
      return;
    }
    if (!undo) return;
    toast.success(`${row.label}: ${roleLabel(role)} ${grant ? "erlaubt" : "entzogen"}`, {
      duration: 5000,
      action: {
        label: "Rückgängig",
        onClick: () => void setRowGrant(role, { ...row, keys: changed }, !grant, { undo: false }),
      },
    });
  };

  const moveRole = async (roleId: string, direction: -1 | 1) => {
    const index = roles.findIndex((role) => role.id === roleId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= roles.length) return;
    const next = [...roles];
    [next[index], next[target]] = [next[target], next[index]];
    setRoles(next);
    await fetch("/api/permissions/roles/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleIds: next.map((role) => role.id) }),
    });
  };

  const countLabel = (role: PermissionWorkbenchRole) => {
    const count = memberCounts[role.id];
    if (count === undefined) return null;
    return count === 1 ? "1 Person" : `${count} Personen`;
  };

  const renderRoleHeader = (role: PermissionWorkbenchRole, index: number) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full flex-col items-center rounded-md px-1 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Rolle bearbeiten"
        >
          <span className="flex max-w-full items-center gap-0.5 truncate text-sm font-medium text-foreground">
            <span className="truncate">{roleLabel(role)}</span>
            <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          </span>
          <span className="text-[11px] font-normal text-muted-foreground">{countLabel(role)}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuLabel>{roleLabel(role)}</DropdownMenuLabel>
        {!role.systemRole ? (
          <DropdownMenuItem
            onSelect={() => {
              setRoleName(role.name);
              setEditRole(role);
            }}
          >
            Umbenennen
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={index === 0} onSelect={() => void moveRole(role.id, -1)}>
          Nach links schieben
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={index === roles.length - 1}
          onSelect={() => void moveRole(role.id, 1)}
        >
          Nach rechts schieben
        </DropdownMenuItem>
        {!role.systemRole ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setDeleteRole(role)}
            >
              Rolle löschen …
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const lockedHint = `${systemRoles.map(roleLabel).join(" und ")} haben immer alle Rechte.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Rechte durchsuchen"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recht suchen, z. B. Sperrliste"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setRoleName("");
            setCreateOpen(true);
          }}
        >
          <PlusIcon className="size-4" aria-hidden />
          Neue Rolle
        </Button>
      </div>

      {!categories.length ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Kein Recht passt zu „{search}“.
        </p>
      ) : null}

      {/* Mobil: eine Rolle wählen, Rechte als Schalterliste */}
      <div className="space-y-3 md:hidden">
        <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 backdrop-blur">
          <Select value={mobileRole?.id ?? ""} onValueChange={setMobileRoleId}>
            <SelectTrigger className="w-full" aria-label="Rolle wählen">
              <SelectValue placeholder="Rolle wählen" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {roleLabel(role)}
                  {countLabel(role) ? ` · ${countLabel(role)}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <LockIcon className="size-3" aria-hidden />
            {lockedHint}
          </p>
        </div>

        {mobileRole
          ? categories.map((category, index) => {
              const granted = category.rows.filter(
                (row) => grantState(roleGrants[mobileRole.id], row.keys) === true,
              ).length;
              return (
                <Collapsible
                  key={`${category.key}-${hasSearch}`}
                  defaultOpen={hasSearch || index === 0}
                  className="overflow-hidden rounded-lg border"
                >
                  <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between bg-muted/50 px-4 text-sm font-semibold">
                    <span>{category.label}</span>
                    <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                      {granted}/{category.rows.length}
                      <ChevronDownIcon
                        className="size-4 transition-transform group-data-[state=open]:rotate-180"
                        aria-hidden
                      />
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="divide-y">
                      {category.rows.map((row) => {
                        const state = grantState(roleGrants[mobileRole.id], row.keys);
                        const id = `m-${mobileRole.id}-${row.id}`;
                        return (
                          <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                            <label htmlFor={id} className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{row.label}</span>
                              {row.description ? (
                                <span className="block text-xs text-muted-foreground">
                                  {row.description}
                                </span>
                              ) : null}
                              {state === "indeterminate" ? (
                                <span className="block text-xs text-warning">
                                  Teilweise erlaubt
                                </span>
                              ) : null}
                            </label>
                            <Switch
                              id={id}
                              checked={state === true}
                              onCheckedChange={(checked) =>
                                void setRowGrant(mobileRole, row, checked)
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          : null}
      </div>

      {/* Desktop: Matrix, alle Bereiche offen */}
      {categories.length ? (
        <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[18rem] border-b bg-card px-4 py-2 text-left align-bottom text-xs font-medium text-muted-foreground">
                  Recht
                </th>
                {roles.map((role, index) => (
                  <th
                    key={role.id}
                    className="sticky top-0 z-20 w-28 min-w-[6.5rem] border-b border-l border-border/40 bg-card px-1 py-1.5 align-bottom"
                  >
                    {renderRoleHeader(role, index)}
                  </th>
                ))}
                {systemRoles.map((role) => (
                  <th
                    key={role.id}
                    title={lockedHint}
                    className="sticky top-0 z-20 w-24 border-b border-l border-border/40 bg-muted/40 px-1 py-1.5 align-bottom"
                  >
                    <span className="flex items-center justify-center gap-1 text-sm font-medium text-muted-foreground">
                      <LockIcon className="size-3" aria-hidden />
                      {roleLabel(role)}
                    </span>
                    <span className="block text-center text-[11px] font-normal text-muted-foreground">
                      {countLabel(role)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <Fragment key={category.key}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={1 + roles.length + systemRoles.length}
                      className="border-b bg-muted/60 px-4 pb-1.5 pt-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      <span className="sticky left-4">{category.label}</span>
                    </th>
                  </tr>
                  {category.rows.map((row) => (
                    <tr key={row.id} className="group">
                      <td className="sticky left-0 z-10 border-b border-border/40 bg-card px-4 py-2 group-hover:bg-muted">
                        <span className="block font-medium text-foreground">{row.label}</span>
                        {row.description ? (
                          <span
                            className="line-clamp-1 max-w-md text-xs text-muted-foreground"
                            title={row.description}
                          >
                            {row.description}
                          </span>
                        ) : null}
                      </td>
                      {roles.map((role) => (
                        <td
                          key={role.id}
                          className="border-b border-l border-border/40 bg-card text-center group-hover:bg-muted/60"
                        >
                          <PermissionToggle
                            aria-label={`${row.label} für ${roleLabel(role)}`}
                            className="border-muted-foreground/50"
                            checked={grantState(roleGrants[role.id], row.keys)}
                            onCheckedChange={(state) => void setRowGrant(role, row, state === true)}
                          />
                        </td>
                      ))}
                      {systemRoles.map((role) => (
                        <td
                          key={role.id}
                          className="border-b border-l border-border/40 bg-muted/30 text-center"
                        >
                          <PermissionToggle checked disabled aria-label={lockedHint} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ModalFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Neue Rolle"
        description="Die Rolle erscheint danach als Spalte und kann Mitgliedern zugewiesen werden."
        onSave={async () => {
          const response = await fetch("/api/permissions/roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: roleName }),
          });
          if (!response.ok) {
            toast.error("Rolle konnte nicht erstellt werden", { duration: 5000 });
            return;
          }
          const data = (await response.json()) as { role: PermissionWorkbenchRole };
          setRoles((r) => [...r, data.role]);
          setMobileRoleId(data.role.id);
          setCreateOpen(false);
          toast.success("Rolle erstellt", { duration: 3000 });
        }}
      >
        <Input
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          placeholder="z. B. Regie"
          aria-label="Rollenname"
        />
      </ModalFormDialog>

      <ModalFormDialog
        open={Boolean(editRole)}
        onOpenChange={(open) => {
          if (!open) setEditRole(null);
        }}
        title="Rolle umbenennen"
        onSave={async () => {
          if (!editRole) return;
          const response = await fetch(`/api/permissions/roles/${editRole.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: roleName }),
          });
          if (!response.ok) {
            toast.error("Rolle konnte nicht umbenannt werden", { duration: 5000 });
            return;
          }
          setRoles((curr) =>
            curr.map((r) => (r.id === editRole.id ? { ...r, name: roleName } : r)),
          );
          setEditRole(null);
          toast.success("Rolle umbenannt", { duration: 3000 });
        }}
      >
        <Input
          value={roleName}
          onChange={(e) => setRoleName(e.target.value)}
          placeholder="Rollenname"
          aria-label="Rollenname"
        />
      </ModalFormDialog>

      <ConfirmDialog
        open={Boolean(deleteRole)}
        onOpenChange={(open) => {
          if (!open) setDeleteRole(null);
        }}
        title={`Rolle „${deleteRole ? roleLabel(deleteRole) : ""}“ löschen?`}
        description={
          deleteRole && memberCounts[deleteRole.id]
            ? `${countLabel(deleteRole)} verlieren damit die Rechte dieser Rolle.`
            : "Die Rolle ist keinem aktiven Mitglied zugewiesen."
        }
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setDeleteRole(null)}
        onConfirm={async () => {
          if (!deleteRole) return;
          const response = await fetch(`/api/permissions/roles/${deleteRole.id}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            toast.error("Rolle konnte nicht gelöscht werden", { duration: 5000 });
            return;
          }
          setRoles((curr) => curr.filter((r) => r.id !== deleteRole.id));
          setDeleteRole(null);
          toast.success("Rolle gelöscht", { duration: 3000 });
        }}
      />
    </div>
  );
}

export default PermissionWorkbenchClient;
