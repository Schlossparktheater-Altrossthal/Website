"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionExplorer } from "@/components/members/permissions/permission-explorer";
import { RoleAdministrationPanel } from "@/components/members/permissions/role-administration-panel";

export type PermissionWorkbenchPermission = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  categoryKey: string;
  categoryLabel: string;
};

export type PermissionWorkbenchRole = {
  id: string;
  name: string;
  isSystem: boolean;
  systemRole: string | null;
  sortIndex: number;
};

export type PermissionWorkbenchDepartment = {
  id: string;
  name: string;
  slug: string | null;
  requiresJoinApproval: boolean;
};

export type RoleGrantState = Record<string, Set<string>>;
export type DepartmentGrantState = Record<string, Set<string>>;

function toGrantState(record: Record<string, string[]>): Record<string, Set<string>> {
  const next: Record<string, Set<string>> = {};
  for (const [targetId, values] of Object.entries(record)) {
    next[targetId] = new Set(values);
  }
  return next;
}

export type PermissionWorkbenchClientProps = {
  permissions: PermissionWorkbenchPermission[];
  roles: PermissionWorkbenchRole[];
  systemRoles: PermissionWorkbenchRole[];
  departments: PermissionWorkbenchDepartment[];
  roleGrants: Record<string, string[]>;
  departmentGrants: Record<string, string[]>;
};

export function PermissionWorkbenchClient({
  permissions,
  roles: initialRoles,
  systemRoles,
  departments: initialDepartments,
  roleGrants: initialRoleGrants,
  departmentGrants: initialDepartmentGrants,
}: PermissionWorkbenchClientProps) {
  const [roles, setRoles] = useState<PermissionWorkbenchRole[]>(initialRoles);
  const departments = initialDepartments;
  const [roleGrants, setRoleGrants] = useState<RoleGrantState>(() => toGrantState(initialRoleGrants));
  const [departmentGrants, setDepartmentGrants] = useState<DepartmentGrantState>(() =>
    toGrantState(initialDepartmentGrants),
  );
  const [activeTab, setActiveTab] = useState("permissions");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="permissions">Rechte ({permissions.length})</TabsTrigger>
        <TabsTrigger value="roles">Rollen ({roles.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="permissions" className="space-y-6">
        <PermissionExplorer
          permissions={permissions}
          systemRoles={systemRoles}
          roles={roles}
          departments={departments}
          roleGrants={roleGrants}
          departmentGrants={departmentGrants}
          setRoleGrants={setRoleGrants}
          setDepartmentGrants={setDepartmentGrants}
        />
      </TabsContent>
      <TabsContent value="roles">
        <RoleAdministrationPanel
          roles={roles}
          setRoles={setRoles}
          roleGrants={roleGrants}
          setRoleGrants={setRoleGrants}
        />
      </TabsContent>
    </Tabs>
  );
}

export default PermissionWorkbenchClient;
