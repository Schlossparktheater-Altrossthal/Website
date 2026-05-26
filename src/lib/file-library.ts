import { cache } from "react";

import {
  FileLibraryAccessTargetType,
  FileLibraryAccessType,
  type FileLibraryFolder,
  type FileLibraryFolderAccess,
  type FileLibraryItem,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getPermissionRoleContext, type PermissionRoleContext } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

export {
  FILE_LIBRARY_ACCEPT_MIME_TYPES,
  MAX_FILE_LIBRARY_FILE_BYTES,
  MAX_FILE_LIBRARY_FILES_PER_UPLOAD,
  MAX_FILE_LIBRARY_DESCRIPTION_LENGTH,
  formatFileLibraryFileSize,
} from "@/lib/file-library-constants";

export type FileLibraryAccessKind = "view" | "download" | "upload";

const ACCESS_KIND_TO_ENUM: Record<FileLibraryAccessKind, FileLibraryAccessType> = {
  view: FileLibraryAccessType.VIEW,
  download: FileLibraryAccessType.DOWNLOAD,
  upload: FileLibraryAccessType.UPLOAD,
};

export type FileLibraryFolderWithAccess = FileLibraryFolder & {
  accessRules: FileLibraryFolderAccess[];
};

export type FileLibraryItemSummary = Pick<
  FileLibraryItem,
  "id" | "fileName" | "fileSize" | "mimeType" | "description" | "uploadedById" | "createdAt" | "updatedAt"
> & {
  uploadedBy?: {
    id: string | null;
    name: string | null;
    email: string | null;
  } | null;
};

export type FileLibraryAccessContext = PermissionRoleContext & {
  canManage: boolean;
};

function getAllowAllFlag(folder: FileLibraryFolder, kind: FileLibraryAccessKind) {
  switch (kind) {
    case "view":
      return folder.allowAllView;
    case "download":
      return folder.allowAllDownload;
    case "upload":
      return folder.allowAllUpload;
    default:
      return false;
  }
}

function matchesAccessRule(
  context: PermissionRoleContext,
  rule: FileLibraryFolderAccess,
) {
  if (rule.targetType === FileLibraryAccessTargetType.SYSTEM_ROLE && rule.systemRole) {
    return context.systemRoles.includes(rule.systemRole as Role);
  }
  if (rule.targetType === FileLibraryAccessTargetType.APP_ROLE && rule.appRoleId) {
    return context.customRoleIds.includes(rule.appRoleId);
  }
  return false;
}

export const resolveFileLibraryAccessContext = cache(async (user: { id?: string | null }) => {
  const userLike = user?.id != null ? { id: user.id } : null;
  const baseContext = await getPermissionRoleContext(userLike);
  return { ...baseContext, canManage: false } satisfies FileLibraryAccessContext;
});

export async function userHasFileLibraryAccess(
  user: { id?: string | null },
  folder: FileLibraryFolderWithAccess,
  kind: FileLibraryAccessKind,
  context?: FileLibraryAccessContext,
) {
  if (!user?.id) return false;
  const resolved = context ?? (await resolveFileLibraryAccessContext(user));

  if (resolved.canManage) {
    return true;
  }

  const allowAll = getAllowAllFlag(folder, kind);
  if (allowAll) {
    return true;
  }

  const targetType = ACCESS_KIND_TO_ENUM[kind];
  const relevantRules = folder.accessRules.filter((entry) => entry.accessType === targetType);
  if (!relevantRules.length) {
    return false;
  }

  return relevantRules.some((rule) => matchesAccessRule(resolved, rule));
}

export async function getFolderBreadcrumb(folderId: string) {
  const breadcrumbs: { id: string; name: string }[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const folder: { id: string; name: string; parentId: string | null } | null =
      await prisma.fileLibraryFolder.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });
    if (!folder) break;
    breadcrumbs.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parentId;
  }

  return breadcrumbs;
}

export async function loadFolderWithDetails(folderId: string) {
  return prisma.fileLibraryFolder.findUnique({
    where: { id: folderId },
    include: {
      accessRules: true,
      files: { select: { id: true, fileSize: true, createdAt: true } },
      children: {
        orderBy: { name: "asc" },
        include: {
          accessRules: true,
          files: { select: { id: true, fileSize: true, createdAt: true } },
        },
      },
    },
  });
}

export async function loadFolderItems(folderId: string) {
  return prisma.fileLibraryItem.findMany({
    where: { folderId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      uploadedById: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export type FolderStats = {
  fileCount: number;
  totalSize: number;
  latestUpload: Date | null;
};

export function computeFolderStats(items: FileLibraryItemSummary[]): FolderStats {
  if (!items.length) {
    return { fileCount: 0, totalSize: 0, latestUpload: null };
  }

  let totalSize = 0;
  let latest: Date | null = null;

  for (const item of items) {
    totalSize += item.fileSize;
    const created = new Date(item.createdAt);
    if (!latest || created > latest) {
      latest = created;
    }
  }

  return { fileCount: items.length, totalSize, latestUpload: latest };
}
