import { describe, expect, it } from "vitest";

import type { DoorSnapshot } from "../checkin";
import { applyPending, doorCounters, searchGuests } from "../door-state";

const snapshot: DoorSnapshot = {
  eventId: "e1",
  capacity: 100,
  boxOfficeTickets: 3,
  boxOfficeCents: 3000,
  serverTime: "2026-07-01T17:00:00Z",
  guests: [
    {
      id: "r1",
      code: "ABC234",
      name: "Müller, Anna",
      source: "online",
      status: "confirmed",
      tickets: 4,
      checkedIn: 1,
      summary: "",
      note: null,
      openCents: 0,
      via: null,
    },
    {
      id: "r2",
      code: "XYZ789",
      name: "Jörg Schröder",
      source: "phone",
      status: "confirmed",
      tickets: 2,
      checkedIn: 0,
      summary: "",
      note: null,
      openCents: 1600,
      via: null,
    },
  ],
};

describe("doorCounters", () => {
  it("zählt erwartet, anwesend, frei", () => {
    expect(doorCounters(snapshot)).toEqual({
      expected: 6,
      present: 1,
      missing: 5,
      inside: 4,
      free: 91,
      boxOfficeTickets: 3,
    });
  });
});

describe("applyPending", () => {
  it("wendet Check-ins begrenzt und Verkäufe an", () => {
    const next = applyPending(
      snapshot,
      [
        { id: "m1", type: "checkin", reservationId: "r1", delta: 10, occurredAt: "" },
        { id: "m2", type: "checkin", reservationId: "r2", delta: -1, occurredAt: "" },
        { id: "m3", type: "sale", items: [{ categoryId: "c1", quantity: 2 }], occurredAt: "" },
      ],
      new Map([["c1", 800]]),
    );
    expect(next.guests.find((g) => g.id === "r1")?.checkedIn).toBe(4);
    expect(next.guests.find((g) => g.id === "r2")?.checkedIn).toBe(0);
    expect(next.boxOfficeTickets).toBe(5);
    expect(next.boxOfficeCents).toBe(4600);
    expect(snapshot.guests[0].checkedIn).toBe(1);
  });

  it("setzt offene Beträge nach dem Kassieren auf 0", () => {
    const next = applyPending(snapshot, [
      { id: "m4", type: "pay", reservationId: "r2", occurredAt: "" },
    ]);
    expect(next.guests.find((g) => g.id === "r2")?.openCents).toBe(0);
  });
});

describe("searchGuests", () => {
  it("findet Wortanfänge ohne Umlaute und Codes", () => {
    expect(searchGuests(snapshot.guests, "mull").map((g) => g.id)).toEqual(["r1"]);
    expect(searchGuests(snapshot.guests, "jo schr").map((g) => g.id)).toEqual(["r2"]);
    expect(searchGuests(snapshot.guests, "xyz7").map((g) => g.id)).toEqual(["r2"]);
    expect(searchGuests(snapshot.guests, "")).toHaveLength(2);
  });
});
