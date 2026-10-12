import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/calendar/protocol-server", () => ({ getProtocolAccess: vi.fn() }));

const { eventFolder, mediaKeys, mediaKindFor, safeFileName } =
  await import("@/lib/media/event-media");

describe("mediaKindFor", () => {
  it("erkennt Fotos, Audio (auch mit Codec-Angabe) und PDF", () => {
    expect(mediaKindFor("image/jpeg")).toBe("IMAGE");
    expect(mediaKindFor("audio/webm;codecs=opus")).toBe("AUDIO");
    expect(mediaKindFor("audio/mp4")).toBe("AUDIO");
    expect(mediaKindFor("application/pdf")).toBe("FILE");
  });

  it("lehnt andere Typen ab", () => {
    expect(mediaKindFor("application/x-msdownload")).toBeNull();
    expect(mediaKindFor("text/html")).toBeNull();
    expect(mediaKindFor("")).toBeNull();
  });
});

describe("Pfade im Speicher", () => {
  const event = {
    title: "Szenenprobe 1.3, 2.4",
    // 22:30 UTC = 00:30 in Berlin am Folgetag
    start: new Date("2027-05-13T22:30:00Z"),
    show: { year: 2027, title: "Ein Sommernachtstraum" },
  };

  it("legt Termine lesbar unter Produktion und Datum ab (Ortszeit)", () => {
    expect(eventFolder(event)).toBe(
      "produktionen/2027-ein-sommernachtstraum/proben/2027-05-14-szenenprobe-1-3-2-4/",
    );
    expect(eventFolder({ ...event, show: null })).toBe("termine/2027-05-14-szenenprobe-1-3-2-4/");
  });

  it("baut Datei- und Vorschaupfad mit ID", () => {
    expect(
      mediaKeys("p/", { id: "abc", kind: "IMAGE", fileName: "IMG_0042.HEIC", ext: "webp" }),
    ).toEqual({ storageKey: "p/fotos/abc-img-0042.webp", thumbKey: "p/fotos/vorschau/abc.webp" });
    expect(mediaKeys("p/", { id: "abc", kind: "AUDIO", fileName: "Lied 3 (Probe).m4a" })).toEqual({
      storageKey: "p/audio/abc-lied-3-probe.m4a",
      thumbKey: null,
    });
  });

  it("macht Dateinamen sicher", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\Bilder\\foto.jpg")).toBe("foto.jpg");
    expect(safeFileName("Übergabe Kostüm.PDF")).toBe("ubergabe-kostum.pdf");
    expect(safeFileName("")).toBe("datei");
  });
});
