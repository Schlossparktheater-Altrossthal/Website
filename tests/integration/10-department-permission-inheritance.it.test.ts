import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  ensurePermissionDefinitions,
  findUserIdsWithPermission,
  getUserPermissionKeys,
  hasPermission,
} from "@/lib/permissions";
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

  const asUser = (id: string) => ({ id }) as never;

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
