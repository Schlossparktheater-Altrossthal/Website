import { describe, expect, it } from "vitest";

import { resolveProductionSwitchTarget } from "@/lib/produktionen/switch-target";

const OLD = "cm1oldproductionid000001";
const NEW = "cm1newproductionid000002";

describe("resolveProductionSwitchTarget", () => {
  it("bleibt auf Seiten, die nur über die angezeigte Produktion laufen", () => {
    expect(resolveProductionSwitchTarget("/mitglieder/sperrliste", OLD, NEW)).toBe(
      "/mitglieder/sperrliste",
    );
  });

  it("ersetzt die ID der alten Produktion", () => {
    expect(
      resolveProductionSwitchTarget(`/mitglieder/produktionen/${OLD}/ensemble`, OLD, NEW),
    ).toBe(`/mitglieder/produktionen/${NEW}/ensemble`);
  });

  it("geht bei Datensätzen der alten Produktion auf die übergeordnete Seite", () => {
    expect(
      resolveProductionSwitchTarget(
        "/mitglieder/proben/cm1rehearsal000000000099/protokoll",
        OLD,
        NEW,
      ),
    ).toBe("/mitglieder/proben");
  });

  it("fällt außerhalb des Mitgliederbereichs auf die Übersicht zurück", () => {
    expect(resolveProductionSwitchTarget("/", OLD, NEW)).toBe("/mitglieder/produktionen");
    expect(resolveProductionSwitchTarget(null, OLD, NEW)).toBe("/mitglieder/produktionen");
  });
});
