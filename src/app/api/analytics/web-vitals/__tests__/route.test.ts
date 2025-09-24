import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../route";

const {
  upsertPageMock,
  upsertDeviceMock,
  upsertTrafficMock,
  deletePageMock,
  deleteDeviceMock,
  deleteTrafficMock,
  transactionMock,
} = vi.hoisted(() => ({
  upsertPageMock: vi.fn(),
  upsertDeviceMock: vi.fn(),
  upsertTrafficMock: vi.fn(),
  deletePageMock: vi.fn(),
  deleteDeviceMock: vi.fn(),
  deleteTrafficMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    analyticsPageView: { upsert: upsertPageMock },
    analyticsDeviceSnapshot: { upsert: upsertDeviceMock },
    analyticsTrafficAttribution: { upsert: upsertTrafficMock },
  },
}));

describe("web vitals analytics route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback) =>
      callback({
        analyticsPageView: { upsert: upsertPageMock, deleteMany: deletePageMock },
        analyticsDeviceSnapshot: { upsert: upsertDeviceMock, deleteMany: deleteDeviceMock },
        analyticsTrafficAttribution: {
          upsert: upsertTrafficMock,
          deleteMany: deleteTrafficMock,
        },
      }),
    );
  });

  const createRequest = (body: unknown) => ({
    json: async () => body,
  }) as NextRequest;

  it("stores normalized metrics and device snapshot", async () => {
    const response = await POST(
      createRequest({
        sessionId: "metric-123",
        path: "/galerie/",
        scope: "public",
        weight: 3,
        metrics: {
          loadTime: 2_240.6,
          lcp: 1_480.2,
        },
        device: {
          userAgent: "Mozilla/5.0",
          deviceHint: "Desktop",
          platform: "MacIntel",
          hardwareConcurrency: 8,
          deviceMemoryGb: 16,
          touchSupport: 0,
          reducedMotion: false,
          prefersDarkMode: true,
          colorSchemePreference: "dark",
          connection: {
            type: "wifi",
            effectiveType: "4g",
            rttMs: 45,
            downlinkMbps: 48,
          },
          viewport: {
            width: 1440,
            height: 900,
            pixelRatio: 2,
          },
          language: "de-DE",
          timezone: "Europe/Berlin",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });

    expect(upsertPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "metric-123" },
        create: expect.objectContaining({
          path: "/galerie",
          scope: "public",
          loadTimeMs: 2241,
          lcpMs: 1480,
          weight: 3,
        }),
      }),
    );

    expect(upsertDeviceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sessionId: "metric-123",
          deviceHint: "desktop",
          platform: "MacIntel",
          connectionType: "wifi",
          connectionEffectiveType: "4g",
          connectionRttMs: 45,
          connectionDownlinkMbps: 48,
          viewportWidth: 1440,
          viewportHeight: 900,
          pixelRatio: 2,
          language: "de-DE",
          timezone: "Europe/Berlin",
        }),
      }),
    );

    expect(upsertTrafficMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "metric-123" },
        create: expect.objectContaining({
          path: "/galerie",
          analyticsSessionId: null,
          referrer: null,
          referrerDomain: null,
        }),
      }),
    );
  });

  it("infers members scope when not provided", async () => {
    const response = await POST(
      createRequest({
        sessionId: "metric-456",
        path: "/mitglieder/dashboard",
        metrics: { loadTime: 900, lcp: 620 },
        device: {
          userAgent: "TestAgent",
          deviceHint: "iPhone",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(upsertPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          scope: "members",
          path: "/mitglieder/dashboard",
        }),
      }),
    );

    expect(upsertTrafficMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId: "metric-456" },
        create: expect.objectContaining({
          path: "/mitglieder/dashboard",
        }),
      }),
    );
  });

  it("rejects payload without metrics", async () => {
    const response = await POST(
      createRequest({
        sessionId: "metric-789",
        path: "/chronik",
        metrics: { loadTime: 0, lcp: null },
        device: { userAgent: "Test", deviceHint: "Desktop" },
      }),
    );

    expect(response.status).toBe(400);
    expect(upsertPageMock).not.toHaveBeenCalled();
    expect(upsertDeviceMock).not.toHaveBeenCalled();
    expect(upsertTrafficMock).not.toHaveBeenCalled();
  });
});
