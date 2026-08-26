"use server";

import { DepartmentMembershipRole, TaskStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  ensureUniqueDepartmentSlug,
  parseCheckbox,
  parseColor,
  parseEnumValue,
  parseOptionalDate,
  parseRedirectPath,
  readOptionalString,
  readString,
  requireActiveProductionManager,
  requireProductionManager,
  revalidateDepartments,
  slugify,
} from "@/lib/produktionen/actions-helpers";

export async function createDepartmentAction(formData: FormData): Promise<void> {
  await requireProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const name = readString(formData, "name", { label: "Name", minLength: 2, maxLength: 80 });
    const slugInput = readOptionalString(formData, "slug", { label: "Slug", maxLength: 80 });
    if (slugInput && !/^[a-z0-9-]+$/i.test(slugInput)) {
      throw new Error("Slug darf nur Buchstaben, Zahlen und Bindestriche enthalten.");
    }
    const description = readOptionalString(formData, "description", {
      label: "Beschreibung",
      maxLength: 2000,
    });
    const color = parseColor(
      readOptionalString(formData, "color", { label: "Farbe", maxLength: 20 }),
    );
    const requiresApproval = parseCheckbox(formData.get("requiresApproval"));
    const baseSlug = slugify(slugInput ?? name);
    const slug = await ensureUniqueDepartmentSlug(baseSlug);

    await prisma.department.create({
      data: {
        name,
        slug,
        description: description ?? null,
        color: color ?? null,
        requiresJoinApproval: requiresApproval,
      },
    });

    revalidateDepartments(redirectPath);
  } catch (error) {
    console.error("createDepartmentAction", error);
    const message = error instanceof Error ? error.message : "Gewerk konnte nicht angelegt werden.";
    throw new Error(message);
  }
}

export async function updateDepartmentAction(formData: FormData): Promise<void> {
  await requireProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const id = readString(formData, "id", { label: "Gewerk" });
    const department = await prisma.department.findUnique({ where: { id } });
    if (!department) {
      throw new Error("Gewerk wurde nicht gefunden.");
    }
    const name = readString(formData, "name", { label: "Name", minLength: 2, maxLength: 80 });
    const slugInput = readOptionalString(formData, "slug", { label: "Slug", maxLength: 80 });
    if (slugInput && !/^[a-z0-9-]+$/i.test(slugInput)) {
      throw new Error("Slug darf nur Buchstaben, Zahlen und Bindestriche enthalten.");
    }
    const description = readOptionalString(formData, "description", {
      label: "Beschreibung",
      maxLength: 2000,
    });
    const color = parseColor(
      readOptionalString(formData, "color", { label: "Farbe", maxLength: 20 }),
    );
    const requiresApproval = parseCheckbox(formData.get("requiresApproval"));

    let slug = department.slug;
    if (slugInput) {
      const baseSlug = slugify(slugInput);
      slug = await ensureUniqueDepartmentSlug(baseSlug, department.id);
    }

    await prisma.department.update({
      where: { id },
      data: {
        name,
        slug,
        description: description ?? null,
        color: color ?? null,
        requiresJoinApproval: requiresApproval,
      },
    });

    revalidateDepartments(redirectPath);
  } catch (error) {
    console.error("updateDepartmentAction", error);
    const message =
      error instanceof Error ? error.message : "Gewerk konnte nicht aktualisiert werden.";
    throw new Error(message);
  }
}

export async function deleteDepartmentAction(formData: FormData): Promise<void> {
  await requireProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const id = readString(formData, "id", { label: "Gewerk" });
    await prisma.department.delete({ where: { id } });
    revalidateDepartments(redirectPath);
  } catch (error) {
    console.error("deleteDepartmentAction", error);
    const message =
      error instanceof Error
        ? error.message
        : "Gewerk konnte nicht gelöscht werden (ggf. bereits verwendet).";
    throw new Error(message);
  }
}

