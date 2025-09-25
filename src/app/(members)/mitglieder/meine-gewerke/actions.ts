"use server";

import { revalidatePath } from "next/cache";
import { DepartmentMembershipRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const DEPARTMENT_MEMBER_ROLE_NAME = "department-member";
const DEPARTMENT_PERMISSION_KEY = "mitglieder.meine-gewerke";

async function ensureDepartmentMemberAppRole() {
  const [role, permission] = await Promise.all([
    prisma.appRole.upsert({
      where: { name: DEPARTMENT_MEMBER_ROLE_NAME },
      update: {},
      create: {
        name: DEPARTMENT_MEMBER_ROLE_NAME,
        isSystem: false,
      },
    }),
    prisma.permission.findUnique({ where: { key: DEPARTMENT_PERMISSION_KEY } }),
  ]);

  if (!permission) {
    throw new Error("Berechtigung für Gewerke konnte nicht gefunden werden.");
  }

  await prisma.appRolePermission.upsert({
    where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    update: {},
    create: { roleId: role.id, permissionId: permission.id },
  });

  return role.id;
}

export async function joinDepartmentAction(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error("Benutzer konnte nicht ermittelt werden.");
  }

  const departmentIdValue = formData.get("departmentId");
  if (typeof departmentIdValue !== "string" || !departmentIdValue.trim()) {
    throw new Error("Ungültiges Gewerk ausgewählt.");
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentIdValue },
    select: { id: true, requiresJoinApproval: true },
  });

  if (!department) {
    throw new Error("Das ausgewählte Gewerk existiert nicht mehr.");
  }

  if (department.requiresJoinApproval) {
    throw new Error("Dieses Gewerk benötigt eine Zustimmung durch die Leitung.");
  }

  await prisma.departmentMembership.upsert({
    where: { departmentId_userId: { departmentId: department.id, userId } },
    update: {},
    create: {
      departmentId: department.id,
      userId,
      role: DepartmentMembershipRole.member,
    },
  });

  const appRoleId = await ensureDepartmentMemberAppRole();

  await prisma.userAppRole.upsert({
    where: { userId_roleId: { userId, roleId: appRoleId } },
    update: {},
    create: { userId, roleId: appRoleId },
  });

  revalidatePath("/mitglieder", "layout");
  revalidatePath("/mitglieder");
  revalidatePath("/mitglieder/meine-gewerke");
  revalidatePath("/mitglieder/meine-gewerke/todos");
}
