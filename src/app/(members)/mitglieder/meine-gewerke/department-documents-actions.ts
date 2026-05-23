"use server";

import { Buffer } from "node:buffer";

import { revalidatePath } from "next/cache";
import { DepartmentMembershipRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

type ReadOptions = {
  minLength?: number;
  maxLength?: number;
  label?: string;
};

function isString(value: FormDataEntryValue | null | undefined): value is string {
  return typeof value === "string";
}

function readString(formData: FormData, key: string, options?: ReadOptions): string {
  const raw = formData.get(key);
  if (!isString(raw)) {
    throw new Error(`${options?.label ?? key} fehlt.`);
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${options?.label ?? key} fehlt.`);
  }
  if (options?.minLength && trimmed.length < options.minLength) {
    throw new Error(
      `${options?.label ?? key} muss mindestens ${options.minLength} Zeichen enthalten.`,
    );
  }
  if (options?.maxLength && trimmed.length > options.maxLength) {
    throw new Error(
      `${options?.label ?? key} darf höchstens ${options.maxLength} Zeichen enthalten.`,
    );
  }
  return trimmed;
}

function readOptionalString(formData: FormData, key: string, options?: ReadOptions) {
  const raw = formData.get(key);
  if (!isString(raw)) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (options?.minLength && trimmed.length < options.minLength) {
    throw new Error(
      `${options?.label ?? key} muss mindestens ${options.minLength} Zeichen enthalten.`,
    );
  }
  if (options?.maxLength && trimmed.length > options.maxLength) {
    throw new Error(
      `${options?.label ?? key} darf höchstens ${options.maxLength} Zeichen enthalten.`,
    );
  }
  return trimmed;
}

const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "application/msword", "application/vnd."];

function sanitizeFileName(name: string | undefined | null) {
  const fallback = "dokument";
  if (!name) return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;
  if (trimmed.length > 160) {
    return trimmed.slice(0, 160);
  }
  return trimmed;
}

function ensureAllowedType(file: File) {
  if (!file.type) return false;
  return ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
}

export async function uploadDepartmentDocumentAction(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error("Nicht autorisiert.");
  }

  const departmentId = readString(formData, "departmentId", { label: "Gewerk" });
  const redirectPath = readOptionalString(formData, "redirectPath", { label: "Seite" }) ??
    "/mitglieder/meine-gewerke";

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!files.length) {
    throw new Error("Bitte wähle mindestens eine Datei aus.");
  }

  const canManageByPermission = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
  let canManage = canManageByPermission;
  if (!canManage) {
    const membership = await prisma.departmentMembership.findFirst({
      where: { departmentId, userId },
      select: { role: true },
    });
    canManage = Boolean(
      membership &&
        (membership.role === DepartmentMembershipRole.lead ||
          membership.role === DepartmentMembershipRole.deputy),
    );
  }
  if (!canManage) {
    throw new Error("Keine Berechtigung zum Hochladen.");
  }

  const errors: string[] = [];
  const payloads: { file: File; buffer: Buffer }[] = [];

  for (const file of files) {
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      errors.push(
        `${file.name || "Datei"}: Datei ist zu groß (maximal ${Math.floor(
          MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024),
        )} MB).`,
      );
      continue;
    }

    if (!ensureAllowedType(file)) {
      errors.push(`${file.name || "Datei"}: Dateityp wird nicht unterstützt.`);
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    payloads.push({ file, buffer });
  }

  if (!payloads.length) {
    throw new Error(errors.join(" ") || "Keine gültigen Dateien ausgewählt.");
  }

  await prisma.$transaction(async (tx) => {
    for (const { file, buffer } of payloads) {
      await tx.departmentDocument.create({
        data: {
          departmentId,
          fileName: sanitizeFileName(file.name),
          mimeType: file.type || "application/octet-stream",
          fileSize: buffer.length,
          data: buffer,
          uploadedById: userId,
        },
      });
    }
  });

  revalidatePath(redirectPath);
}

export async function deleteDepartmentDocumentAction(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error("Nicht autorisiert.");
  }

  const documentId = readString(formData, "documentId", { label: "Dokument" });
  const redirectPath = readOptionalString(formData, "redirectPath", { label: "Seite" }) ??
    "/mitglieder/meine-gewerke";

  const document = await prisma.departmentDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      departmentId: true,
      uploadedById: true,
    },
  });

  if (!document) {
    throw new Error("Dokument wurde nicht gefunden.");
  }

  const canManageByPermission = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
  let canManage = canManageByPermission;
  if (!canManage) {
    const membership = await prisma.departmentMembership.findFirst({
      where: { departmentId: document.departmentId, userId },
      select: { role: true },
    });
    canManage = Boolean(
      membership &&
        (membership.role === DepartmentMembershipRole.lead ||
          membership.role === DepartmentMembershipRole.deputy),
    );
  }
  const isOwner = document.uploadedById === userId;
  if (!canManage && !isOwner) {
    throw new Error("Keine Berechtigung zum Löschen.");
  }

  await prisma.departmentDocument.delete({ where: { id: documentId } });

  revalidatePath(redirectPath);
}
