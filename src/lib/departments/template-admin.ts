import type { DepartmentMembershipRole } from "@prisma/client";

import { normalizeModules, type DepartmentModuleKey } from "@/lib/departments/modules";
import { DEFAULT_PERMISSION_DEFINITIONS, PERMISSION_CATEGORY_LABELS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CURRENT_PRODUCTION_STATUSES } from "@/lib/produktionen/status";

export const TEMPLATE_ROLES: { value: DepartmentMembershipRole; label: string }[] = [
  { value: "lead", label: "Leitung" },
  { value: "deputy", label: "Vertretung" },
  { value: "member", label: "Mitglied" },
  { value: "guest", label: "Gast" },
];

export type TemplateAdminEntry = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  modules: DepartmentModuleKey[];
  requiresJoinApproval: boolean;
  onboardingVisible: boolean;
  onboardingDescription: string | null;
  preferenceCodes: string[];
  archived: boolean;
  /** Aktive Gewerke dieser Blaupause in laufenden Produktionen. */
  departments: { id: string; name: string; production: string }[];
  /** Standardrechte je Rolle. */
  grants: Record<DepartmentMembershipRole, string[]>;
};

export type TemplatePermissionGroup = {
  label: string;
  permissions: { key: string; label: string; description: string | null }[];
};

export async function loadTemplateAdminData(): Promise<{
  templates: TemplateAdminEntry[];
  permissionGroups: TemplatePermissionGroup[];
}> {
  const templates = await prisma.departmentTemplate.findMany({
    orderBy: [
      { archivedAt: { sort: "desc", nulls: "first" } },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    include: {
      permissions: { select: { role: true, permission: { select: { key: true } } } },
      departments: {
        where: { archivedAt: null, show: { status: { in: [...CURRENT_PRODUCTION_STATUSES] } } },
        select: { id: true, name: true, show: { select: { title: true, year: true } } },
      },
    },
  });

  const groups = new Map<string, TemplatePermissionGroup>();
  for (const definition of DEFAULT_PERMISSION_DEFINITIONS) {
    const label = PERMISSION_CATEGORY_LABELS[definition.category] ?? definition.category;
    const group = groups.get(label) ?? { label, permissions: [] };
    group.permissions.push({
      key: definition.key,
      label: definition.label,
      description: definition.description ?? null,
    });
    groups.set(label, group);
  }

  return {
    templates: templates.map((template) => {
      const grants: TemplateAdminEntry["grants"] = { lead: [], deputy: [], member: [], guest: [] };
      for (const grant of template.permissions) grants[grant.role].push(grant.permission.key);
      return {
        id: template.id,
        slug: template.slug,
        name: template.name,
        description: template.description,
        color: template.color,
        icon: template.icon,
        modules: normalizeModules(template.modules),
        requiresJoinApproval: template.requiresJoinApproval,
        onboardingVisible: template.onboardingVisible,
        onboardingDescription: template.onboardingDescription,
        preferenceCodes: template.preferenceCodes,
        archived: Boolean(template.archivedAt),
        departments: template.departments.map((department) => ({
          id: department.id,
          name: department.name,
          production: department.show.title ?? String(department.show.year),
        })),
        grants,
      };
    }),
    // Gewerk-Rechte zuerst, sie sind für Blaupausen am häufigsten gemeint.
    permissionGroups: [...groups.values()].sort(
      (a, b) =>
        Number(b.label === PERMISSION_CATEGORY_LABELS.department) -
        Number(a.label === PERMISSION_CATEGORY_LABELS.department),
    ),
  };
}
