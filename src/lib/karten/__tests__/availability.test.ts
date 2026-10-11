import { describe, expect, it } from "vitest";

import { availabilityLevel, computeAvailability, seatsAvailableFor } from "../availability";
import { isReservationCode, normalizeReservationCode, generateReservationCode } from "../codes";
import { describeItems, parsePriceToCents } from "../constants";

describe("computeAvailability", () => {
  it("hält die Abendkassen-Reserve von Online-Buchungen frei", () => {
    const result = computeAvailability(
      { capacity: 100, onlineLimit: null, boxOfficeReserve: 20 },
      { total: 70, online: 50 },
    );
    expect(result.online).toBe(10);
    expect(result.office).toBe(30);
    expect(seatsAvailableFor(result, "online")).toBe(10);
    expect(seatsAvailableFor(result, "free_ticket")).toBe(10);
    expect(seatsAvailableFor(result, "phone")).toBe(30);
  });

  it("begrenzt Online-Buchungen auf das Online-Kontingent", () => {
    const result = computeAvailability(
      { capacity: 100, onlineLimit: 40, boxOfficeReserve: 0 },
      { total: 50, online: 35 },
    );
    expect(result.online).toBe(5);
    expect(result.office).toBe(50);
  });

  it("wird bei Überbuchung nicht negativ", () => {
    const result = computeAvailability(
      { capacity: 10, onlineLimit: 5, boxOfficeReserve: 2 },
      { total: 12, online: 8 },
    );
    expect(result).toMatchObject({ online: 0, office: 0 });
  });
});

describe("availabilityLevel", () => {
  it("unterscheidet frei, wenige und ausgebucht", () => {
    expect(availabilityLevel(0, 150)).toBe("sold_out");
    expect(availabilityLevel(8, 150)).toBe("few");
    expect(availabilityLevel(40, 150)).toBe("free");
    expect(availabilityLevel(3, 20)).toBe("few");
  });
});

describe("Codes", () => {
  it("erzeugt diktierbare Codes", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateReservationCode();
      expect(isReservationCode(code)).toBe(true);
      expect(code).not.toMatch(/[01ILO]/);
    }
  });

  it("normalisiert Eingaben und Links", () => {
    expect(normalizeReservationCode(" k7f-3qx ")).toBe("K7F3QX");
    expect(normalizeReservationCode("https://x.de/karten/c/K7F3QX")).toBe("K7F3QX");
  });
});

describe("Preise", () => {
  it("liest deutsche Eingaben", () => {
    expect(parsePriceToCents("12")).toBe(1200);
    expect(parsePriceToCents("12,50 €")).toBe(1250);
    expect(parsePriceToCents("7.5")).toBe(750);
    expect(parsePriceToCents("")).toBe(0);
    expect(parsePriceToCents("abc")).toBeNull();
  });

  it("beschreibt Positionen", () => {
    expect(
      describeItems([
        { label: "Erwachsene", quantity: 2 },
        { label: "Kinder", quantity: 0 },
        { label: "Ermäßigt", quantity: 1 },
      ]),
    ).toBe("2 × Erwachsene, 1 × Ermäßigt");
  });
});
