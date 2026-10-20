import { describe, expect, it } from "vitest";

import { renderMail } from "../layout";

describe("renderMail", () => {
  it("baut Text- und HTML-Fassung aus denselben Bausteinen", () => {
    const mail = renderMail({
      subject: "Probe abgesagt",
      greeting: "Hallo Anna,",
      blocks: [
        { type: "paragraph", text: "Die Probe <Sa> fällt aus." },
        { type: "button", label: "Termin öffnen", url: "https://x.example/t/1?a=1&b=2" },
        { type: "details", rows: [["Wann", "Sa, 14:00"]] },
      ],
      unsubscribeUrl: "https://x.example/email/abmelden?t=abc",
    });

    expect(mail.text).toContain("Hallo Anna,");
    expect(mail.text).toContain("Termin öffnen:\nhttps://x.example/t/1?a=1&b=2");
    expect(mail.text).toContain("Wann: Sa, 14:00");
    expect(mail.text).toContain("Abbestellen: https://x.example/email/abmelden?t=abc");
    expect(mail.html).toContain("Die Probe &lt;Sa&gt; fällt aus.");
    expect(mail.html).toContain('href="https://x.example/t/1?a=1&amp;b=2"');
    expect(mail.html).not.toContain("<Sa>");
  });

  it("lässt den Gruß weg, wenn signature null ist", () => {
    const mail = renderMail({ subject: "s", signature: null, blocks: [] });
    expect(mail.text).not.toContain("Viele Grüße");
  });
});

describe("renderPlainTextMail", () => {
  it("macht aus Altbestand Anrede, Knopf, Tabelle und Liste – Text bleibt gleich", async () => {
    const { renderPlainTextMail } = await import("../layout");
    const text = [
      "Hallo Anna,",
      "",
      "bitte bestätigen:",
      "",
      "https://x.example/r/abc",
      "",
      "Stück: Faust\nCode: K-1",
      "",
      "- eins\n- zwei",
    ].join("\n");
    const mail = renderPlainTextMail("Betreff", text, { buttonLabel: "Bestätigen" });
    expect(mail.text).toBe(text);
    expect(mail.html).toContain(">Bestätigen</a>");
    expect(mail.html).toContain(">Stück</td>");
    expect(mail.html).toContain("<li");
  });
});
