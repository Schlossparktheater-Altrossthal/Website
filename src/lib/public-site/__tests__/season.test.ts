import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/email/send", () => ({ createConfiguredMailSender: vi.fn() }));

import { type PublicSeason, publicSeasonMaxAge } from "../season";

const now = new Date("2026-10-22T12:00:00Z");
const season = (patch: Partial<PublicSeason>): PublicSeason => ({
  year: 2027,
  revealed: false,
  title: "Sommertheater 2027",
  synopsis: null,
  revealAt: null,
  premiereAt: null,
  performances: [],
  ...patch,
});

describe("publicSeasonMaxAge", () => {
  it("cacht nicht über die Enthüllung hinaus", () => {
    expect(publicSeasonMaxAge(season({ revealAt: "2026-10-22T12:01:00Z" }), now)).toBe(60);
    expect(publicSeasonMaxAge(season({ revealAt: "2026-10-22T11:00:00Z" }), now)).toBe(0);
  });

  it("nutzt sonst die Standarddauer", () => {
    expect(publicSeasonMaxAge(season({ revealAt: "2027-03-01T00:00:00Z" }), now)).toBe(300);
    expect(publicSeasonMaxAge(season({ revealed: true }), now)).toBe(300);
    expect(publicSeasonMaxAge(null, now)).toBe(300);
  });
});
