import { describe, expect, it } from "vitest";

import {
  extractCredits,
  isPersonName,
  joinNames,
  mergeCredits,
  newCreditNames,
} from "@/lib/skript/credits";

describe("Mitwirkende aus dem Vorspann", () => {
  it("liest mehrere Angaben aus einer Zeile (Die unendliche Geschichte)", () => {
    expect(
      extractCredits([
        "Die unendliche Geschichte",
        "Bühnenfassung John von Düffel – Bearbeitung Hannes Sell und Elke Zeh",
        "Schlossparktheater Dresden, Altroßthal 2026",
        "Stand: 17.4.2026",
      ]),
    ).toEqual([
      { kind: "adaptation", label: "Bühnenfassung", names: ["John von Düffel"] },
      { kind: "adaptation", label: "Bearbeitung", names: ["Hannes Sell", "Elke Zeh"] },
    ]);
  });

  it("trennt „Mitarbeit“ ab (Fassung 15.6.)", () => {
    expect(extractCredits(["Bearbeitung Elke Zeh und Mitarbeit Hannes Sell"])).toEqual([
      { kind: "adaptation", label: "Bearbeitung", names: ["Elke Zeh"] },
      { kind: "adaptation", label: "Mitarbeit", names: ["Hannes Sell"] },
    ]);
  });

  it("erkennt Vorlage, Autor-Zeile und Regie mit Doppelpunkt", () => {
    expect(
      extractCredits([
        "nach dem Roman von Michael Ende",
        "von Max Frisch",
        "Regie: Anna Beispiel, Ben Muster",
        "Regieassistenz: Clara Probe",
      ]),
    ).toEqual([
      { kind: "basedOn", label: "Nach dem Roman von", names: ["Michael Ende"] },
      { kind: "author", label: "von", names: ["Max Frisch"] },
      { kind: "direction", label: "Regie", names: ["Anna Beispiel", "Ben Muster"] },
      { kind: "other", label: "Regieassistenz", names: ["Clara Probe"] },
    ]);
  });

  it("verwirft Stichwörter ohne Namen und Wörter, die nur so anfangen", () => {
    expect(extractCredits(["Text und Musik werden noch ergänzt", "Textbuch Seite 3"])).toEqual([]);
    expect(extractCredits(["Regie Hans Wurst Stand 3.5."])).toEqual([
      { kind: "direction", label: "Regie", names: ["Hans Wurst"] },
    ]);
  });

  it("prüft Namen auf Plausibilität", () => {
    expect(isPersonName("John von Düffel")).toBe(true);
    expect(isPersonName("Elke Zeh")).toBe(true);
    expect(isPersonName("Schlossparktheater")).toBe(false);
    expect(isPersonName("werden noch ergänzt")).toBe(false);
  });

  it("findet neue Namen und ergänzt, ohne etwas zu entfernen", () => {
    const saved = [{ kind: "direction" as const, label: "Regie", names: ["Elke Zeh"] }];
    const found = [
      { kind: "direction" as const, label: "Regie", names: ["elke zeh", "Hannes Sell"] },
    ];
    expect(newCreditNames(saved, found)).toEqual(["Hannes Sell"]);
    expect(mergeCredits(saved, found)).toEqual([
      { kind: "direction", label: "Regie", names: ["Elke Zeh", "Hannes Sell"] },
    ]);
    expect(joinNames(["A B", "C D", "E F"])).toBe("A B, C D und E F");
  });
});
