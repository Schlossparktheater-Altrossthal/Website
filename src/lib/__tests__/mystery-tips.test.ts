import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGroupMysteryTipSubmissionsByPlayer = vi.fn();

vi.mock("@/lib/prisma-helpers", () => ({
  groupMysteryTipSubmissionsByPlayer: mockGroupMysteryTipSubmissionsByPlayer,
  aggregateMysteryTipSubmissionScores: vi.fn(),
  mysterySubmissionWithRelationsInclude: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mysteryTipSubmission: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    clue: {
      findMany: vi.fn(),
    },
  },
}));

describe("getMysteryScoreboard", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://test";
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    vi.restoreAllMocks();
  });

  it("returns an empty scoreboard and logs errors when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getMysteryScoreboard } = await import("../mystery-tips");
    const failure = new Error("database unavailable");

    mockGroupMysteryTipSubmissionsByPlayer.mockRejectedValueOnce(failure);

    const result = await getMysteryScoreboard();

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith("[mystery.scoreboard]", failure);

    consoleSpy.mockRestore();
  });
});
