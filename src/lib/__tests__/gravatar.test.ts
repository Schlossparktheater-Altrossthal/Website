import { describe, expect, it } from "vitest";
import { getGravatarUrl, md5 } from "@/lib/gravatar";

describe("gravatar", () => {
  it("hashes emails with md5", () => {
    expect(md5("user@example.com")).toBe("b58996c504c5638798eb6b511e6f49af");
  });

  it("normalises email before hashing", () => {
    const trimmed = getGravatarUrl(" USER@example.com ");
    const direct = getGravatarUrl("user@example.com");
    expect(trimmed).toBe(direct);
  });

  it("returns default avatar when no email is provided", () => {
    const url = new URL(getGravatarUrl(undefined));
    expect(url.pathname).toBe("/avatar/");
    expect(url.searchParams.get("d")).toBe("mp");
  });

  it("applies requested size within bounds", () => {
    const url = new URL(getGravatarUrl("user@example.com", { size: 4096 }));
    expect(url.searchParams.get("s")).toBe("2048");

    const small = new URL(getGravatarUrl("user@example.com", { size: 12 }));
    expect(small.searchParams.get("s")).toBe("12");
  });
});
