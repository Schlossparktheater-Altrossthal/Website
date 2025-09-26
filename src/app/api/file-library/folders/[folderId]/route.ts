import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import {
  MAX_FILE_LIBRARY_DESCRIPTION_LENGTH,
  MAX_FILE_LIBRARY_FILE_BYTES,
  MAX_FILE_LIBRARY_FILES_PER_UPLOAD,
  resolveFileLibraryAccessContext,
  userHasFileLibraryAccess,
} from "@/lib/file-library";
import { revalidatePath } from "next/cache";

function isFileLike(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number"
  );
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_FILE_LIBRARY_DESCRIPTION_LENGTH);
}

function sanitizeFilename(name: string) {
  const fallback = "datei";
  const trimmed = name?.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 160) || fallback;
}

export async function POST(request: NextRequest, context: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await context.params;
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const currentUser = session.user ?? { id: null };

  const [canAccessArea, folder] = await Promise.all([
    hasPermission(session.user, "mitglieder.dateisystem"),
    prisma.fileLibraryFolder.findUnique({
      where: { id: folderId },
      include: { accessRules: true },
    }),
  ]);

  if (!canAccessArea || !folder) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const accessContext = await resolveFileLibraryAccessContext(currentUser);
  const canUpload = await userHasFileLibraryAccess(currentUser, folder, "upload", accessContext);

  if (!canUpload) {
    return NextResponse.json({ error: "Keine Berechtigung zum Hochladen" }, { status: 403 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter(isFileLike) as File[];
  const descriptionEntries = formData.getAll("descriptions").map((entry) =>
    typeof entry === "string" ? entry : "",
  );

  if (!files.length) {
    return NextResponse.json({ error: "Bitte wähle mindestens eine Datei aus." }, { status: 400 });
  }

  if (files.length > MAX_FILE_LIBRARY_FILES_PER_UPLOAD) {
    return NextResponse.json(
      { error: `Es können maximal ${MAX_FILE_LIBRARY_FILES_PER_UPLOAD} Dateien auf einmal hochgeladen werden.` },
      { status: 400 },
    );
  }

  const payloads: { file: File; description: string | null; fileName: string; mimeType: string }[] = [];
  const errors: string[] = [];

  files.forEach((file, index) => {
    if (file.size <= 0) {
      errors.push(`${file.name || "Unbenannte Datei"}: Datei ist leer.`);
      return;
    }
    if (file.size > MAX_FILE_LIBRARY_FILE_BYTES) {
      errors.push(
        `${file.name || "Unbenannte Datei"}: Datei ist zu groß (maximal ${Math.floor(MAX_FILE_LIBRARY_FILE_BYTES / (1024 * 1024))} MB).`,
      );
      return;
    }

    const description = normalizeDescription(descriptionEntries[index]);
    const fileName = sanitizeFilename(file.name || "datei");
    const mimeType = file.type?.trim() || "application/octet-stream";

    payloads.push({ file, description, fileName, mimeType });
  });

  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  try {
    const created = await Promise.all(
      payloads.map(async ({ file, description, fileName, mimeType }) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return prisma.fileLibraryItem.create({
          data: {
            folderId,
            description,
            fileName,
            mimeType,
            fileSize: buffer.length,
            data: buffer,
            uploadedById: userId,
          },
          include: { uploadedBy: { select: { id: true, name: true, email: true } } },
        });
      }),
    );

    const items = created.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      description: item.description ?? null,
      createdAt: item.createdAt.toISOString(),
      uploadedBy: item.uploadedBy
        ? { id: item.uploadedBy.id, name: item.uploadedBy.name, email: item.uploadedBy.email }
        : null,
      downloadUrl: `/api/file-library/items/${item.id}/file`,
      canDelete: true,
    }));

    revalidatePath(`/mitglieder/dateisystem/${folderId}`);
    revalidatePath("/mitglieder/dateisystem");

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[file-library] upload", error);
    return NextResponse.json(
      { error: "Upload fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 },
    );
  }
}
