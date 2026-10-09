import { describe, expect, it } from "vitest";

import { buildPlot } from "@/app/(members)/mitglieder/meine-gewerke/ausstattung/costume-views";
import { buildChangeovers } from "@/app/(members)/mitglieder/meine-gewerke/ausstattung/set-views";
import { formatCents, parseEuroToCents } from "@/lib/ausstattung/constants";
import type { ObjectListItem, StageData } from "@/lib/ausstattung/objects";

const object = (id: string, sceneIds: string[], characterIds: string[] = []): ObjectListItem => ({
  id,
  kind: "costume",
  title: id,
  description: null,
  status: "planned",
  source: "undecided",
  costCents: null,
  dimensions: null,
  sceneIds,
  sceneNotes: {},
  characterIds,
  partIds: [],
  partOfIds: [],
  photoId: null,
  photoCount: 0,
  taskId: null,
  checklistDone: 0,
  checklistTotal: 0,
  checkedAt: null,
  inventoryLabel: null,
  nextRehearsal: null,
  archived: false,
});

const stage: StageData = {
  scenes: [
    { id: "s1", act: 1, identifier: "1.1", title: null, characterIds: ["zettel"] },
    { id: "s2", act: 1, identifier: "1.2", title: null, characterIds: ["zettel"] },
    { id: "s3", act: 1, identifier: "1.3", title: null, characterIds: [] },
  ],
  characters: [{ id: "zettel", name: "Zettel", color: null, cast: [] }],
};

describe("Kostümplot", () => {
  it("meldet Umzug zwischen direkt folgenden Szenen", () => {
    const plot = buildPlot(
      [object("weber", ["s1"], ["zettel"]), object("esel", ["s2"], ["zettel"])],
      stage,
    );
    expect(plot.changes).toHaveLength(1);
    expect(plot.changes[0]?.toCostume.id).toBe("esel");
    expect(plot.missing).toBe(0);
  });

  it("zählt Auftritte ohne Kostüm", () => {
    const plot = buildPlot([object("weber", ["s1"], ["zettel"])], stage);
    expect(plot.missing).toBe(1);
    expect(plot.changes).toHaveLength(0);
  });
});

describe("Umbauten", () => {
  it("teilt in raus, rein und bleibt", () => {
    const [first, second] = buildChangeovers(
      [object("tisch", ["s1", "s2"]), object("thron", ["s1"]), object("laube", ["s2", "s3"])],
      stage,
    );
    expect(first?.out.map((o) => o.id)).toEqual(["thron"]);
    expect(first?.in.map((o) => o.id)).toEqual(["laube"]);
    expect(first?.stays.map((o) => o.id)).toEqual(["tisch"]);
    expect(second?.out.map((o) => o.id)).toEqual(["tisch"]);
  });
});

describe("Euro", () => {
  it("liest deutsche Beträge", () => {
    expect(parseEuroToCents("12,50")).toBe(1250);
    expect(parseEuroToCents("1.200,5 €")).toBe(120050);
    expect(parseEuroToCents("")).toBeNull();
    expect(formatCents(1250)).toContain("12,50");
  });
});
