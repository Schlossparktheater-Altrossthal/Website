import { describe, expect, it } from "vitest";

import type { LiveAxis } from "../live/axis";
import { buildProtocol, classifyKind, type ProtocolSample } from "../live/protocol";

/** 3 Szenen à 10 Absätze à 100 Zeichen → Achse 0–3000. */
const axis: LiveAxis = {
  starts: Array.from({ length: 30 }, (_, i) => i * 100),
  lengths: Array.from({ length: 30 }, () => 100),
  total: 3000,
};
const blockScenes = Array.from({ length: 30 }, (_, i) => `s${Math.floor(i / 10) + 1}`);
const scenes = [
  { id: "s1", title: "Szene 1" },
  { id: "s2", title: "Szene 2" },
  { id: "s3", title: "Szene 3" },
];

/** Alle 5 s ein Punkt; `steps` = Zeichen je Punkt. */
function run(start: { at: number; pos: number }, steps: number[], roleIds?: string[]) {
  const samples: ProtocolSample[] = [];
  let { at, pos } = start;
  samples.push({ at, pos, active: 3, roleIds });
  for (const step of steps) {
    at += 5000;
    pos += step;
    samples.push({ at, pos, active: 3, roleIds });
  }
  return samples;
}

const build = (samples: ProtocolSample[], sceneRoles?: Record<string, string[]>) =>
  buildProtocol({ samples, axis, blockScenes, scenes, sceneRoles });

describe("buildProtocol", () => {
  it("liefert null ohne Messpunkte", () => {
    expect(build([])).toBeNull();
  });

  it("misst Szenen bei gleichmäßigem Lesen und erkennt einen Durchlauf", () => {
    // 15 Zeichen/s → 75 je Punkt, 3000 Zeichen in 200 s.
    const samples = run({ at: 0, pos: 0 }, Array(40).fill(75));
    const protocol = build(samples)!;
    expect(protocol.scenes.map((scene) => scene.sceneId)).toEqual(["s1", "s2", "s3"]);
    for (const scene of protocol.scenes) {
      expect(scene.netSeconds).toBeGreaterThan(60);
      expect(scene.coverage).toBeGreaterThan(0.95);
    }
    expect(protocol.repeats).toHaveLength(0);
    expect(protocol.stops).toHaveLength(0);
    expect(protocol.kind).toBe("durchlauf");
    expect(protocol.segments.map((segment) => segment.sceneId)).toEqual(["s1", "s2", "s3"]);
  });

  it("erkennt Wiederholung, Stillstand und Pause", () => {
    const samples = run({ at: 0, pos: 0 }, [
      ...Array(10).fill(50), // bis 500
      -400, // zurück auf 100 → Wiederholung
      ...Array(8).fill(50), // bis 500
      ...Array(8).fill(0), // 40 s Stillstand
      ...Array(4).fill(50),
      ...Array(70).fill(0), // 350 s Pause
      ...Array(4).fill(50),
    ]);
    const protocol = build(samples)!;
    expect(protocol.repeats).toHaveLength(1);
    expect(protocol.repeats[0]).toMatchObject({ from: 500, to: 100, sceneId: "s1" });
    const stops = protocol.stops.filter((stop) => !stop.pause);
    const pauses = protocol.stops.filter((stop) => stop.pause);
    expect(stops).toHaveLength(1);
    expect(stops[0].seconds).toBe(40);
    expect(pauses).toHaveLength(1);
    expect(pauses[0].seconds).toBe(350);
    expect(protocol.pauseSeconds).toBe(350);
    const s1 = protocol.scenes.find((scene) => scene.sceneId === "s1")!;
    expect(s1.repeats).toBe(1);
    expect(s1.stops).toBe(1);
    // Pause zählt nicht brutto.
    expect(s1.grossSeconds).toBeLessThan(200);
  });

  it("markiert übersprungene Bereiche, die nicht nachgeholt wurden", () => {
    const samples = run({ at: 0, pos: 0 }, [
      ...Array(10).fill(60), // bis 600
      1400, // Sprung auf 2000 (Szene 2 fast ganz übersprungen)
      ...Array(10).fill(60),
    ]);
    const protocol = build(samples)!;
    expect(protocol.skipped).toHaveLength(1);
    expect(protocol.skipped[0].from).toBe(600);
    expect(protocol.skipped[0].to).toBe(2000);
    expect(protocol.skipped[0].sceneIds).toEqual(["s1", "s2"]);
  });

  it("nachgeholter Sprung ist nicht übersprungen", () => {
    const samples = run({ at: 0, pos: 0 }, [
      ...Array(4).fill(50), // bis 200
      800, // Sprung auf 1000
      ...Array(4).fill(50), // bis 1200
      -1000, // zurück auf 200 (Wiederholung)
      ...Array(16).fill(50), // bis 1000
    ]);
    expect(build(samples)!.skipped).toHaveLength(0);
  });

  it("Lücken ohne Messpunkt zählen nicht", () => {
    const samples = [
      ...run({ at: 0, pos: 0 }, Array(4).fill(50)),
      ...run({ at: 20_000 + 10 * 60_000, pos: 250 }, Array(4).fill(50)),
    ];
    const protocol = build(samples)!;
    expect(protocol.gapSeconds).toBe(600);
    expect(protocol.stops).toHaveLength(0);
  });

  it("Rollen: dabei und fehlend je Szene", () => {
    const samples = run({ at: 0, pos: 0 }, Array(12).fill(75), ["r1", "r2"]);
    const protocol = build(samples, { s1: ["r1", "r3"], s2: ["r2"] })!;
    const s1 = protocol.scenes.find((scene) => scene.sceneId === "s1")!;
    expect(s1.presentRoleIds.sort()).toEqual(["r1", "r2"]);
    expect(s1.missingRoleIds).toEqual(["r3"]);
  });

  it("private Aufnahme ohne Rollen meldet nichts als fehlend", () => {
    const protocol = build(run({ at: 0, pos: 0 }, Array(12).fill(75)), { s1: ["r1"] })!;
    expect(protocol.scenes[0].missingRoleIds).toEqual([]);
  });
});

describe("classifyKind", () => {
  it("braucht mindestens 2 Minuten", () => {
    expect(classifyKind({ readingSeconds: 60, stopSeconds: 0, repeats: 0 })).toBeNull();
  });
  it("viele Wiederholungen = Szenenarbeit", () => {
    expect(classifyKind({ readingSeconds: 1800, stopSeconds: 300, repeats: 8 })).toBe(
      "szenenarbeit",
    );
  });
  it("mittlere Unterbrechungen = Leseprobe", () => {
    expect(classifyKind({ readingSeconds: 3000, stopSeconds: 900, repeats: 4 })).toBe("leseprobe");
  });
});
