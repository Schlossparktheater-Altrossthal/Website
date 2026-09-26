import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { generateFeedToken, parseFeedToken } from "@/lib/calendar/feed";

describe("Kalender-Feed-Token", () => {
  it("erzeugt Tokens, die das Pfadsegment wieder erkennt", () => {
    const token = generateFeedToken();
    expect(parseFeedToken(`${token}.ics`)).toBe(token);
    expect(parseFeedToken(token)).toBe(token);
    expect(generateFeedToken()).not.toBe(token);
  });

  it("lehnt kurze oder fremde Segmente ab", () => {
    expect(parseFeedToken("abc.ics")).toBeNull();
    expect(parseFeedToken("../../etc/passwd")).toBeNull();
  });
});
