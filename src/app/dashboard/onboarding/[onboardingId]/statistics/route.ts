import { NextResponse } from "next/server";

import { buildOnboardingStatisticsPdfData } from "@/lib/onboarding/dashboard-pdf";
import { loadOnboardingDashboardSnapshot } from "@/lib/onboarding/dashboard-service";
import { PdfRenderError, PdfTemplateNotFoundError, renderPdfTemplate } from "@/lib/pdf/engine";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ onboardingId: string }> },
) {
  const params = await context.params;
  const onboardingId = params?.onboardingId;

  if (!onboardingId || typeof onboardingId !== "string") {
    return NextResponse.json({ error: "Missing onboarding id" }, { status: 400 });
  }

  try {
    const dashboard = await loadOnboardingDashboardSnapshot(onboardingId);
    if (!dashboard) {
      return NextResponse.json({ error: "Onboarding not found" }, { status: 404 });
    }

    const payload = buildOnboardingStatisticsPdfData(dashboard);
    const result = await renderPdfTemplate("onboarding-statistics", payload);
    const body = new Uint8Array(result.buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PdfTemplateNotFoundError) {
      return NextResponse.json({ error: "PDF template missing" }, { status: 404 });
    }
    if (error instanceof PdfRenderError) {
      console.error(
        `[onboarding-statistics-pdf] Rendering failed for ${error.templateId} (${onboardingId})`,
        error.originalError,
      );
    } else {
      console.error(`[onboarding-statistics-pdf] Unexpected error for ${onboardingId}`, error);
    }
    return NextResponse.json({ error: "Statistik konnte nicht erstellt werden" }, { status: 500 });
  }
}
