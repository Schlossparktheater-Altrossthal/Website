"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDownIcon, ChevronUpIcon, SearchIcon } from "@/components/ui/action-icons";
import type {
  DepartmentGrantState,
  PermissionWorkbenchDepartment,
  PermissionWorkbenchPermission,
  PermissionWorkbenchRole,
  RoleGrantState,
} from "@/components/members/permissions/permission-workbench-client";
import { ROLE_LABELS } from "@/lib/roles";

type PermissionExplorerProps = {
  permissions: PermissionWorkbenchPermission[];
  systemRoles: PermissionWorkbenchRole[];
  roles: PermissionWorkbenchRole[];
  departments: PermissionWorkbenchDepartment[];
  roleGrants: RoleGrantState;
  departmentGrants: DepartmentGrantState;
  setRoleGrants: React.Dispatch<React.SetStateAction<RoleGrantState>>;
  setDepartmentGrants: React.Dispatch<React.SetStateAction<DepartmentGrantState>>;
};

const CATEGORY_ORDER = ["base", "rehearsal", "department", "pages", "admin", "public", "communication", "analytics"] as const;

const PERMISSION_CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  base: "Allgemeines",
  rehearsal: "Proben",
  department: "Gewerke",
  pages: "Pages",
  admin: "Verwaltung",
  public: "Öffentliche Seiten",
  communication: "Kommunikation",
  analytics: "Analysen",
};

export function PermissionExplorer({ permissions, roles, systemRoles }: PermissionExplorerProps) {
  const [activeTab, setActiveTab] = useState("permissions");
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const groupedPermissions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return CATEGORY_ORDER
      .map((categoryKey) => {
        const entries = permissions.filter((permission) => {
          if (permission.categoryKey !== categoryKey) return false;
          if (!term) return true;
          return [permission.label, permission.key, permission.categoryLabel]
            .map((value) => value.toLowerCase())
            .some((value) => value.includes(term));
        });
        return {
          categoryKey,
          categoryLabel: PERMISSION_CATEGORY_LABELS[categoryKey],
          permissions: entries,
        };
      })
      .filter((group) => group.permissions.length > 0);
  }, [permissions, searchTerm]);

  const hasActiveSearch = searchTerm.trim().length > 0;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="permissions">Rechte ({permissions.length})</TabsTrigger>
        <TabsTrigger value="roles">Rollen ({roles.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="permissions" className="space-y-4">
        <div className="relative max-w-xl">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechte durchsuchen…"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Rechte durchsuchen"
            className="pl-9"
          />
        </div>

        {groupedPermissions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Keine Rechte passen zu deiner Suche.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedPermissions.map((group) => {
              const isCollapsed = collapsedCategories[group.categoryKey] ?? false;
              const isOpen = hasActiveSearch ? true : !isCollapsed;
              return (
                <Collapsible
                  key={group.categoryKey}
                  open={isOpen}
                  onOpenChange={(nextOpen) => {
                    if (hasActiveSearch) return;
                    setCollapsedCategories((current) => ({
                      ...current,
                      [group.categoryKey]: !nextOpen,
                    }));
                  }}
                  className="rounded-lg border border-border bg-card"
                >
                  <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3 text-left">
                    <span className="font-medium">{group.categoryLabel}</span>
                    {isOpen ? (
                      <ChevronDownIcon className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronUpIcon className="size-4 text-muted-foreground" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="space-y-1 border-t border-border px-4 py-3">
                      {group.permissions.map((permission) => (
                        <li key={permission.id} className="rounded-md bg-muted/40 px-3 py-2">
                          <p className="text-sm font-medium">{permission.label}</p>
                          <p className="text-xs text-muted-foreground">{permission.key}</p>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="roles" className="space-y-4">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Systemrollen</h3>
          <div className="flex flex-wrap gap-2">
            {systemRoles.length === 0 ? (
              <Badge variant="muted" size="sm">Keine Systemrollen registriert.</Badge>
            ) : (
              systemRoles.map((role) => {
                const label = role.systemRole
                  ? ROLE_LABELS[role.systemRole as keyof typeof ROLE_LABELS] ?? role.name
                  : role.name;
                return (
                  <Badge key={role.id} variant="muted" size="sm" className="font-medium">
                    {label}
                  </Badge>
                );
              })
            )}
          </div>
        </section>
      </TabsContent>
    </Tabs>
  );
}

export default PermissionExplorer;
