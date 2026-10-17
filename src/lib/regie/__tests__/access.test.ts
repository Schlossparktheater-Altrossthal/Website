import { describe, expect, it } from "vitest";

import { isDirectionViewPathAllowed } from "@/lib/regie/paths";
import { pickDirectionShow, sortDirectionShows, type DirectionShow } from "@/lib/regie/access";

const show = (id: string, year: number, title = id): DirectionShow => ({
  id,
  title,
  year,
  departmentName: "Regie",
});

describe("isDirectionViewPathAllowed", () => {
  it("lässt Dashboard, Profil und Benachrichtigungen zu", () => {
    expect(isDirectionViewPathAllowed("/mitglieder/regie")).toBe(true);
    expect(isDirectionViewPathAllowed("/mitglieder/regie/")).toBe(true);
    expect(isDirectionViewPathAllowed("/mitglieder/regie/wuensche")).toBe(true);
    expect(isDirectionViewPathAllowed("/mitglieder/profil")).toBe(true);
    expect(isDirectionViewPathAllowed("/mitglieder/benachrichtigungen")).toBe(true);
  });

  it("sperrt alles andere", () => {
    expect(isDirectionViewPathAllowed("/mitglieder")).toBe(false);
    expect(isDirectionViewPathAllowed("/mitglieder/terminplanung")).toBe(false);
    expect(isDirectionViewPathAllowed("/mitglieder/regiezentrale")).toBe(false);
  });
});

describe("pickDirectionShow", () => {
  const shows = sortDirectionShows([show("alt", 2026), show("neu", 2027)]);

  it("nimmt ohne Auswahl die neueste Produktion", () => {
    expect(pickDirectionShow(shows, null)?.id).toBe("neu");
  });

  it("nimmt die gewählte Produktion, wenn erlaubt", () => {
    expect(pickDirectionShow(shows, "alt")?.id).toBe("alt");
    expect(pickDirectionShow(shows, "fremd")?.id).toBe("neu");
  });

  it("liefert null ohne Produktionen", () => {
    expect(pickDirectionShow([], "alt")).toBeNull();
  });
});
