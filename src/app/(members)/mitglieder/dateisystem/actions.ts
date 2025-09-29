"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { ROLES, type Role } from "@/lib/roles";
import {
  FileLibraryAccessTargetType,
  FileLibraryAccessType,
  type Prisma,
} from "@prisma/client";

const folderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Bitte gib einen Namen mit mindestens 2 Zeichen ein.")
    .max(120),
  description: z.string().trim().max(500).optional(),
  parentId: z.string().trim().min(1).optional(),
});

function parseCheckboxArray(values: FormDataEntryValue[]): string[] {
  const entries: string[] = [];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      entries.push(value.trim());
    }
  }
  return Array.from(new Set(entries));
}

function normalizeSystemRoles(values: FormDataEntryValue[]): Role[] {
  const normalized = parseCheckboxArray(values);
  const allowed = new Set<Role>(ROLES);
  return normalized.filter((value): value is Role => allowed.has(value as Role));
}

async function filterValidAppRoleIds(ids: string[]) {
  if (!ids.length) return [] as string[];
  const rows = await prisma.appRole.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const allowed = new Set(rows.map((row) => row.id));
  return ids.filter((id) => allowed.has(id));
}

async function collectFolderHierarchyIds(
  client: Prisma.TransactionClient,
  rootFolderId: string,
) {
  const collected = new Set<string>([rootFolderId]);
  let currentLevel: string[] = [rootFolderId];

  while (currentLevel.length) {
    const children = await client.fileLibraryFolder.findMany({
      where: { parentId: { in: currentLevel } },
      select: { id: true },
    });

    if (!children.length) {
      break;
    }

    const nextLevel: string[] = [];
    for (const child of children) {
      if (!collected.has(child.id)) {
        collected.add(child.id);
        nextLevel.push(child.id);
      }
    }

    currentLevel = nextLevel;
  }

  return Array.from(collected);
}

export async function createFileLibraryFolder(formData: FormData) {
  const session = await requireAuth();
  const canManage = await hasPermission(session.user, "mitglieder.dateisystem.manage");
  if (!canManage) {
    throw new Error("Keine Berechtigung");
  }

  const parsed = folderSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    parentId: formData.get("parentId") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Eingabe ungültig");
  }

  const data = parsed.data;
  const parentId = data.parentId?.trim() || null;

  if (parentId) {
    const parentExists = await prisma.fileLibraryFolder.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parentExists) {
      throw new Error("Übergeordneter Ordner wurde nicht gefunden.");
    }
  }

  const folder = await prisma.fileLibraryFolder.create({
    data: {
      name: data.name,
      description: data.description?.trim() || null,
      parentId,
      createdById: session.user?.id ?? null,
    },
    select: { id: true },
  });

  const basePath = "/mitglieder/dateisystem";
  if (parentId) {
    revalidatePath(`${basePath}/${parentId}`);
  }
  revalidatePath(basePath);

  redirect(`${basePath}/${folder.id}`);
}

