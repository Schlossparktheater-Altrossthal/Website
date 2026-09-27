import { describe, expect, it } from "vitest";

import { isInQuietHours, minutesToTime, shouldPush, timeToMinutes } from "../preferences";

// 2026-09-27 ist Sommerzeit: Berlin = UTC+2
const at = (berlinTime: string) => new Date(`2026-09-27T${berlinTime}:00+02:00`);

describe("isInQuietHours", () => {
  it("erkennt Zeiträume über Mitternacht", () => {
    const quiet = { start: 22 * 60, end: 7 * 60 };
    expect(isInQuietHours(quiet, at("23:30"))).toBe(true);
    expect(isInQuietHours(quiet, at("06:59"))).toBe(true);
    expect(isInQuietHours(quiet, at("07:00"))).toBe(false);
    expect(isInQuietHours(quiet, at("12:00"))).toBe(false);
  });

  it("erkennt Zeiträume am Tag und ignoriert leere", () => {
    expect(isInQuietHours({ start: 13 * 60, end: 15 * 60 }, at("14:00"))).toBe(true);
    expect(isInQuietHours({ start: 13 * 60, end: 15 * 60 }, at("15:00"))).toBe(false);
    expect(isInQuietHours({ start: 600, end: 600 }, at("10:00"))).toBe(false);
    expect(isInQuietHours(null, at("10:00"))).toBe(false);
  });
});

describe("shouldPush", () => {
  it("Aufgaben und Dringendes immer, übrige Hinweise nur eingeschaltet", () => {
    const info = { category: "proben", kind: "info", priority: "normal" } as const;
    expect(shouldPush({ ...info, kind: "action" }, { category: "proben", push: false })).toBe(true);
    expect(shouldPush(info, undefined)).toBe(false);
    expect(shouldPush(info, { category: "proben", push: true })).toBe(true);
  });
});

describe("Zeitumrechnung", () => {
  it("wandelt hin und zurück", () => {
    expect(minutesToTime(7 * 60 + 5)).toBe("07:05");
    expect(timeToMinutes("22:30")).toBe(22 * 60 + 30);
    expect(timeToMinutes("25:00")).toBeNull();
  });
});
