"use client";

import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
} from "@/components/ui/action-icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  PermissionWorkbenchPermission,
  PermissionWorkbenchRole,
  RoleGrantState,
} from "@/components/members/permissions/permission-workbench-client";

type RoleAdministrationPanelProps = {
  permissions: PermissionWorkbenchPermission[];
  roles: PermissionWorkbenchRole[];
  setRoles: Dispatch<SetStateAction<PermissionWorkbenchRole[]>>;
  roleGrants: RoleGrantState;
  setRoleGrants: Dispatch<SetStateAction<RoleGrantState>>;
};

const CATEGORY_ORDER = [
  "base",
  "rehearsal",
  "department",
  "pages",
  "admin",
  "public",
  "communication",
  "analytics",
];

const INITIAL_OPEN_SECTIONS: Record<string, boolean> = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, true]));

export function RoleAdministrationPanel({ permissions, roles, setRoles: _setRoles, roleGrants, setRoleGrants }: RoleAdministrationPanelProps) {
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(INITIAL_OPEN_SECTIONS);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const filteredByCategory = useMemo(() => {
    const term = search.trim().toLowerCase();
    const grouped = new Map<string, PermissionWorkbenchPermission[]>();

    for (const category of CATEGORY_ORDER) {
      grouped.set(category, []);
    }

    for (const permission of permissions) {
      const matches =
        term.length === 0 ||
        permission.label.toLowerCase().includes(term) ||
        permission.key.toLowerCase().includes(term);

      if (matches) {
        grouped.get(permission.categoryKey)?.push(permission);
      }
    }

    return grouped;
  }, [permissions, search]);

  const updateGrant = async (roleId: string, permissionKey: string, grant: boolean) => {
    const pendingKey = `${roleId}:${permissionKey}`;
    setPending((current) => ({ ...current, [pendingKey]: true }));

    setRoleGrants((current) => {
      const next = { ...current };
      const currentSet = new Set(next[roleId] ?? []);
      if (grant) {
        currentSet.add(permissionKey);
      } else {
        currentSet.delete(permissionKey);
      }
      next[roleId] = currentSet;
      return next;
    });

    try {
      const response = await fetch("/api/permissions/definitions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKey, roleId, grant }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Rechtezuweisung konnte nicht gespeichert werden.");
      }
    } catch (error) {
      setRoleGrants((current) => {
        const next = { ...current };
        const rollbackSet = new Set(next[roleId] ?? []);
        if (grant) {
          rollbackSet.delete(permissionKey);
        } else {
          rollbackSet.add(permissionKey);
        }
        next[roleId] = rollbackSet;
        return next;
      });

      toast.error("Rechtezuweisung fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Bitte versuche es erneut.",
        duration: 5000,
      });
    } finally {
      setPending((current) => {
        const next = { ...current };
        delete next[pendingKey];
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechte nach Name oder Key suchen…"
          className="pl-9"
          spellCheck={false}
        />
      </div>

      <div className="space-y-4">
        {CATEGORY_ORDER.map((category) => {
          const permissions = filteredByCategory.get(category) ?? [];
          if (permissions.length === 0) return null;

          const isSearchActive = search.trim().length > 0;
          const isOpen = isSearchActive ? true : (openSections[category] ?? true);

          return (
            <Collapsible
              key={category}
              open={isOpen}
              onOpenChange={(open) => {
                if (!isSearchActive) {
                  setOpenSections((current) => ({ ...current, [category]: open }));
                }
              }}
              className="rounded-lg border border-border bg-card"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                <span className="text-sm font-semibold text-foreground">{permissions.find((permission) => permission.categoryKey === category)?.categoryLabel ?? category}</span>
                {isOpen ? (
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronUpIcon className="size-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>

              <CollapsibleContent className="border-t border-border">
                <div className="space-y-3 p-3 sm:p-4">
                  {permissions.map((permission) => (
                    <div key={permission.key} className="rounded-lg border border-border bg-muted p-3">
                      <p className="text-sm font-medium text-foreground">{permission.label}</p>
                      <p className="text-xs text-muted-foreground">{permission.key}</p>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {roles.map((role) => {
                          const checked = roleGrants[role.id]?.has(permission.key) ?? false;
                          const pendingKey = `${role.id}:${permission.key}`;
                          const isPending = pending[pendingKey] ?? false;

                          return (
                            <label
                              key={role.id}
                              className={cn(
                                "flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2",
                                isPending && "opacity-70",
                              )}
                            >
                              <span className="text-sm text-foreground">{role.name}</span>
                              <Switch
                                checked={checked}
                                disabled={isPending}
                                onCheckedChange={(nextChecked) => {
                                  void updateGrant(role.id, permission.key, nextChecked);
                                }}
                                aria-label={`${role.name} für ${permission.label}`}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

export default RoleAdministrationPanel;
