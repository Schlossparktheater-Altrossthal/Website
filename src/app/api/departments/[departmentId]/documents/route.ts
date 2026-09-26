import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireBoardAccess } from "@/lib/departments/board";
import { prisma } from "@/lib/prisma";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = [
  "image/",
  "application/pdf",
  "application/msword",
  "application/vnd.",
  "text/plain",
  "audio/",
];

function isAllowed(file: File) {
  return Boolean(file.type) && ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
}

type RouteParams = { params: Promise<{ departmentId: string }> };

/** Dateien ins Gewerk hochladen (Mitglieder, Leitung, Regie – nicht Gäste), je bis 15 MB. */
export async function POST(request: Request, { params }: RouteParams) {
  const { departmentId } = await params;
  let access;
  try {
    access = await requireBoardAccess(departmentId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kein Zugriff.";
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (!access.canEdit) {
    return NextResponse.json({ error: "Gäste können keine Dateien hochladen." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const files = (formData?.getAll("files") ?? []).filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );
  if (!files.length) {
    return NextResponse.json({ error: "Bitte wähle eine Datei aus." }, { status: 400 });
  }
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${file.name} ist größer als 15 MB.` }, { status: 400 });
    }
    if (!isAllowed(file)) {
      return NextResponse.json({ error: `${file.name}: Dateityp nicht erlaubt.` }, { status: 400 });
    }
  }

  try {
    for (const file of files) {
      await prisma.departmentDocument.create({
        data: {
          departmentId,
          fileName: file.name.trim().slice(0, 160) || "datei",
          mimeType: file.type,
          fileSize: file.size,
          data: Buffer.from(await file.arrayBuffer()),
          uploadedById: access.userId,
        },
      });
    }
  } catch (error) {
    console.error("[department-documents:upload]", error);
    return NextResponse.json({ error: "Hochladen hat nicht geklappt." }, { status: 500 });
  }
  revalidatePath("/mitglieder/meine-gewerke", "layout");
  return NextResponse.json({ uploaded: files.length }, { status: 201 });
}
