import { NextRequest, NextResponse } from "next/server";

import {
  PdfRenderError,
  PdfTemplateNotFoundError,
  PdfValidationError,
  renderPdfTemplate,
} from "@/lib/pdf/engine";

export const runtime = "nodejs";

function sanitizeFilename(filename: string) {
  const fallback = "download.pdf";
  if (!filename) return fallback;
  const cleaned = filename.replace(/\r|\n|"|\\/g, "").trim();
  if (!cleaned.toLowerCase().endsWith(".pdf")) {
    return `${cleaned || "download"}.pdf`;
  }
  return cleaned || fallback;
}

type RouteContext = {
  params: Promise<{
    template: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { template } = await params;
  const templateId = template?.trim();
  if (!templateId) {
    return NextResponse.json({ error: "Unbekannte PDF-Vorlage" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Daten" }, { status: 400 });
  }

  try {
    const result = await renderPdfTemplate(templateId, payload);
    const filename = sanitizeFilename(result.filename);
    const body = new Uint8Array(result.buffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PdfTemplateNotFoundError) {
      return NextResponse.json({ error: "Unbekannte PDF-Vorlage" }, { status: 404 });
    }
    if (error instanceof PdfValidationError) {
      return NextResponse.json({ error: "Ungültige Daten", issues: error.issues }, { status: 400 });
    }
    if (error instanceof PdfRenderError) {
      console.error(`[pdf] Fehler beim Rendern der Vorlage ${error.templateId}`, error.originalError);
    } else {
      console.error(`[pdf] Unerwarteter Fehler beim Rendern der Vorlage ${templateId}`, error);
    }
    return NextResponse.json({ error: "PDF konnte nicht erstellt werden" }, { status: 500 });
  }
}
