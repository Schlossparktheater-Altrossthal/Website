import { describe, expect, it } from "vitest";

import { resolveEventUrl } from "../event-client";

describe("resolveEventUrl", () => {
  it("hängt den Basispfad nicht doppelt an (Docker-Konfiguration)", () => {
    expect(resolveEventUrl("http://127.0.0.1:3001/realtime", "/realtime/events")).toBe(
      "http://127.0.0.1:3001/realtime/events",
    );
  });

  it("setzt Basis und Pfad sonst zusammen", () => {
    expect(resolveEventUrl("http://localhost:4001", "/events")).toBe(
      "http://localhost:4001/events",
    );
    expect(resolveEventUrl("http://localhost:4001/realtime/", "events")).toBe(
      "http://localhost:4001/realtime/events",
    );
  });
});
