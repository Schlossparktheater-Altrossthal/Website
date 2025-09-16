import { describe, expect, it, vi } from "vitest";
import type { AttendanceStatus, PrismaClient, RehearsalAttendance } from "@prisma/client";
import {
  canManageForeignAttendance,
  normalizeStatus,
  sanitizeComment,
  updateAttendanceWithLog,
} from "@/lib/rehearsals/attendance";

type AttendanceOverride = Partial<RehearsalAttendance> & {
  rehearsalId: string;
  userId: string;
  status: AttendanceStatus;
};

const createPrismaMock = (existing?: AttendanceOverride) => {
  const attendanceRecord: RehearsalAttendance | null = existing
    ? ({
        id: existing.id ?? "attendance-existing",
        rehearsalId: existing.rehearsalId,
        userId: existing.userId,
        status: existing.status,
      } as RehearsalAttendance)
    : null;

  const tx = {
    rehearsalAttendance: {
      findUnique: vi.fn().mockResolvedValue(attendanceRecord),
      upsert: vi.fn().mockImplementation(async ({ create, update }) => ({
        id: attendanceRecord?.id ?? "attendance-upserted",
        rehearsalId: create.rehearsalId,
        userId: create.userId,
        status: (update?.status ?? create.status) as AttendanceStatus,
      })),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    rehearsalAttendanceLog: {
      create: vi.fn().mockResolvedValue({ id: "log-created" }),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (callback: any) => callback(tx)),
  } as unknown as PrismaClient;

  return { prisma, tx };
};

describe("attendance helpers", () => {
  it("normalizes valid statuses", () => {
    expect(normalizeStatus("yes")).toBe("yes");
    expect(normalizeStatus("no")).toBe("no");
    expect(normalizeStatus("maybe")).toBe("maybe");
  });

  it("rejects invalid statuses", () => {
    expect(normalizeStatus("planned")).toBeNull();
    expect(normalizeStatus(123)).toBeNull();
  });

  it("sanitizes comments", () => {
    expect(sanitizeComment("  hello  ")).toBe("hello");
    expect(sanitizeComment("   ")).toBeNull();
    expect(sanitizeComment(undefined)).toBeNull();
  });

  it("detects management privileges", () => {
    expect(canManageForeignAttendance({ role: "board" })).toBe(true);
    expect(canManageForeignAttendance({ role: "tech" })).toBe(true);
    expect(canManageForeignAttendance({ role: "member" })).toBe(false);
    expect(canManageForeignAttendance(null)).toBe(false);
  });
});

describe("updateAttendanceWithLog", () => {
  it("creates or updates attendance records with logs", async () => {
    const { prisma, tx } = createPrismaMock({
      rehearsalId: "reh-1",
      userId: "user-1",
      status: "yes",
    });

    const result = await updateAttendanceWithLog({
      prisma,
      rehearsalId: "reh-1",
      targetUserId: "user-1",
      actorUserId: "user-1",
      nextStatus: "yes",
      comment: "  see you there  ",
    });

    expect(tx.rehearsalAttendance.upsert).toHaveBeenCalled();
    expect(tx.rehearsalAttendanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previous: "yes",
          next: "yes",
          comment: "see you there",
        }),
      }),
    );
    expect(result.attendance?.status).toBe("yes");
    expect(result.logId).toBe("log-created");
  });

  it("removes attendance when status is null and logs", async () => {
    const { prisma, tx } = createPrismaMock({
      rehearsalId: "reh-2",
      userId: "user-2",
      status: "no",
    });

    const result = await updateAttendanceWithLog({
      prisma,
      rehearsalId: "reh-2",
      targetUserId: "user-2",
      actorUserId: "actor-2",
      nextStatus: null,
      comment: null,
    });

    expect(tx.rehearsalAttendance.delete).toHaveBeenCalledWith({
      where: {
        rehearsalId_userId: {
          rehearsalId: "reh-2",
          userId: "user-2",
        },
      },
    });
    expect(tx.rehearsalAttendanceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previous: "no",
          next: null,
        }),
      }),
    );
    expect(result.attendance).toBeNull();
  });

  it("creates new attendance when none exists", async () => {
    const { prisma, tx } = createPrismaMock();

    const result = await updateAttendanceWithLog({
      prisma,
      rehearsalId: "reh-3",
      targetUserId: "user-3",
      actorUserId: "actor-3",
      nextStatus: "yes",
      comment: "first response",
    });

    expect(tx.rehearsalAttendance.findUnique).toHaveBeenCalled();
    expect(tx.rehearsalAttendance.upsert).toHaveBeenCalled();
    expect(result.attendance?.status).toBe("yes");
  });
});
