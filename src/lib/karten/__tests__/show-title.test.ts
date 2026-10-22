import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/email/send", () => ({ createConfiguredMailSender: vi.fn() }));

import { isShowRevealed, showDisplayTitle } from "../mails";

const now = new Date("2026-10-22T12:00:00Z");
const base = { title: "Geheimes Stück", year: 2027 };

describe("showDisplayTitle", () => {
  it("verrät den Titel ohne Enthüllungsdatum nicht", () => {
    expect(isShowRevealed({ revealedAt: null }, now)).toBe(false);
    expect(showDisplayTitle({ ...base, revealedAt: null }, now)).not.toContain("Geheimes");
    expect(showDisplayTitle({ ...base, revealedAt: null }, now)).toContain("2027");
  });

  it("verrät den Titel vor dem Enthüllungsdatum nicht", () => {
    const revealedAt = new Date("2027-01-01T00:00:00Z");
    expect(showDisplayTitle({ ...base, revealedAt }, now)).not.toContain("Geheimes");
  });

  it("zeigt den Titel ab dem Enthüllungsdatum", () => {
    const revealedAt = new Date("2026-10-01T00:00:00Z");
    expect(showDisplayTitle({ ...base, revealedAt }, now)).toBe("Geheimes Stück");
  });
});
