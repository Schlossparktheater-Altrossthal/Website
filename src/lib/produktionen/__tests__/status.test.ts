import { describe, expect, it } from "vitest";

import {
  buildProductionStatusUpdate,
  currentMembershipWhere,
  isCurrentProductionStatus,
  isProductionStatus,
  shouldCloseMemberships,
} from "../status";

describe("Produktionsstatus", () => {
  const now = new Date("2026-09-23T10:00:00Z");

  it("erkennt gültige Status", () => {
    expect(isProductionStatus("finished")).toBe(true);
    expect(isProductionStatus("deleted")).toBe(false);
    expect(isProductionStatus(null)).toBe(false);
  });

  it("gibt Zugriff für geplante und aktive Produktionen", () => {
    expect(isCurrentProductionStatus("planning")).toBe(true);
    expect(isCurrentProductionStatus("active")).toBe(true);
    expect(isCurrentProductionStatus("finished")).toBe(false);
    expect(isCurrentProductionStatus("archived")).toBe(false);
  });

  it("schließt Mitgliedschaften nur beim Beenden oder Archivieren", () => {
    expect(shouldCloseMemberships("planning")).toBe(false);
    expect(shouldCloseMemberships("active")).toBe(false);
    expect(shouldCloseMemberships("finished")).toBe(true);
    expect(shouldCloseMemberships("archived")).toBe(true);
  });

  it("setzt archivedAt nur beim Archivieren", () => {
    expect(buildProductionStatusUpdate("archived", now)).toEqual({
      status: "archived",
      statusChangedAt: now,
      archivedAt: now,
    });
    expect(buildProductionStatusUpdate("active", now)).toMatchObject({ archivedAt: null });
  });

  it("filtert aktuelle Mitgliedschaften nach Status und Produktion", () => {
    expect(currentMembershipWhere(now)).toEqual({
      status: "active",
      OR: [{ leftAt: null }, { leftAt: { gt: now } }],
      show: { status: { in: ["planning", "active"] } },
    });
  });
});
