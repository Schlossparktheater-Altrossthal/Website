import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  ensurePermissionDefinitions,
  findUserIdsWithPermission,
  getUserPermissionKeys,
  hasPermission,
} from "@/lib/permissions";
import { createDepartmentFromTemplate, listTemplateChoices } from "@/lib/departments/templates";
import { prisma } from "@/lib/prisma";

import { createTestShow, createTestUser, resetItState } from "./harness";

const KEY = "PRIVATE.ADMIN.MEMBERS.MANAGE";

// gewerke-plan.md Phase 8: Gewerke erben Rechte der Blaupause je Rolle, speichern nur Abweichungen.
describe("Gewerk-Rechte aus der Blaupause", () => {
  beforeEach(resetItState);

  async function setup() {
    await ensurePermissionDefinitions();
    const permission = await prisma.permission.findUniqueOrThrow({ where: { key: KEY } });
    const show = await createTestShow("active");
    const template = await prisma.departmentTemplate.create({
      data: { slug: `it-${randomUUID().slice(0, 8)}`, name: "IT-Gewerk" },
    });
    await prisma.templatePermission.create({
      data: { templateId: template.id, permissionId: permission.id, role: "lead" },
    });
    const department = await prisma.department.create({
      data: { showId: show.id, templateId: template.id, slug: template.slug, name: "IT-Gewerk" },
    });
    const lead = await createTestUser();
    const member = await createTestUser();
    await prisma.departmentMembership.createMany({
      data: [
        { departmentId: department.id, userId: lead.id, role: "lead" },
        { departmentId: department.id, userId: member.id, role: "member" },
      ],
    });
    return { permission, department, lead, member };
  }

  const asUser = (id: string) => ({ id });

  it("gibt das Recht nur der Rolle, für die die Blaupause es vorsieht", async () => {
    const { lead, member } = await setup();
    expect(await hasPermission(asUser(lead.id), KEY)).toBe(true);
    expect(await hasPermission(asUser(member.id), KEY)).toBe(false);
    expect(await getUserPermissionKeys(asUser(lead.id))).toContain(KEY);
    const recipients = await findUserIdsWithPermission(KEY);
    expect(recipients).toContain(lead.id);
    expect(recipients).not.toContain(member.id);
  });

  it("grant ergänzt für alle Mitglieder, revoke entzieht das geerbte Recht", async () => {
    const { permission, department, lead, member } = await setup();
    await prisma.departmentPermission.create({
      data: { departmentId: department.id, permissionId: permission.id, mode: "grant" },
    });
    expect(await hasPermission(asUser(member.id), KEY)).toBe(true);
    expect(await findUserIdsWithPermission(KEY)).toContain(member.id);

    await prisma.departmentPermission.update({
      where: {
        departmentId_permissionId: { departmentId: department.id, permissionId: permission.id },
      },
      data: { mode: "revoke" },
    });
    expect(await hasPermission(asUser(lead.id), KEY)).toBe(false);
    const recipients = await findUserIdsWithPermission(KEY);
    expect(recipients).not.toContain(lead.id);
    expect(recipients).not.toContain(member.id);
  });
});

// gewerke-plan.md Phase 9: Gewerke entstehen nur aus Blaupausen.
describe("Gewerk aus Blaupause anlegen", () => {
  async function template(slug = `it-${randomUUID().slice(0, 8)}`) {
    return prisma.departmentTemplate.create({ data: { slug, name: "IT-Blaupause" } });
  }

  it("legt an, verweigert Doppeltes und stellt Archiviertes wieder her", async () => {
    const show = await createTestShow("planning");
    const tpl = await template();
    const first = await createDepartmentFromTemplate(show.id, tpl.id);
    expect(first).toMatchObject({ slug: tpl.slug, restored: false });
    await expect(createDepartmentFromTemplate(show.id, tpl.id)).rejects.toThrow(/schon/);

    await prisma.department.update({ where: { id: first.id }, data: { archivedAt: new Date() } });
    const again = await createDepartmentFromTemplate(show.id, tpl.id);
    expect(again).toMatchObject({ id: first.id, restored: true });
  });

  it("weicht bei fremdem archiviertem Gewerk mit gleichem Slug aus", async () => {
    const show = await createTestShow("planning");
    const other = await template();
    const tpl = await prisma.departmentTemplate.create({
      data: { slug: `${other.slug}-b`, name: "Andere" },
    });
    await prisma.department.create({
      data: {
        showId: show.id,
        templateId: other.id,
        slug: tpl.slug,
        name: "Alt",
        archivedAt: new Date(),
      },
    });
    const created = await createDepartmentFromTemplate(show.id, tpl.id);
    expect(created.slug).toBe(`${tpl.slug}-2`);
  });

  it("bietet archivierte Blaupausen nicht an und markiert vorhandene", async () => {
    const show = await createTestShow("planning");
    const used = await template();
    const archived = await prisma.departmentTemplate.create({
      data: { slug: `it-${randomUUID().slice(0, 8)}`, name: "Weg", archivedAt: new Date() },
    });
    await createDepartmentFromTemplate(show.id, used.id);
    const choices = await listTemplateChoices(show.id);
    expect(choices.find((choice) => choice.id === used.id)?.inShow).toBe(true);
    expect(choices.some((choice) => choice.id === archived.id)).toBe(false);
  });
});
