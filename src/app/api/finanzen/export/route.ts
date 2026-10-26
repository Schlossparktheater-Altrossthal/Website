import { NextResponse } from "next/server";

import { HttpError, withRoute } from "@/lib/api/route";
import { getFinanceAccess } from "@/lib/finance/access";
import {
  entriesToCsv,
  loadFinanceReport,
  receiptsZip,
  renderFinanceReportPdf,
  reportFileBase,
} from "@/lib/finance/report";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS = ["csv", "pdf", "zip"] as const;

function download(body: Uint8Array | string, type: string, filename: string) {
  return new NextResponse(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename.replace(/["\r\n\\]/g, "")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Export für Kassenwart, Vorstand und Kassenprüfung: `?zeitraum=…&topf=…&format=csv|pdf|zip`. */
export const GET = withRoute({ name: "finanzen.export.get" }, async ({ request, session }) => {
  const access = await getFinanceAccess(session.user);
  if (!access.viewAll) throw new HttpError(403, "Keine Berechtigung");
  const params = request.nextUrl.searchParams;
  const format = params.get("format") ?? "pdf";
  if (!(FORMATS as readonly string[]).includes(format))
    throw new HttpError(400, "Unbekanntes Format");
  const periodId = params.get("zeitraum") ?? "";
  const period = periodId
    ? await prisma.financePeriod.findUnique({ where: { id: periodId }, select: { id: true } })
    : null;
  if (!period) throw new HttpError(404, "Zeitraum nicht gefunden");
  const fundId = params.get("topf") || null;
  if (fundId && !(await prisma.financeFund.findUnique({ where: { id: fundId } }))) {
    throw new HttpError(404, "Topf nicht gefunden");
  }

  const report = await loadFinanceReport(period.id, fundId);
  if (format === "csv") {
    return download(
      entriesToCsv(report.entries),
      "text/csv; charset=utf-8",
      `${reportFileBase("kassenbuch", report)}.csv`,
    );
  }
  if (format === "zip") {
    const zip = await receiptsZip(report);
    if (!zip) throw new HttpError(404, "Keine Belege in diesem Zeitraum");
    return download(zip, "application/zip", `${reportFileBase("belege", report)}.zip`);
  }
  const pdf = await renderFinanceReportPdf(report);
  return download(pdf.buffer, "application/pdf", pdf.filename);
});
