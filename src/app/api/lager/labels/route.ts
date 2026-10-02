import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getAppBaseUrl } from "@/lib/app-url";
import {
  formatInventoryDate,
  inventoryPublicUrl,
  isLocationCode,
  parseInventoryCode,
} from "@/lib/inventory/constants";
import { renderLabelSheetPdf, type LabelData } from "@/lib/inventory/label-pdf";
import {
  CUSTOM_TEMPLATE_ID,
  findLabelTemplate,
  validateLabelTemplate,
  type LabelSheetTemplate,
} from "@/lib/inventory/label-templates";
import { loadLocationLabeler } from "@/lib/inventory/service";
import { getInventoryAccess } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { DEFAULT_SITE_TITLE } from "@/lib/website-settings";

const MAX_LABELS = 1000;
const measure = z.coerce.number().min(0).max(300);

const bodySchema = z.object({
  codes: z.array(z.string()).max(MAX_LABELS),
  templateId: z.string(),
  custom: z
    .object({
      columns: z.coerce.number().int().min(1).max(10),
      rows: z.coerce.number().int().min(1).max(30),
      width: measure,
      height: measure,
      marginTop: measure,
      marginLeft: measure,
      gapX: measure,
      gapY: measure,
    })
    .optional(),
  skip: z.coerce.number().int().min(0).max(299).default(0),
  outlines: z.boolean().default(false),
  markPrinted: z.boolean().default(true),
  content: z.object({
    showName: z.boolean(),
    showArea: z.boolean(),
    showInspection: z.boolean(),
    showOrganisation: z.boolean(),
  }),
});

function inspectionNote(nextInspectionAt: Date | null) {
  if (!nextInspectionAt) return null;
  return `Prüfung bis ${formatInventoryDate(nextInspectionAt).slice(3)}`;
}

/** Etiketten als PDF für A4-Bögen. Markiert gedruckte Objekte (außer beim Probedruck). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  const access = await getInventoryAccess(session?.user);
  if (!access.canUse) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Angaben" }, { status: 400 });
  }
  const body = parsed.data;

  let template: LabelSheetTemplate | undefined;
  if (body.templateId === CUSTOM_TEMPLATE_ID && body.custom) {
    template = { id: CUSTOM_TEMPLATE_ID, label: "Eigenes Format", hint: "", ...body.custom };
  } else {
    template = findLabelTemplate(body.templateId);
  }
  if (!template) {
    return NextResponse.json({ error: "Unbekannter Bogen" }, { status: 400 });
  }
  const invalid = validateLabelTemplate(template);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const codes = [
    ...new Set(body.codes.map(parseInventoryCode).filter((c): c is string => Boolean(c))),
  ];
  if (!codes.length) {
    return NextResponse.json({ error: "Keine Etiketten ausgewählt" }, { status: 400 });
  }
  const assetCodes = codes.filter((code) => !isLocationCode(code));
  const locationCodes = codes.filter(isLocationCode);
  const [assets, locations, labeler] = await Promise.all([
    prisma.inventoryAsset.findMany({
      where: { code: { in: assetCodes } },
      select: {
        code: true,
        name: true,
        inspectionRequired: true,
        nextInspectionAt: true,
        area: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.inventoryLocation.findMany({
      where: { code: { in: locationCodes } },
      select: { id: true, code: true, name: true },
    }),
    loadLocationLabeler(),
  ]);
  const byCode = new Map<string, LabelData>();
  const base = getAppBaseUrl();
  for (const asset of assets) {
    byCode.set(asset.code, {
      code: asset.code,
      url: inventoryPublicUrl(base, asset.code),
      title: asset.name,
      subtitle: [asset.area.name, asset.category?.name].filter(Boolean).join(" · "),
      footnote: asset.inspectionRequired ? inspectionNote(asset.nextInspectionAt) : null,
    });
  }
  for (const location of locations) {
    byCode.set(location.code, {
      code: location.code,
      url: inventoryPublicUrl(base, location.code),
      title: labeler.label(location.id) ?? location.name,
      subtitle: "Lagerplatz",
      footnote: null,
    });
  }
  // Reihenfolge der Auswahl beibehalten.
  const labels = codes.map((code) => byCode.get(code)).filter((l): l is LabelData => Boolean(l));
  if (!labels.length) {
    return NextResponse.json({ error: "Keiner der Codes ist vergeben" }, { status: 404 });
  }

  const pdf = await renderLabelSheetPdf({
    labels,
    template,
    content: body.content,
    skip: body.skip,
    organisation: DEFAULT_SITE_TITLE,
    outlines: body.outlines,
  });

  if (body.markPrinted && !body.outlines) {
    await prisma.inventoryAsset.updateMany({
      where: { code: { in: assetCodes }, labelPrintedAt: null },
      data: { labelPrintedAt: new Date() },
    });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="etiketten-${template.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
