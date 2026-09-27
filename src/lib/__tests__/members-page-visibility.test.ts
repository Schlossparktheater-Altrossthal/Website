import { describe, expect, it } from "vitest";

import { findMemberPageKey, isMemberPageHidden } from "@/lib/members-page-visibility";

describe("members page visibility", () => {
  it("ordnet Unterseiten dem spezifischsten Menüeintrag zu", () => {
    expect(findMemberPageKey("/mitglieder/produktionen/stueck/abc")).toBe(
      "/mitglieder/produktionen/stueck",
    );
    expect(findMemberPageKey("/mitglieder/produktionen")).toBe("/mitglieder/produktionen");
    expect(findMemberPageKey("/mitglieder/sperrliste/")).toBe("/mitglieder/sperrliste");
  });

  it("sperrt ausgeblendete Seiten samt Unterseiten", () => {
    const visibility = { "/mitglieder/sperrliste": false };
    expect(isMemberPageHidden("/mitglieder/sperrliste", visibility)).toBe(true);
    expect(isMemberPageHidden("/mitglieder/sperrliste/export", visibility)).toBe(true);
    expect(isMemberPageHidden("/mitglieder/profil", visibility)).toBe(false);
  });

  it("blendet eine Elternseite aus, ohne eigene Unterseiten-Einträge mitzusperren", () => {
    const visibility = { "/mitglieder/produktionen": false };
    expect(isMemberPageHidden("/mitglieder/produktionen", visibility)).toBe(true);
    expect(isMemberPageHidden("/mitglieder/produktionen/stueck", visibility)).toBe(false);
  });

  it("lässt Dashboard und Seitensteuerung nie sperren", () => {
    const visibility = { "/mitglieder": false, "/mitglieder/pages/seitensteuerung": false };
    expect(isMemberPageHidden("/mitglieder", visibility)).toBe(false);
    expect(isMemberPageHidden("/mitglieder/pages/seitensteuerung", visibility)).toBe(false);
  });
});
