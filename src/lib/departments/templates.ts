import type { Prisma, PrismaClient } from "@prisma/client";

import { templateMatchCodes } from "@/lib/onboarding/crew-options";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Legt für eine Produktion die Gewerke aus den globalen Vorlagen an. Bereits vorhandene
 * Gewerke (gleicher Slug) bleiben unverändert, der Aufruf ist idempotent.
 * Gibt die neu angelegten Gewerke zurück.
 */
export async function ensureProductionDepartments(showId: string, db: DbClient = prisma) {
  const [templates, existing] = await Promise.all([
    db.departmentTemplate.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.department.findMany({ where: { showId }, select: { slug: true } }),
  ]);
  const existingSlugs = new Set(existing.map((entry) => entry.slug));
  const missing = templates.filter((template) => !existingSlugs.has(template.slug));
  if (!missing.length) return [];

  await db.department.createMany({
    data: missing.map((template) => ({
      showId,
      templateId: template.id,
      slug: template.slug,
      name: template.name,
      description: template.description,
      color: template.color,
      requiresJoinApproval: template.requiresJoinApproval,
      sortOrder: template.sortOrder,
    })),
    skipDuplicates: true,
  });
  return missing.map((template) => template.slug);
}

/** Onboarding-Wunsch-Code → Gewerke einer Produktion, die diesen Wunsch abdecken. */
export async function findDepartmentsForPreferenceCodes(
  showId: string,
  db: DbClient = prisma,
): Promise<Map<string, { id: string; name: string }[]>> {
  const departments = await db.department.findMany({
    where: { showId, archivedAt: null },
    select: { id: true, name: true, template: { select: { slug: true, preferenceCodes: true } } },
  });
  const byCode = new Map<string, { id: string; name: string }[]>();
  for (const department of departments) {
    for (const code of templateMatchCodes(department.template)) {
      const list = byCode.get(code) ?? [];
      list.push({ id: department.id, name: department.name });
      byCode.set(code, list);
    }
  }
  return byCode;
}

/** Eindeutiger Slug für eine neue Blaupause (global). */
export async function ensureUniqueTemplateSlug(base: string, db: DbClient = prisma) {
  const normalized = base || `gewerk-${Math.random().toString(36).slice(2, 8)}`;
  let candidate = normalized;
  for (let counter = 2; ; counter++) {
    const existing = await db.departmentTemplate.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${normalized}-${counter}`;
  }
}

/**
 * Legt in einer Produktion das Gewerk einer Blaupause an. Gibt es dort schon ein archiviertes
 * Gewerk dieser Blaupause, wird es wiederhergestellt; ein aktives führt zu einem Fehler.
 */
export async function createDepartmentFromTemplate(
  showId: string,
  templateId: string,
  db: DbClient = prisma,
): Promise<{ id: string; slug: string; restored: boolean }> {
  const template = await db.departmentTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.archivedAt) throw new Error("Blaupause wurde nicht gefunden.");

  const existing = await db.department.findFirst({
    where: { showId, OR: [{ templateId }, { slug: template.slug }] },
    orderBy: { archivedAt: { sort: "desc", nulls: "first" } },
    select: { id: true, slug: true, archivedAt: true, templateId: true },
  });
  if (existing && !existing.archivedAt) {
    throw new Error("Dieses Gewerk gibt es in der Produktion schon.");
  }
  if (existing && existing.templateId === templateId) {
    await db.department.update({ where: { id: existing.id }, data: { archivedAt: null } });
    return { id: existing.id, slug: existing.slug, restored: true };
  }

  const last = await db.department.aggregate({ where: { showId }, _max: { sortOrder: true } });
  let slug = template.slug;
  for (let counter = 2; existing && slug === existing.slug; counter++) {
    slug = `${template.slug}-${counter}`;
  }
  const created = await db.department.create({
    data: {
      showId,
      templateId: template.id,
      slug,
      name: template.name,
      description: template.description,
      color: template.color,
      requiresJoinApproval: template.requiresJoinApproval,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
    select: { id: true, slug: true },
  });
  return { ...created, restored: false };
}

export type TemplateChoice = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  modules: string[];
  /** Ein aktives Gewerk dieser Blaupause gibt es in der Produktion schon. */
  inShow: boolean;
};

/** Blaupausen zur Auswahl beim Anlegen eines Gewerks. */
export async function listTemplateChoices(
  showId: string,
  db: DbClient = prisma,
): Promise<TemplateChoice[]> {
  const [templates, departments] = await Promise.all([
    db.departmentTemplate.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        color: true,
        icon: true,
        modules: true,
      },
    }),
    db.department.findMany({
      where: { showId, archivedAt: null },
      select: { templateId: true },
    }),
  ]);
  const used = new Set(departments.map((department) => department.templateId));
  return templates.map((template) => ({ ...template, inShow: used.has(template.id) }));
}
