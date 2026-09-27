import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { PWA_ICON_VARIANTS } from "@/lib/pwa/app-icons";

describe("Web-App-Manifest", () => {
  const data = manifest();

  it("startet im Mitgliederbereich als eigenständige App", () => {
    expect(data).toMatchObject({
      id: "/mitglieder",
      start_url: "/mitglieder",
      display: "standalone",
    });
  });

  it("verweist nur auf vorhandene Icon-Varianten, inklusive maskable", () => {
    const icons = [...(data.icons ?? []), ...(data.shortcuts ?? []).flatMap((s) => s.icons ?? [])];
    for (const icon of icons) {
      const variant = icon.src.replace("/pwa-icons/", "");
      expect(Object.keys(PWA_ICON_VARIANTS)).toContain(variant);
    }
    expect(data.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});
