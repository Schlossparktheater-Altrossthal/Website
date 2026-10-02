"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requestServiceGroupSync } from "@/lib/authentik/service-groups";
import { normalizeModules } from "@/lib/departments/modules";
import { isTemplateIconKey } from "@/lib/departments/template-icons";
import { ensureUniqueTemplateSlug } from "@/lib/departments/templates";
import {
  ensurePermissionDefinitions,
  hasPermission,
  isKnownPermissionKey,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  actionFailure,
  actionSuccess,
  slugify,
  type ProductionActionResult,
} from "@/lib/produktionen/actions-helpers";
import { requireAuth } from "@/lib/rbac";

const TEMPLATE_MANAGE = "PRIVATE.DEPARTMENT.TEMPLATE.MANAGE";
const hexColor = /^#[0-9a-f]{6}$/i;

async function requireTemplateManager() {
  const session = await requireAuth();
  if (!session.user?.id || !(await hasPermission(session.user, TEMPLATE_MANAGE))) {
    throw new Error("Keine Berechtigung.");
  }
}

function revalidateTemplates() {
  revalidatePath("/mitglieder/blaupausen");
  revalidatePath("/mitglieder/meine-gewerke", "layout");
  revalidatePath("/mitglieder/produktionen/zuweisung");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name ist zu kurz.").max(80),
  description: optionalText(2000),
  color: z.string().regex(hexColor).nullish(),
  icon: z.string().nullish(),
  modules: z.array(z.string()).max(12),
  requiresJoinApproval: z.boolean(),
  onboardingVisible: z.boolean(),
  onboardingDescription: optionalText(300),
});

/** Blaupause anlegen oder bearbeiten. Gibt die ID zurück. */
export async function saveTemplateAction(
  input: z.input<typeof templateSchema>,
): Promise<ProductionActionResult & { id?: string }> {
  try {
    await requireTemplateManager();
    const data = templateSchema.parse(input);
    const fields = {
      name: data.name,
      description: data.description,
      color: data.color ?? null,
      icon: isTemplateIconKey(data.icon) ? data.icon : null,
      modules: normalizeModules(data.modules),
      requiresJoinApproval: data.requiresJoinApproval,
      onboardingVisible: data.onboardingVisible,
      onboardingDescription: data.onboardingDescription,
    };
    if (data.id) {
      await prisma.departmentTemplate.update({ where: { id: data.id }, data: fields });
      revalidateTemplates();
      return { ...actionSuccess(), id: data.id };
    }
    const last = await prisma.departmentTemplate.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.departmentTemplate.create({
      data: {
        ...fields,
        slug: await ensureUniqueTemplateSlug(slugify(data.name)),
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
      select: { id: true },
    });
    revalidateTemplates();
    return { ...actionSuccess(), id: created.id };
  } catch (error) {
    return actionFailure(error, "Blaupause konnte nicht gespeichert werden.");
  }
}

const permissionSchema = z.object({
  templateId: z.string(),
  permissionKey: z.string(),
  role: z.enum(["lead", "deputy", "member", "guest"]),
  granted: z.boolean(),
});

/** Standardrecht einer Blaupause für eine Rolle setzen; wirkt sofort auf alle Gewerke (E6). */
export async function setTemplatePermissionAction(
  input: z.input<typeof permissionSchema>,
): Promise<ProductionActionResult> {
  try {
    await requireTemplateManager();
    const data = permissionSchema.parse(input);
    if (!isKnownPermissionKey(data.permissionKey)) throw new Error("Unbekanntes Recht.");
    await ensurePermissionDefinitions();
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { key: data.permissionKey },
      select: { id: true },
    });
    const where = {
      templateId: data.templateId,
      permissionId: permission.id,
      role: data.role,
    };
    if (data.granted) {
      await prisma.templatePermission.upsert({
        where: { templateId_permissionId_role: where },
        update: {},
        create: where,
      });
    } else {
      await prisma.templatePermission.deleteMany({ where });
    }
    requestServiceGroupSync();
    revalidatePath("/mitglieder/blaupausen");
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Recht konnte nicht gespeichert werden.");
  }
}

/** Blaupause archivieren (nicht mehr wählbar) oder wiederherstellen; Gewerke bleiben. */
export async function setTemplateArchivedAction(input: {
  id: string;
  archived: boolean;
}): Promise<ProductionActionResult> {
  try {
    await requireTemplateManager();
    const id = z.string().parse(input.id);
    await prisma.departmentTemplate.update({
      where: { id },
      data: { archivedAt: input.archived ? new Date() : null },
    });
    revalidateTemplates();
    return actionSuccess();
  } catch (error) {
    return actionFailure(error, "Blaupause konnte nicht geändert werden.");
  }
}
