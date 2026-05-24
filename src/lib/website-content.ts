import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_HOME_FAQ,
  DEFAULT_SCHULKATZE_INTRO,
  DEFAULT_UEBER_UNS_INTRO,
  DEFAULT_UEBER_UNS_MILESTONES,
  DEFAULT_UEBER_UNS_SIGNATURE,
  DEFAULT_UEBER_UNS_STATS,
  DEFAULT_UEBER_UNS_TRADES,
  DEFAULT_UEBER_UNS_VALUES,
  WEBSITE_CONTENT_IDS,
  faqContentSchema,
  iconItemsContentSchema,
  milestonesContentSchema,
  paragraphsContentSchema,
  statsContentSchema,
  type FaqContent,
  type IconItemsContent,
  type MilestonesContent,
  type ParagraphsContent,
  type StatsContent,
  type WebsiteContentId,
} from "@/lib/website-content-schemas";

// Re-export everything so server-side code keeps working with a single import
export * from "@/lib/website-content-schemas";

// Maps each content ID to the public page path it belongs to (for revalidation)
export const CONTENT_REVALIDATION_PATHS: Record<WebsiteContentId, string> = {
  "home.faq": "/",
  "schulkatze.intro": "/unsere-schulkatze",
  "ueber-uns.intro": "/ueber-uns",
  "ueber-uns.stats": "/ueber-uns",
  "ueber-uns.milestones": "/ueber-uns",
  "ueber-uns.signature": "/ueber-uns",
  "ueber-uns.values": "/ueber-uns",
  "ueber-uns.trades": "/ueber-uns",
};

const CONTENT_METADATA: Record<WebsiteContentId, { label: string; page: string }> = {
  "home.faq": { label: "FAQ", page: "home" },
  "schulkatze.intro": { label: "Einleitungstext", page: "schulkatze" },
  "ueber-uns.intro": { label: "Einleitungstext", page: "ueber-uns" },
  "ueber-uns.stats": { label: "Kennzahlen", page: "ueber-uns" },
  "ueber-uns.milestones": { label: "Meilensteine", page: "ueber-uns" },
  "ueber-uns.signature": { label: "Signature-Elemente", page: "ueber-uns" },
  "ueber-uns.values": { label: "Unsere Werte", page: "ueber-uns" },
  "ueber-uns.trades": { label: "Gewerke", page: "ueber-uns" },
};

// ── Generic read helper ───────────────────────────────────────────────────────

async function readContent(id: WebsiteContentId): Promise<unknown> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const record = await prisma.websiteContent.findUnique({ where: { id } });
    return record?.content ?? null;
  } catch {
    return null;
  }
}

// ── Typed read functions ──────────────────────────────────────────────────────

export async function readFaqContent(): Promise<FaqContent> {
  const raw = await readContent(WEBSITE_CONTENT_IDS.HOME_FAQ);
  const parsed = faqContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_HOME_FAQ;
}

export async function readSchulkatzeIntro(): Promise<ParagraphsContent> {
  const raw = await readContent(WEBSITE_CONTENT_IDS.SCHULKATZE_INTRO);
  const parsed = paragraphsContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_SCHULKATZE_INTRO;
}

export async function readUeberUnsIntro(): Promise<ParagraphsContent> {
  const raw = await readContent(WEBSITE_CONTENT_IDS.UEBER_UNS_INTRO);
  const parsed = paragraphsContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_UEBER_UNS_INTRO;
}

export async function readUeberUnsStats(): Promise<StatsContent> {
  const raw = await readContent(WEBSITE_CONTENT_IDS.UEBER_UNS_STATS);
  const parsed = statsContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_UEBER_UNS_STATS;
}

export async function readUeberUnsMilestones(): Promise<MilestonesContent> {
  const raw = await readContent(WEBSITE_CONTENT_IDS.UEBER_UNS_MILESTONES);
  const parsed = milestonesContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_UEBER_UNS_MILESTONES;
}

export async function readUeberUnsSignature(): Promise<IconItemsContent> {
  const raw = await readContent(WEBSITE_CONTENT_IDS.UEBER_UNS_SIGNATURE);
  const parsed = iconItemsContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_UEBER_UNS_SIGNATURE;
}

export async function readUeberUnsValues(): Promise<IconItemsContent> {
  const raw = await readContent(WEBSITE_CONTENT_IDS.UEBER_UNS_VALUES);
  const parsed = iconItemsContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_UEBER_UNS_VALUES;
}

export async function readUeberUnsTrades(): Promise<IconItemsContent> {
  const raw = await readContent(WEBSITE_CONTENT_IDS.UEBER_UNS_TRADES);
  const parsed = iconItemsContentSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_UEBER_UNS_TRADES;
}

// ── Write function ────────────────────────────────────────────────────────────

export async function saveWebsiteContent(id: WebsiteContentId, content: unknown, updatedById?: string): Promise<void> {
  const meta = CONTENT_METADATA[id];
  await prisma.websiteContent.upsert({
    where: { id },
    create: {
      id,
      page: meta.page,
      label: meta.label,
      content: content as Prisma.InputJsonValue,
      updatedById: updatedById ?? null,
    },
    update: {
      content: content as Prisma.InputJsonValue,
      updatedById: updatedById ?? null,
    },
  });
}

// ── Batch reader for CMS (all content for a page) ─────────────────────────────

export async function readAllContentForPage(page: "home" | "schulkatze" | "ueber-uns"): Promise<Record<string, unknown>> {
  if (!process.env.DATABASE_URL) return {};
  try {
    const records = await prisma.websiteContent.findMany({
      where: { page },
      select: { id: true, content: true, updatedAt: true },
    });
    return Object.fromEntries(records.map((r) => [r.id, r.content]));
  } catch {
    return {};
  }
}