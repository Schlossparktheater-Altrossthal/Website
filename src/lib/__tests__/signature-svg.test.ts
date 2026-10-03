import { describe, expect, it } from "vitest";

import { signatureToSvgGeometry, signatureToSvgString } from "@/lib/signature-svg";
import type { SignaturePayload } from "@/types/signature";

const payload: SignaturePayload = {
  version: "velocity.v1",
  width: 300,
  height: 120,
  duration: 400,
  startedAt: "2026-10-03T10:00:00.000Z",
  endedAt: "2026-10-03T10:00:00.400Z",
  boundingBox: { minX: 10, minY: 20, maxX: 110, maxY: 60 },
  strokes: [
    {
      points: [
        { x: 10, y: 20, time: 0 },
        { x: 50, y: 60, time: 100 },
        { x: 110, y: 40, time: 200 },
      ],
    },
    { points: [{ x: 80, y: 30, time: 300 }] },
  ],
};

describe("signatureToSvgGeometry", () => {
  it("builds one smoothed path per stroke and fits the bounding box", () => {
    const geometry = signatureToSvgGeometry(payload);
    expect(geometry.viewBox).toBe("2 12 116 56");
    expect(geometry.paths).toEqual(["M10 20Q50 60 80 50L110 40", "M80 30l0.1 0"]);
  });

  it("renders a standalone svg document", () => {
    const svg = signatureToSvgString(payload, { stroke: "#000" });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="2 12 116 56">')).toBe(
      true,
    );
    expect(svg.match(/<path /g)).toHaveLength(2);
  });
});
