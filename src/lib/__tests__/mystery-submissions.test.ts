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
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    vi.restoreAllMocks();
  });

  it("returns an empty scoreboard and logs errors when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getMysteryScoreboard } = await import("../mystery-submissions");
    const failure = new Error("database unavailable");

    mockGroupMysteryTipSubmissionsByPlayer.mockRejectedValueOnce(failure);

    const result = await getMysteryScoreboard();

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith("[mystery.scoreboard]", failure);

    consoleSpy.mockRestore();
  });

  it("returns a sorted scoreboard on the happy path", async () => {
    const { getMysteryScoreboard } = await import("../mystery-submissions");
    const updatedAt = new Date("2025-06-01T10:00:00Z");

    mockGroupMysteryTipSubmissionsByPlayer
      .mockResolvedValueOnce([
        { playerName: " Bob ", _sum: { score: 7 }, _count: { _all: 1 }, _max: { updatedAt } },
        { playerName: "Alice", _sum: { score: 12 }, _count: { _all: 2 }, _max: { updatedAt } },
        { playerName: "Carol", _sum: { score: 0 }, _count: { _all: 1 }, _max: { updatedAt } },
      ])
      .mockResolvedValueOnce([
        { playerName: "Alice", _sum: { score: 12 }, _count: { _all: 2 }, _max: { updatedAt } },
        { playerName: "Bob", _sum: { score: 7 }, _count: { _all: 1 }, _max: { updatedAt } },
      ]);

    const result = await getMysteryScoreboard();

    expect(mockGroupMysteryTipSubmissionsByPlayer).toHaveBeenCalledTimes(2);
    expect(mockGroupMysteryTipSubmissionsByPlayer).toHaveBeenNthCalledWith(2, { isCorrect: true });
    expect(result).toEqual([
      {
        playerName: "Alice",
        totalScore: 12,
        correctCount: 2,
        totalSubmissions: 2,
        lastUpdated: updatedAt,
      },
      {
        playerName: "Bob",
        totalScore: 7,
        correctCount: 1,
        totalSubmissions: 1,
        lastUpdated: updatedAt,
      },
    ]);
  });
});
