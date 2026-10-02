import type { Prisma, PrismaClient } from "@prisma/client";

import { listRolePreferenceDefinitions } from "@/lib/onboarding/role-preferences";
import type { CrewWishOption } from "@/lib/onboarding/crew-wish-option";
import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type { CrewWishOption } from "@/lib/onboarding/crew-wish-option";
export { findMatchingWishWeight } from "@/lib/onboarding/crew-wish-option";

type TemplateWishSource = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  preferenceCodes: string[];
  onboardingDescription: string | null;
};

const TEMPLATE_CODE_PREFIX = "tpl:";

const templateSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  color: true,
  preferenceCodes: true,
  onboardingDescription: true,
  onboardingVisible: true,
} as const;

export function isTemplateWishCode(code: string): boolean {
  return code.startsWith(TEMPLATE_CODE_PREFIX);
}

/** Wunsch-Codes, die zu einer Blaupause führen: Alt-Codes plus `tpl:<slug>`. */
export function templateMatchCodes(template: { slug: string; preferenceCodes: string[] }) {
  return [...template.preferenceCodes, `${TEMPLATE_CODE_PREFIX}${template.slug}`];
}

/**
 * Code, unter dem ein Wunsch für diese Blaupause gespeichert wird. Gehört ein Alt-Code
 * eindeutig zu genau dieser Blaupause, bleibt er (Auswertungen über Jahre vergleichbar);
 * sonst `tpl:<slug>`.
 */
function templateWishCode(template: TemplateWishSource, codeUsage: Map<string, number>) {
  const [only, ...rest] = template.preferenceCodes;
  if (only && !rest.length && codeUsage.get(only) === 1) return only;
  return `${TEMPLATE_CODE_PREFIX}${template.slug}`;
}

function countCodeUsage(templates: ReadonlyArray<{ preferenceCodes: string[] }>) {
  const usage = new Map<string, number>();
  for (const template of templates) {
    for (const code of template.preferenceCodes) usage.set(code, (usage.get(code) ?? 0) + 1);
  }
  return usage;
}

/**
 * Gewerks-Wünsche für eine Produktion: die Gewerke der Produktion (über ihre Blaupause,
 * nur mit „im Onboarding anbieten“), danach feste Wünsche, die keine Blaupause abdeckt.
 * Ohne Produktion oder ohne Gewerke dienen alle Blaupausen als Grundlage.
 */
export async function listCrewWishOptions(
  showId: string | null,
  db: DbClient = prisma,
): Promise<CrewWishOption[]> {
  const allTemplates = await db.departmentTemplate.findMany({
    select: templateSelect,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const codeUsage = countCodeUsage(allTemplates);

  let templates = allTemplates;
  if (showId) {
    const departments = await db.department.findMany({
      where: { showId, archivedAt: null, templateId: { not: null } },
      select: { templateId: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    if (departments.length) {
      const byId = new Map(allTemplates.map((template) => [template.id, template]));
      const seen = new Set<string>();
      templates = departments.flatMap(({ templateId }) => {
        const template = templateId ? byId.get(templateId) : undefined;
        if (!template || seen.has(template.id)) return [];
        seen.add(template.id);
        return [template];
      });
    }
  }

  const staticDefinitions = listRolePreferenceDefinitions("crew");
  const staticByCode = new Map(
    staticDefinitions.map((definition) => [definition.code, definition]),
  );

  const options: CrewWishOption[] = templates
    .filter((template) => template.onboardingVisible)
    .map((template) => {
      const code = templateWishCode(template, codeUsage);
      return {
        code,
        domain: "crew",
        title: template.name,
        description:
          template.onboardingDescription?.trim() ||
          staticByCode.get(code)?.description ||
          template.description ||
          "",
        color: template.color,
        templateId: template.id,
        matchCodes: [...new Set([code, ...templateMatchCodes(template)])],
      };
    });

  // Auch ausgeblendete Blaupausen decken ihre Alt-Codes ab, sonst käme ein Gewerk doppelt.
  const covered = new Set(templates.flatMap((template) => template.preferenceCodes));
  for (const definition of staticDefinitions) {
    if (covered.has(definition.code)) continue;
    options.push({
      ...definition,
      domain: "crew",
      color: null,
      templateId: null,
      matchCodes: [definition.code],
    });
  }
  return options;
}

/** Titel für `tpl:`-Codes und eindeutige Alt-Codes, für Auswertungen und Zuweisung. */
export async function loadTemplateWishTitles(db: DbClient = prisma): Promise<Map<string, string>> {
  const templates = await db.departmentTemplate.findMany({ select: templateSelect });
  const codeUsage = countCodeUsage(templates);
  const titles = new Map<string, string>();
  for (const template of templates) {
    titles.set(`${TEMPLATE_CODE_PREFIX}${template.slug}`, template.name);
    titles.set(templateWishCode(template, codeUsage), template.name);
  }
  return titles;
}

/** Alle Wunsch-Codes, die aktuell zu einer Blaupause gehören (für die Prüfung beim Speichern). */
export async function listTemplateWishCodes(db: DbClient = prisma): Promise<Set<string>> {
  const templates = await db.departmentTemplate.findMany({
    select: { slug: true, preferenceCodes: true },
  });
  return new Set(templates.flatMap(templateMatchCodes));
}
