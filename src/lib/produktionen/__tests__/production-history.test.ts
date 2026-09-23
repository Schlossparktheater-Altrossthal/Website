import { describe, expect, it } from "vitest";

import { buildProductionHistory } from "../production-history";

describe("buildProductionHistory", () => {
  it("führt Daten pro Produktion zusammen, neueste zuerst", () => {
    const history = buildProductionHistory(
      [
        {
          showId: "s2026",
          status: "left",
          roles: ["member", "cast"],
          function: null,
          joinedAt: new Date("2026-01-01"),
          leftAt: new Date("2026-08-01"),
          show: { title: "Die unendliche Geschichte", year: 2026, status: "finished" },
        },
        {
          showId: "s2027",
          status: "active",
          roles: ["tech"],
          function: "Licht",
          joinedAt: new Date("2027-01-01"),
          leftAt: null,
          show: { title: null, year: 2027, status: "planning" },
        },
      ],
      [{ showId: "s2027", completedAt: new Date("2027-01-05"), isReturning: true }],
      [
        { showId: "s2026", status: "approved", revokedAt: null },
        { showId: "s2027", status: "approved", revokedAt: new Date("2027-02-01") },
      ],
    );

    expect(history.map((entry) => entry.showId)).toEqual(["s2027", "s2026"]);
    expect(history[0]).toMatchObject({
      title: "Produktion 2027",
      roles: ["tech"],
      function: "Licht",
      isReturning: true,
      photoConsentStatus: "none",
    });
    expect(history[1]).toMatchObject({
      title: "Die unendliche Geschichte",
      roles: ["cast"],
      onboardingCompletedAt: null,
      photoConsentStatus: "approved",
    });
  });
});
