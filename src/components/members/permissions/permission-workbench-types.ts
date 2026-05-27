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
