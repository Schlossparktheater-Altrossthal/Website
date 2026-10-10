import { describe, expect, it } from "vitest";

import { isVersionSkewError } from "../version-skew";

describe("isVersionSkewError", () => {
  it("erkennt fehlende Chunks und Server Actions nach einem Release", () => {
    expect(
      isVersionSkewError("Uncaught ChunkLoadError: Failed to load chunk /_next/static/chunks/a.js"),
    ).toBe(true);
    expect(
      isVersionSkewError('Server Action "40f6ef32" was not found on the server. Read more'),
    ).toBe(true);
  });

  it("lässt andere Fehler in Ruhe", () => {
    expect(isVersionSkewError("TypeError: Load failed")).toBe(false);
  });
});
