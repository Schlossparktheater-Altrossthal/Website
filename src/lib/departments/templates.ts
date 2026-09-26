import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Legt für eine Produktion die Gewerke aus den globalen Vorlagen an. Bereits vorhandene
 * Gewerke (gleicher Slug) bleiben unverändert, der Aufruf ist idempotent.
 * Gibt die neu angelegten Gewerke zurück.
 */
export async function ensureProductionDepartments(showId: string, db: DbClient = prisma) {
  const [templates, existing] = await Promise.all([
    db.departmentTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
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
    where: { showId, archivedAt: null, template: { isNot: null } },
    select: { id: true, name: true, template: { select: { preferenceCodes: true } } },
  });
  const byCode = new Map<string, { id: string; name: string }[]>();
  for (const department of departments) {
    for (const code of department.template?.preferenceCodes ?? []) {
      const list = byCode.get(code) ?? [];
      list.push({ id: department.id, name: department.name });
      byCode.set(code, list);
    }
  }
  return byCode;
}