export async function addDepartmentMemberAction(formData: FormData): Promise<void> {
  const { activeProduction } = await requireActiveProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const departmentId = readString(formData, "departmentId", { label: "Gewerk" });
    const userId = readString(formData, "userId", { label: "Mitglied" });
    const role =
      parseEnumValue(DepartmentMembershipRole, formData.get("role"), "Funktion", {
        optional: true,
      }) ?? DepartmentMembershipRole.member;
    const titleValue = readOptionalString(formData, "title", {
      label: "Bezeichnung",
      maxLength: 120,
    });
    const noteValue = readOptionalString(formData, "note", { label: "Notiz", maxLength: 200 });

    const [department, user] = await Promise.all([
      prisma.department.findUnique({ where: { id: departmentId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!department) throw new Error("Gewerk wurde nicht gefunden.");
    if (!user) throw new Error("Mitglied wurde nicht gefunden.");

    const productionMembership = await prisma.productionMembership.findFirst({
      where: {
        showId: activeProduction.id,
        userId,
        OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!productionMembership) {
      throw new Error("Mitglied gehört nicht zur aktiven Produktion.");
    }

    await prisma.departmentMembership.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      update: {
        role,
        title: titleValue ?? null,
        note: noteValue ?? null,
      },
      create: {
        departmentId,
        userId,
        role,
        title: titleValue ?? null,
        note: noteValue ?? null,
      },
    });

    revalidateDepartments(redirectPath);
  } catch (error) {
    console.error("addDepartmentMemberAction", error);
    const message =
      error instanceof Error ? error.message : "Mitglied konnte nicht hinzugefügt werden.";
    throw new Error(message);
  }
}

export async function updateDepartmentMemberAction(formData: FormData): Promise<void> {
  const { activeProduction } = await requireActiveProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const membershipId = readString(formData, "membershipId", { label: "Mitgliedschaft" });
    const membership = await prisma.departmentMembership.findUnique({
      where: { id: membershipId },
      select: { id: true, userId: true, role: true },
    });
    if (!membership) {
      throw new Error("Mitgliedschaft wurde nicht gefunden.");
    }

    const productionMembership = await prisma.productionMembership.findFirst({
      where: {
        showId: activeProduction.id,
        userId: membership.userId,
        OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!productionMembership) {
      throw new Error("Mitglied gehört nicht zur aktiven Produktion.");
    }

    const role =
      parseEnumValue(DepartmentMembershipRole, formData.get("role"), "Funktion", {
        optional: true,
      }) ?? membership.role;
    const titleValue = readOptionalString(formData, "title", {
      label: "Bezeichnung",
      maxLength: 120,
    });
    const noteValue = readOptionalString(formData, "note", { label: "Notiz", maxLength: 200 });

    await prisma.departmentMembership.update({
      where: { id: membershipId },
      data: {
        role,
        title: titleValue ?? null,
        note: noteValue ?? null,
      },
    });

    revalidateDepartments(redirectPath);
  } catch (error) {
    console.error("updateDepartmentMemberAction", error);
    const message =
      error instanceof Error ? error.message : "Mitglied konnte nicht aktualisiert werden.";
    throw new Error(message);
  }
}

export async function removeDepartmentMemberAction(formData: FormData): Promise<void> {
  const { activeProduction } = await requireActiveProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const membershipId = readString(formData, "membershipId", { label: "Mitgliedschaft" });
    const membership = await prisma.departmentMembership.findUnique({
      where: { id: membershipId },
      select: { id: true, userId: true },
    });
    if (!membership) {
      throw new Error("Mitgliedschaft wurde nicht gefunden.");
    }

    const productionMembership = await prisma.productionMembership.findFirst({
      where: {
        showId: activeProduction.id,
        userId: membership.userId,
        OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!productionMembership) {
      throw new Error("Mitglied gehört nicht zur aktiven Produktion.");
    }

    await prisma.departmentMembership.delete({ where: { id: membershipId } });
    revalidateDepartments(redirectPath);
  } catch (error) {
    console.error("removeDepartmentMemberAction", error);
    const message =
      error instanceof Error ? error.message : "Mitglied konnte nicht entfernt werden.";
    throw new Error(message);
  }
}

export async function createDepartmentTaskAction(formData: FormData): Promise<void> {
  const { userId } = await requireProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const departmentId = readString(formData, "departmentId", { label: "Gewerk" });
    const title = readString(formData, "title", { label: "Titel", minLength: 2, maxLength: 160 });
    const description = readOptionalString(formData, "description", {
      label: "Beschreibung",
      maxLength: 2000,
    });
    const status =
      parseEnumValue(TaskStatus, formData.get("status"), "Status", { optional: true }) ??
      TaskStatus.todo;
    const assigneeIds = Array.from(
      new Set(
        formData
          .getAll("assigneeIds")
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );
    const dueAt = parseOptionalDate(formData, "dueAt", "Fällig bis");

    if (assigneeIds.length) {
      const validAssignments = await prisma.departmentMembership.count({
        where: { departmentId, userId: { in: assigneeIds } },
      });
      if (validAssignments !== assigneeIds.length) {
        throw new Error("Mindestens eine ausgewählte Person gehört nicht zu diesem Gewerk.");
      }
    }

    await prisma.$transaction(async (tx) => {
      const created = await tx.departmentTask.create({
        data: {
          departmentId,
          title,
          description: description ?? null,
          status,
          dueAt: dueAt ?? null,
          createdById: userId,
        },
      });

      if (assigneeIds.length) {
        await tx.departmentTaskAssignment.createMany({
          data: assigneeIds.map((assignmentId) => ({
            taskId: created.id,
            userId: assignmentId,
          })),
        });
      }
    });

    revalidateDepartments(redirectPath);
  } catch (error) {
    console.error("createDepartmentTaskAction", error);
    const message =
      error instanceof Error ? error.message : "Aufgabe konnte nicht erstellt werden.";
    throw new Error(message);
  }
}

export async function updateDepartmentTaskAction(formData: FormData): Promise<void> {
  await requireProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const taskId = readString(formData, "taskId", { label: "Aufgabe" });
    const task = await prisma.departmentTask.findUnique({
      where: { id: taskId },
      select: { id: true, departmentId: true, status: true },
    });
    if (!task) {
      throw new Error("Aufgabe wurde nicht gefunden.");
    }

    const title = readString(formData, "title", { label: "Titel", minLength: 2, maxLength: 160 });
    const description = readOptionalString(formData, "description", {
      label: "Beschreibung",
      maxLength: 2000,
    });
    const status =
      parseEnumValue(TaskStatus, formData.get("status"), "Status", { optional: true }) ??
      task.status;
    const assigneeIds = Array.from(
      new Set(
        formData
          .getAll("assigneeIds")
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );
    const dueAt = parseOptionalDate(formData, "dueAt", "Fällig bis");

    if (assigneeIds.length) {
      const validAssignments = await prisma.departmentMembership.count({
        where: { departmentId: task.departmentId, userId: { in: assigneeIds } },
      });
      if (validAssignments !== assigneeIds.length) {
        throw new Error("Mindestens eine ausgewählte Person gehört nicht zu diesem Gewerk.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.departmentTask.update({
        where: { id: taskId },
        data: {
          title,
          description: description ?? null,
          status,
          dueAt: dueAt ?? null,
        },
      });

      await tx.departmentTaskAssignment.deleteMany({ where: { taskId } });

      if (assigneeIds.length) {
        await tx.departmentTaskAssignment.createMany({
          data: assigneeIds.map((assignmentId) => ({ taskId, userId: assignmentId })),
        });
      }
    });

    revalidateDepartments(redirectPath);
  } catch (error) {
    console.error("updateDepartmentTaskAction", error);
    const message =
      error instanceof Error ? error.message : "Aufgabe konnte nicht aktualisiert werden.";
    throw new Error(message);
  }
}

export async function deleteDepartmentTaskAction(formData: FormData): Promise<void> {
  await requireProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const taskId = readString(formData, "taskId", { label: "Aufgabe" });
    const task = await prisma.departmentTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });
    if (!task) {
      throw new Error("Aufgabe wurde nicht gefunden.");
    }

    await prisma.departmentTask.delete({ where: { id: taskId } });
    revalidateDepartments(redirectPath);
  } catch (error) {
    console.error("deleteDepartmentTaskAction", error);
    const message =
      error instanceof Error ? error.message : "Aufgabe konnte nicht entfernt werden.";
    throw new Error(message);
  }
}
