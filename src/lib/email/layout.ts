import { getAppBaseUrl } from "@/lib/app-url";
import { DEFAULT_SITE_TITLE } from "@/lib/website-settings";

/**
 * Gemeinsames Mail-Layout: Text- und HTML-Fassung aus denselben Bausteinen. HTML mit Tabellen und
 * Inline-Styles, damit es auch in Outlook und Webmailern trägt. Farben sind hier bewusst feste
 * Werte – Mailprogramme kennen die Theme-Tokens der Website nicht.
 */
export type MailBlock =
  | { type: "paragraph"; text: string }
  | { type: "button"; label: string; url: string }
  | { type: "details"; rows: [label: string, value: string][] }
  | { type: "list"; items: string[] }
  | { type: "heading"; text: string }
  | { type: "note"; text: string }
  /** Link als eigene Zeile (z. B. Einladungslink zum Kopieren). */
  | { type: "link"; url: string };

export type MailContent = {
  subject: string;
  /** Vorschauzeile in der Postfachliste. */
  preheader?: string;
  greeting?: string;
  blocks: MailBlock[];
  /** Standard: „Viele Grüße / Sommertheater Altrossthal“. `null` = ohne Gruß. */
  signature?: string | null;
  /** Kleingedrucktes unten, z. B. warum man die Mail bekommt. */
  footer?: string;
  /** Link „Diese Mails abbestellen“ – nur bei Benachrichtigungen. */
  unsubscribeUrl?: string;
  /** Link zu den eigenen Benachrichtigungs-Einstellungen. */
  settingsUrl?: string;
};

export type RenderedMail = { subject: string; text: string; html: string };

