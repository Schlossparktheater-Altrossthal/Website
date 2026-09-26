import { describe, expect, it, vi } from "vitest";
import type { AttendanceStatus, PrismaClient } from "@prisma/client";
import {
  canManageForeignAttendance,
  normalizeStatus,
  sanitizeComment,
  updateAttendanceWithLog,
} from "@/lib/rehearsals/attendance";

type ParticipantRecord = { invited: boolean; response: AttendanceStatus | null };

const createPrismaMock = (existing?: ParticipantRecord) => {
  const tx = {
    eventParticipant: {
      findUnique: vi.fn().mockResolvedValue(existing ?? null),
      upsert: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    eventResponseLog: {
      create: vi.fn().mockResolvedValue({ id: "log-created" }),
    },
  };

  type TransactionCallback = (client: typeof tx) => unknown | Promise<unknown>;
  const prisma = {
    $transaction: vi.fn(async (callback: TransactionCallback) => callback(tx)),
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
  it("stores the response and logs the change", async () => {
    const { prisma, tx } = createPrismaMock({ invited: true, response: "yes" });

    const result = await updateAttendanceWithLog({
      prisma,
      eventId: "reh-1",
      targetUserId: "user-1",
      actorUserId: "user-1",
      nextStatus: "no",
      comment: "  see you there  ",
    });

    expect(tx.eventParticipant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: "reh-1", userId: "user-1" } },
        update: expect.objectContaining({ response: "no" }),
      }),
    );
    expect(tx.eventResponseLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ previous: "yes", next: "no", comment: "see you there" }),
      }),
    );
    expect(result).toEqual({ response: "no", logId: "log-created" });
  });

  it("keeps an invited participant when the response is withdrawn", async () => {
    const { prisma, tx } = createPrismaMock({ invited: true, response: "no" });

    const result = await updateAttendanceWithLog({
      prisma,
      eventId: "reh-2",
      targetUserId: "user-2",
      actorUserId: "actor-2",
      nextStatus: null,
    });

    expect(tx.eventParticipant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ response: null }) }),
    );
    expect(tx.eventParticipant.delete).not.toHaveBeenCalled();
    expect(tx.eventResponseLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ previous: "no", next: null }) }),
    );
    expect(result.response).toBeNull();
  });

  it("removes an uninvited participant when the response is withdrawn", async () => {
    const { prisma, tx } = createPrismaMock({ invited: false, response: "maybe" });

    await updateAttendanceWithLog({
      prisma,
      eventId: "reh-3",
      targetUserId: "user-3",
      actorUserId: "user-3",
      nextStatus: null,
    });

    expect(tx.eventParticipant.delete).toHaveBeenCalledWith({
      where: { eventId_userId: { eventId: "reh-3", userId: "user-3" } },
    });
  });
});