export async function updateFileLibraryPermissions(formData: FormData) {
  const session = await requireAuth();
  const canManage = await hasPermission(session.user, "mitglieder.dateisystem.manage");
  if (!canManage) {
    throw new Error("Keine Berechtigung");
  }

  const rawFolderId = formData.get("folderId");
  const folderId = typeof rawFolderId === "string" ? rawFolderId.trim() : "";
  if (!folderId) {
    throw new Error("Ordnerkennung fehlt");
  }

  const folder = await prisma.fileLibraryFolder.findUnique({
    where: { id: folderId },
    select: { id: true },
  });

  if (!folder) {
    throw new Error("Ordner nicht gefunden");
  }

  const allowAllView = Boolean(formData.get("allowAllView"));
  const allowAllDownload = Boolean(formData.get("allowAllDownload"));
  const allowAllUpload = Boolean(formData.get("allowAllUpload"));

  const viewSystemRoles = normalizeSystemRoles(formData.getAll("viewSystemRoles"));
  const downloadSystemRoles = normalizeSystemRoles(formData.getAll("downloadSystemRoles"));
  const uploadSystemRoles = normalizeSystemRoles(formData.getAll("uploadSystemRoles"));

  const viewAppRoles = await filterValidAppRoleIds(parseCheckboxArray(formData.getAll("viewAppRoles")));
  const downloadAppRoles = await filterValidAppRoleIds(parseCheckboxArray(formData.getAll("downloadAppRoles")));
  const uploadAppRoles = await filterValidAppRoleIds(parseCheckboxArray(formData.getAll("uploadAppRoles")));

  await prisma.$transaction(async (tx) => {
    await tx.fileLibraryFolder.update({
      where: { id: folderId },
      data: {
        allowAllView,
        allowAllDownload,
        allowAllUpload,
      },
    });

    const configurations: {
      accessType: FileLibraryAccessType;
      allowAll: boolean;
      systemRoles: Role[];
      appRoles: string[];
    }[] = [
      {
        accessType: FileLibraryAccessType.VIEW,
        allowAll: allowAllView,
        systemRoles: viewSystemRoles,
        appRoles: viewAppRoles,
      },
      {
        accessType: FileLibraryAccessType.DOWNLOAD,
        allowAll: allowAllDownload,
        systemRoles: downloadSystemRoles,
        appRoles: downloadAppRoles,
      },
      {
        accessType: FileLibraryAccessType.UPLOAD,
        allowAll: allowAllUpload,
        systemRoles: uploadSystemRoles,
        appRoles: uploadAppRoles,
      },
    ];

    for (const config of configurations) {
      await tx.fileLibraryFolderAccess.deleteMany({
        where: { folderId, accessType: config.accessType },
      });

      if (config.allowAll) {
        continue;
      }

      const entries = [
        ...config.systemRoles.map((role) => ({
          folderId,
          accessType: config.accessType,
          targetType: FileLibraryAccessTargetType.SYSTEM_ROLE,
          systemRole: role,
          appRoleId: null,
        })),
        ...config.appRoles.map((roleId) => ({
          folderId,
          accessType: config.accessType,
          targetType: FileLibraryAccessTargetType.APP_ROLE,
          systemRole: null,
          appRoleId: roleId,
        })),
      ];

      if (entries.length) {
        await tx.fileLibraryFolderAccess.createMany({ data: entries });
      }
    }
  });

  const basePath = "/mitglieder/dateisystem";
  revalidatePath(basePath);
  revalidatePath(`${basePath}/${folderId}`);
}

export async function deleteFileLibraryFolder(formData: FormData) {
  const session = await requireAuth();
  const canManage = await hasPermission(session.user, "mitglieder.dateisystem.manage");
  if (!canManage) {
    throw new Error("Keine Berechtigung");
  }

  const rawFolderId = formData.get("folderId");
  const folderId = typeof rawFolderId === "string" ? rawFolderId.trim() : "";
  if (!folderId) {
    throw new Error("Ordnerkennung fehlt");
  }

  const folder = await prisma.fileLibraryFolder.findUnique({
    where: { id: folderId },
    select: { id: true, parentId: true },
  });

  if (!folder) {
    throw new Error("Ordner nicht gefunden");
  }

  let removedFolderIds: string[] = [];
  try {
    removedFolderIds = await prisma.$transaction(async (tx) => {
      const ids = await collectFolderHierarchyIds(tx, folderId);

      await tx.fileLibraryItem.deleteMany({ where: { folderId: { in: ids } } });
      await tx.fileLibraryFolderAccess.deleteMany({ where: { folderId: { in: ids } } });
      const deletedFolders = await tx.fileLibraryFolder.deleteMany({ where: { id: { in: ids } } });

      if (deletedFolders.count === 0) {
        throw new Error("FOLDER_NOT_FOUND");
      }

      return ids;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FOLDER_NOT_FOUND") {
      throw new Error("Ordner wurde bereits entfernt.");
    }
    console.error("[file-library] delete-folder", error);
    throw new Error("Ordner konnte nicht gelöscht werden. Bitte versuche es erneut.");
  }

  const basePath = "/mitglieder/dateisystem";
  revalidatePath(basePath);
  for (const id of removedFolderIds) {
    revalidatePath(`${basePath}/${id}`);
  }

  if (folder.parentId) {
    revalidatePath(`${basePath}/${folder.parentId}`);
    redirect(`${basePath}/${folder.parentId}`);
  }

  redirect(basePath);
}
