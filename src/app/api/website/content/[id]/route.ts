import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  CONTENT_REVALIDATION_PATHS,
  WEBSITE_CONTENT_IDS,
  faqContentSchema,
  iconItemsContentSchema,
  milestonesContentSchema,
  paragraphsContentSchema,
  saveWebsiteContent,
  statsContentSchema,
  type WebsiteContentId,
} from "@/lib/website-content";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CONTENT_SCHEMAS: Partial<Record<WebsiteContentId, z.ZodTypeAny>> = {
  [WEBSITE_CONTENT_IDS.HOME_FAQ]: faqContentSchema,
  [WEBSITE_CONTENT_IDS.SCHULKATZE_INTRO]: paragraphsContentSchema,
  [WEBSITE_CONTENT_IDS.UEBER_UNS_INTRO]: paragraphsContentSchema,
  [WEBSITE_CONTENT_IDS.UEBER_UNS_STATS]: statsContentSchema,
  [WEBSITE_CONTENT_IDS.UEBER_UNS_MILESTONES]: milestonesContentSchema,
  [WEBSITE_CONTENT_IDS.UEBER_UNS_SIGNATURE]: iconItemsContentSchema,
  [WEBSITE_CONTENT_IDS.UEBER_UNS_VALUES]: iconItemsContentSchema,
  [WEBSITE_CONTENT_IDS.UEBER_UNS_TRADES]: iconItemsContentSchema,
};

const VALID_IDS = new Set<string>(Object.values(WEBSITE_CONTENT_IDS));

async function checkPermission(): Promise<{ forbidden: NextResponse | null; userId: string }> {
  const session = await requireAuth();
  if (!session.user) {
    return { forbidden: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: "" };
  }
  const allowed = await hasPermission(session.user, "PUBLIC.CONTENT.MANAGE");
  if (!allowed) {
    return { forbidden: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: "" };
  }
  return { forbidden: null, userId: session.user.id };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { forbidden } = await checkPermission();
  if (forbidden) return forbidden;

  if (!VALID_IDS.has(id)) {
    return NextResponse.json({ error: "Unbekannte Content-ID" }, { status: 404 });
  }

  const record = await prisma.websiteContent.findUnique({
    where: { id },
    include: { updatedBy: { select: { firstName: true, lastName: true } } },
  });

  return NextResponse.json({ record });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { forbidden, userId } = await checkPermission();
  if (forbidden) return forbidden;

  if (!VALID_IDS.has(id)) {
    return NextResponse.json({ error: "Unbekannte Content-ID" }, { status: 404 });
  }

  const contentId = id as WebsiteContentId;
  const schema = CONTENT_SCHEMAS[contentId];
  if (!schema) {
    return NextResponse.json({ error: "Kein Schema für diese Content-ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler", details: parsed.error.flatten() }, { status: 422 });
  }

  await saveWebsiteContent(contentId, parsed.data, userId);
  revalidatePath(CONTENT_REVALIDATION_PATHS[contentId]);

  return NextResponse.json({ ok: true });
}
