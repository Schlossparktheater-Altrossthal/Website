import { NextResponse } from "next/server";

import { HttpError, withRoute } from "@/lib/api/route";
import { getFinanceAccess } from "@/lib/finance/access";
import { canViewReceipt } from "@/lib/finance/claims";
import { prisma } from "@/lib/prisma";

/** Belege zu Auslagen und Buchungen: Einreicher, Gewerksleitung, Kassenwart und Prüfer. */
export const GET = withRoute<{ id: string }>(
  { name: "finanzen.beleg.get" },
  async ({ session, userId, params }) => {
    const access = await getFinanceAccess(session.user);
    if (!(await canViewReceipt(access, userId, params.id)))
      throw new HttpError(404, "Beleg nicht gefunden");
    const receipt = await prisma.financeReceipt.findUniqueOrThrow({
      where: { id: params.id },
      select: { data: true, mimeType: true, filename: true },
    });
    return new NextResponse(new Uint8Array(receipt.data), {
      headers: {
        "Content-Type": receipt.mimeType,
        "Content-Length": String(receipt.data.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(receipt.filename)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=86400, immutable",
      },
    });
  },
);
