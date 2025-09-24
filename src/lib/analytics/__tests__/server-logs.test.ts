import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsServerLog } from "@prisma/client";

import { logStructuredEvent } from "@/lib/logger";
import {
  loadLatestCriticalServerLogs,
  updateServerLogStatus,
  type LoadedServerLog,
} from "@/lib/analytics/load-server-logs";

const {
  transactionMock,
  findUniqueMock,
  createMock,
  updateMock,
  findManyMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  findUniqueMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    analyticsServerLog: {
      findMany: findManyMock,
      update: updateMock,
    },
  },
}));

function mockTransactionClient() {
  transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      analyticsServerLog: {
        findUnique: findUniqueMock,
        create: createMock,
        update: updateMock,
      },
    }),
  );
}

describe("server log pipeline", () => {
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgres://testing";
    mockTransactionClient();
  });

  it("persists new structured log entries when no fingerprint exists", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const createdLog = {
      id: "log-1",
      severity: "error",
      service: "Next.js API",
      message: "Timeout",
      description: "Request timeout",
      tags: ["API"],
      status: "open",
      occurrences: 1,
      metadata: null,
      affectedUsers: null,
      recommendedAction: null,
      firstSeenAt: new Date("2024-01-01T00:00:00.000Z"),
      lastSeenAt: new Date("2024-01-01T00:00:00.000Z"),
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      fingerprint: "fingerprint",
    } satisfies AnalyticsServerLog;
    createMock.mockResolvedValueOnce(createdLog);

    await logStructuredEvent({
      severity: "error",
      service: "Next.js API",
      message: "Timeout",
      metadata: {
        description: "Request timeout",
        tags: ["API"],
        status: "open",
        timestamp: new Date("2024-01-01T00:00:00.000Z"),
        requestId: "req-1",
      },
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { fingerprint: expect.any(String) } });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: "error",
          service: "Next.js API",
          message: "Timeout",
          description: "Request timeout",
          status: "open",
          tags: ["API"],
          occurrences: 1,
        }),
      }),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("\"service\":\"Next.js API\""));
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("updates existing aggregated logs and merges metadata", async () => {
    const existingLog = {
      id: "log-1",
      severity: "warning",
      service: "Cronjob",
      message: "Delay",
      description: "Existing description",
      tags: ["queue"],
      status: "monitoring",
      occurrences: 3,
      metadata: { existing: true },
      affectedUsers: 4,
      recommendedAction: "Existing action",
      firstSeenAt: new Date("2024-01-01T00:00:00.000Z"),
      lastSeenAt: new Date("2024-01-01T02:00:00.000Z"),
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      fingerprint: "fingerprint",
    } satisfies AnalyticsServerLog;
    findUniqueMock.mockResolvedValueOnce(existingLog);

    await logStructuredEvent({
      severity: "error",
      service: "Cronjob",
      message: "Delay",
      metadata: {
        description: "Updated description",
        status: "resolved",
        occurrences: 2,
        affectedUsers: 6,
        recommendedAction: "New action",
        tags: ["cron"],
        requestId: "req-2",
      },
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "log-1" },
        data: expect.objectContaining({
          severity: "error",
          description: "Updated description",
          status: "resolved",
          occurrences: { increment: 2 },
          recommendedAction: "New action",
          affectedUsers: 6,
          tags: expect.arrayContaining(["queue", "cron"]),
          metadata: expect.objectContaining({ existing: true, requestId: "req-2" }),
          lastSeenAt: expect.any(Date),
        }),
      }),
    );
  });

  it("loads latest critical server logs", async () => {
    const rows: AnalyticsServerLog[] = [
      {
        id: "log-1",
        severity: "error",
        service: "Realtime",
        message: "Handshake failed",
        description: "",
        tags: ["Realtime"],
        status: "open",
        occurrences: 5,
        metadata: null,
        affectedUsers: 2,
        recommendedAction: "Rotate token",
        firstSeenAt: new Date("2024-01-01T00:00:00.000Z"),
        lastSeenAt: new Date("2024-01-01T03:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T03:00:00.000Z"),
        fingerprint: "abc",
      },
    ];
    findManyMock.mockResolvedValueOnce(rows);

    const logs = await loadLatestCriticalServerLogs({ limit: 5, withinHours: 12 });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        orderBy: [
          { lastSeenAt: "desc" },
          { occurrences: "desc" },
        ],
      }),
    );
    expect(logs).toEqual([
      {
        id: "log-1",
        severity: "error",
        service: "Realtime",
        message: "Handshake failed",
        description: "Handshake failed",
        occurrences: 5,
        firstSeen: rows[0].firstSeenAt.toISOString(),
        lastSeen: rows[0].lastSeenAt.toISOString(),
        status: "open",
        recommendedAction: "Rotate token",
        affectedUsers: 2,
        tags: ["Realtime"],
      } satisfies LoadedServerLog,
    ]);
  });

  it("updates server log status and maps result", async () => {
    const updatedLog: AnalyticsServerLog = {
      id: "log-2",
      severity: "warning",
      service: "Cache",
      message: "Stale content",
      description: "",
      tags: ["cache"],
      status: "monitoring",
      occurrences: 4,
      metadata: null,
      affectedUsers: null,
      recommendedAction: null,
      firstSeenAt: new Date("2024-01-01T00:00:00.000Z"),
      lastSeenAt: new Date("2024-01-01T02:00:00.000Z"),
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T02:00:00.000Z"),
      fingerprint: "def",
    };
    updateMock.mockResolvedValueOnce(updatedLog);

    const result = await updateServerLogStatus("log-2", "monitoring");

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "log-2" },
      data: { status: "monitoring" },
    });
    expect(result).toEqual({
      id: "log-2",
      severity: "warning",
      service: "Cache",
      message: "Stale content",
      description: "Stale content",
      occurrences: 4,
      firstSeen: updatedLog.firstSeenAt.toISOString(),
      lastSeen: updatedLog.lastSeenAt.toISOString(),
      status: "monitoring",
      recommendedAction: undefined,
      affectedUsers: undefined,
      tags: ["cache"],
    });
  });
});
