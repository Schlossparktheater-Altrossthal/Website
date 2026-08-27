import { describe, expect, it, vi } from "vitest";

import { deactivateMembersForSeasonChange, type MemberDeactivationTx } from "../deactivation";

describe("deactivateMembersForSeasonChange", () => {
  it("deaktiviert aktive User außerhalb der geschützten Rollen", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const tx: MemberDeactivationTx = { user: { updateMany } };

    const count = await deactivateMembersForSeasonChange(tx, ["owner", "admin"]);

    expect(count).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        deactivatedAt: null,
        role: { notIn: ["owner", "admin"] },
        roles: { none: { role: { in: ["owner", "admin"] } } },
      },
      data: {
        deactivatedAt: expect.any(Date),
        sessionVersion: { increment: 1 },
      },
    });
  });
});
