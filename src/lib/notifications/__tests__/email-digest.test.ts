import { describe, expect, it } from "vitest";

import { verifyUnsubscribeSignature, unsubscribePageUrl } from "@/lib/email/unsubscribe";

import { buildDigestMail, isDigestDue, lastDigestSlot } from "../digest";
import { buildNotificationMail } from "../email";
import { resolveEmailMode, shouldEmailInstantly } from "../preferences";

describe("shouldEmailInstantly", () => {
  const info = { kind: "info" as const, priority: "normal" as const };
  it("schickt Dringendes und Aufgaben immer, auch bei „Aus“", () => {
    expect(shouldEmailInstantly({ kind: "action", priority: "normal" }, "off")).toBe(true);
    expect(shouldEmailInstantly({ kind: "info", priority: "urgent" }, "off")).toBe(true);
  });
  it("schickt übrige Hinweise nur bei „Sofort“ oder erzwungen", () => {
    expect(shouldEmailInstantly(info, "digest")).toBe(false);
    expect(shouldEmailInstantly(info, "instant")).toBe(true);
    expect(shouldEmailInstantly(info, "digest", true)).toBe(true);
    expect(shouldEmailInstantly(info, "off", true)).toBe(false);
  });
  it("nimmt ohne Eintrag die Zusammenfassung", () => {
    expect(resolveEmailMode(null)).toBe("digest");
    expect(resolveEmailMode("quatsch")).toBe("digest");
  });
});

describe("Zusammenfassung fällig", () => {
  // 2026-10-20 ist ein Dienstag; 18 Uhr Berlin = 16 Uhr UTC (Sommerzeit).
  it("täglich: Slot 18 Uhr heute bzw. gestern", () => {
    expect(lastDigestSlot("daily", new Date("2026-10-20T17:00:00Z")).toISOString()).toBe(
      "2026-10-20T16:00:00.000Z",
    );
    expect(lastDigestSlot("daily", new Date("2026-10-20T10:00:00Z")).toISOString()).toBe(
      "2026-10-19T16:00:00.000Z",
    );
  });
  it("wöchentlich: letzter Montag 18 Uhr", () => {
    expect(lastDigestSlot("weekly", new Date("2026-10-20T10:00:00Z")).toISOString()).toBe(
      "2026-10-19T16:00:00.000Z",
    );
  });
  it("einmal pro Slot", () => {
    const now = new Date("2026-10-20T17:00:00Z");
    expect(isDigestDue("daily", null, now)).toBe(true);
    expect(isDigestDue("daily", new Date("2026-10-20T16:05:00Z"), now)).toBe(false);
    expect(isDigestDue("daily", new Date("2026-10-19T16:05:00Z"), now)).toBe(true);
    expect(isDigestDue("off", null, now)).toBe(false);
  });
});

describe("Mails", () => {
  it("Benachrichtigung mit Knopf, Abmeldelink und Präfix bei Dringendem", () => {
    const mail = buildNotificationMail({
      userId: "u1",
      firstName: "Anna",
      title: "Probe abgesagt",
      body: "Sa 14 Uhr fällt aus",
      actionUrl: "/mitglieder/termine/e1",
      category: "proben",
      urgent: true,
      action: false,
    });
    expect(mail.subject).toBe("Dringend: Probe abgesagt");
    expect(mail.text).toContain("/mitglieder/termine/e1");
    expect(mail.text).toContain("/email/abmelden?u=u1");
  });
  it("Zusammenfassung gruppiert nach Bereich", () => {
    const mail = buildDigestMail({
      userId: "u1",
      firstName: null,
      mode: "daily",
      items: [
        {
          recipientId: "r1",
          title: "Neue Probe",
          body: null,
          actionUrl: null,
          category: "proben",
          createdAt: new Date("2026-10-20T08:00:00Z"),
        },
        {
          recipientId: "r2",
          title: "Neue Aufgabe im Gewerk",
          body: null,
          actionUrl: null,
          category: "gewerke",
          createdAt: new Date("2026-10-20T09:00:00Z"),
        },
      ],
    });
    expect(mail.subject).toBe("Zusammenfassung: 2 neue Hinweise");
    expect(mail.text).toMatch(/PROBEN[\s\S]*Neue Probe[\s\S]*GEWERKE/);
  });
  it("Abmeldelink ist signiert", () => {
    const url = new URL(unsubscribePageUrl("u1"));
    expect(verifyUnsubscribeSignature("u1", url.searchParams.get("s") ?? "")).toBe(true);
    expect(verifyUnsubscribeSignature("u2", url.searchParams.get("s") ?? "")).toBe(false);
  });
});