const COLORS = {
  page: "#f6f1ea",
  card: "#ffffff",
  text: "#2b2118",
  muted: "#6f6255",
  border: "#e7ddd0",
  accent: "#8e1f2c",
  accentText: "#ffffff",
  soft: "#f8f3ec",
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Text mit Zeilenumbrüchen; nackte URLs werden klickbar. */
function inlineHtml(text: string) {
  return escapeHtml(text)
    .replace(
      /https?:\/\/[^\s<]+/g,
      (url) => `<a href="${url}" style="color:${COLORS.accent};word-break:break-all;">${url}</a>`,
    )
    .replaceAll("\n", "<br>");
}

function blockText(block: MailBlock): string {
  switch (block.type) {
    case "paragraph":
    case "note":
      return block.text;
    case "heading":
      return block.text.toUpperCase();
    case "button":
      return `${block.label}:\n${block.url}`;
    case "link":
      return block.url;
    case "details":
      return block.rows.map(([label, value]) => `${label}: ${value}`).join("\n");
    case "list":
      return block.items.map((item) => `- ${item}`).join("\n");
  }
}

function blockHtml(block: MailBlock): string {
  const p = `margin:0 0 16px;font-size:15px;line-height:1.55;color:${COLORS.text};`;
  switch (block.type) {
    case "paragraph":
      return `<p style="${p}">${inlineHtml(block.text)}</p>`;
    case "note":
      return `<p style="margin:0 0 16px;padding:12px 14px;border-radius:8px;background:${COLORS.soft};font-size:14px;line-height:1.5;color:${COLORS.muted};">${inlineHtml(block.text)}</p>`;
    case "heading":
      return `<h2 style="margin:24px 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${COLORS.muted};">${escapeHtml(block.text)}</h2>`;
    case "link":
      return `<p style="${p}">${inlineHtml(block.url)}</p>`;
    case "button":
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${COLORS.accent};"><a href="${escapeHtml(block.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:${COLORS.accentText};text-decoration:none;border-radius:8px;">${escapeHtml(block.label)}</a></td></tr></table>`;
    case "details":
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border:1px solid ${COLORS.border};border-radius:8px;border-collapse:separate;">${block.rows
        .map(
          ([label, value], index) =>
            `<tr><td style="padding:10px 14px;font-size:13px;color:${COLORS.muted};vertical-align:top;white-space:nowrap;${index ? `border-top:1px solid ${COLORS.border};` : ""}">${escapeHtml(label)}</td><td style="padding:10px 14px;font-size:14px;color:${COLORS.text};${index ? `border-top:1px solid ${COLORS.border};` : ""}">${inlineHtml(value)}</td></tr>`,
        )
        .join("")}</table>`;
    case "list":
      return `<ul style="margin:0 0 16px;padding-left:20px;">${block.items
        .map(
          (item) =>
            `<li style="margin:0 0 6px;font-size:15px;line-height:1.5;color:${COLORS.text};">${inlineHtml(item)}</li>`,
        )
        .join("")}</ul>`;
  }
}

const DEFAULT_SIGNATURE = `Viele Grüße\n${DEFAULT_SITE_TITLE}`;

export function renderMail(content: MailContent): RenderedMail {
  const signature = content.signature === undefined ? DEFAULT_SIGNATURE : content.signature;
  const baseUrl = getAppBaseUrl();

  const footerLinks: string[] = [];
  if (content.settingsUrl) footerLinks.push(`Einstellungen: ${content.settingsUrl}`);
  if (content.unsubscribeUrl) footerLinks.push(`Abbestellen: ${content.unsubscribeUrl}`);

  const text = [
    ...(content.greeting ? [content.greeting, ""] : []),
    ...content.blocks.flatMap((block) => [blockText(block), ""]),
    ...(signature ? [signature, ""] : []),
    ...(content.footer || footerLinks.length ? ["--"] : []),
    ...(content.footer ? [content.footer] : []),
    ...footerLinks,
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const footerHtml = [
    content.footer ? `<p style="margin:0 0 8px;">${inlineHtml(content.footer)}</p>` : "",
    footerLinks.length
      ? `<p style="margin:0;">${[
          content.settingsUrl
            ? `<a href="${escapeHtml(content.settingsUrl)}" style="color:${COLORS.muted};">Benachrichtigungs-Einstellungen</a>`
            : "",
          content.unsubscribeUrl
            ? `<a href="${escapeHtml(content.unsubscribeUrl)}" style="color:${COLORS.muted};">Abbestellen</a>`
            : "",
        ]
          .filter(Boolean)
          .join(" · ")}</p>`
      : "",
  ].join("");

  const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.page};font-family:${FONT};">
${content.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 16px;"><a href="${escapeHtml(baseUrl)}" style="text-decoration:none;color:${COLORS.text};"><img src="${escapeHtml(baseUrl)}/Logo-Sommertheater.png" width="40" height="40" alt="" style="vertical-align:middle;border:0;border-radius:8px;"> <span style="font-family:Georgia,'Times New Roman',serif;font-size:18px;vertical-align:middle;color:${COLORS.accent};">${escapeHtml(DEFAULT_SITE_TITLE)}</span></a></td></tr>
<tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;padding:28px 28px 12px;">
${content.greeting ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${COLORS.text};">${escapeHtml(content.greeting)}</p>` : ""}
${content.blocks.map(blockHtml).join("\n")}
${signature ? `<p style="margin:8px 0 16px;font-size:15px;line-height:1.55;color:${COLORS.text};">${inlineHtml(signature)}</p>` : ""}
</td></tr>
${footerHtml ? `<tr><td style="padding:16px 8px;font-size:12px;line-height:1.5;color:${COLORS.muted};text-align:center;">${footerHtml}</td></tr>` : ""}
</table></td></tr></table></body></html>`;

  return { subject: content.subject, text, html };
}

/** Altbestand: fertiger Text ohne Bausteine – Absätze werden übernommen. */
export function renderPlainTextMail(subject: string, text: string): RenderedMail {
  return renderMail({
    subject,
    signature: null,
    blocks: text
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => ({ type: "paragraph" as const, text: part })),
  });
}
