import { NextRequest, NextResponse } from "next/server";

import { GalleryMediaType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_GALLERY_DESCRIPTION_LENGTH,
  MAX_GALLERY_FILE_BYTES,
  MAX_GALLERY_FILES_PER_UPLOAD,
  isValidGalleryYear,
  resolveGalleryMediaKind,
  sanitizeGalleryFilename,
} from "@/lib/gallery";

const IMAGE_ACCEPTED_MIME_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);
const VIDEO_ACCEPTED_MIME_SET = new Set<string>(ALLOWED_VIDEO_MIME_TYPES);

const EXTENSION_MIME_FALLBACK: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
};

function isFileLike(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number"
  );
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, MAX_GALLERY_DESCRIPTION_LENGTH);
}

function inferMimeType(fileName: string, kind: "image" | "video", provided?: string | null): string {
  const normalized = provided?.trim();
  if (normalized) {
    return normalized;
  }
  const lowered = fileName.trim().toLowerCase();
  const dotIndex = lowered.lastIndexOf(".");
  if (dotIndex !== -1) {
    const extension = lowered.slice(dotIndex);
    const fallback = EXTENSION_MIME_FALLBACK[extension];
    if (fallback) {
      return fallback;
    }
  }
  return kind === "image" ? "image/jpeg" : "video/mp4";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ year: string }> },
) {
  const { year: yearParam } = await context.params;
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const [canView, canUpload] = await Promise.all([
    hasPermission(session.user, "mitglieder.galerie"),
    hasPermission(session.user, "mitglieder.galerie.upload"),
  ]);

  if (!canView || !canUpload) {
    return NextResponse.json({ error: "Keine Berechtigung zum Hochladen" }, { status: 403 });
  }

  const parsedYear = Number.parseInt(yearParam ?? "", 10);
  if (!isValidGalleryYear(parsedYear)) {
    return NextResponse.json({ error: "Ungültiger Ordner" }, { status: 400 });
  }

  const formData = await request.formData();
  const fileEntries = formData.getAll("files").filter(isFileLike) as File[];
  const descriptionEntries = formData.getAll("descriptions").map((entry) =>
    typeof entry === "string" ? entry : "",
  );

  const files = fileEntries.filter((file) => file.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "Bitte wähle mindestens eine Datei aus." }, { status: 400 });
  }

  if (files.length > MAX_GALLERY_FILES_PER_UPLOAD) {
    return NextResponse.json(
      {
        error: `Es können maximal ${MAX_GALLERY_FILES_PER_UPLOAD} Dateien auf einmal hochgeladen werden.`,
      },
      { status: 400 },
    );
  }

  const errors: string[] = [];
  const payloads: {
    file: File;
    description: string | null;
    kind: "image" | "video";
    mimeType: string;
    fileName: string;
  }[] = [];

  files.forEach((file, index) => {
    const kind = resolveGalleryMediaKind(file.type, file.name);
    if (!kind) {
      errors.push(`${file.name}: Dateityp wird nicht unterstützt.`);
      return;
    }

    if (file.size > MAX_GALLERY_FILE_BYTES) {
      errors.push(
        `${file.name}: Datei ist zu groß (maximal ${Math.floor(MAX_GALLERY_FILE_BYTES / (1024 * 1024))} MB).`,
      );
      return;
    }

    const normalizedMime = file.type?.trim().toLowerCase();
    if (normalizedMime) {
      if (kind === "image" && !IMAGE_ACCEPTED_MIME_SET.has(normalizedMime)) {
        errors.push(`${file.name}: Bildformat ${normalizedMime} wird nicht unterstützt.`);
        return;
      }
      if (kind === "video" && !VIDEO_ACCEPTED_MIME_SET.has(normalizedMime)) {
        errors.push(`${file.name}: Videoformat ${normalizedMime} wird nicht unterstützt.`);
        return;
      }
    }

    const description = normalizeDescription(descriptionEntries[index]);
    const fileName = sanitizeGalleryFilename(file.name || "datei");
    const mimeType = inferMimeType(file.name || "datei", kind, normalizedMime);

    payloads.push({ file, description, kind, mimeType, fileName });
  });

  if (errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  try {
    const created = await Promise.all(
      payloads.map(async ({ file, description, kind, mimeType, fileName }) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return prisma.galleryItem.create({
          data: {
            year: parsedYear,
            description,
            fileName,
            mimeType,
            fileSize: buffer.length,
            mediaType: kind === "image" ? GalleryMediaType.image : GalleryMediaType.video,
            data: buffer,
            uploadedById: userId,
          },
          include: {
            uploadedBy: { select: { id: true, name: true, email: true } },
          },
        });
      }),
    );

    const items = created.map((item) => ({
      id: item.id,
      year: item.year,
      fileName: item.fileName,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      type: item.mediaType === GalleryMediaType.image ? "image" : "video",
      description: item.description ?? null,
      createdAt: item.createdAt.toISOString(),
      uploadedBy: {
        id: item.uploadedBy?.id ?? null,
        name: item.uploadedBy?.name ?? null,
        email: item.uploadedBy?.email ?? null,
      },
      downloadUrl: `/api/gallery/items/${item.id}/file`,
      canDelete: item.uploadedById === userId,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[gallery] upload", error);
    return NextResponse.json(
      { error: "Upload fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 },
    );
  }
}
