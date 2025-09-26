import { z } from "zod";

import { describeRoles, ROLES } from "@/lib/roles";

import type { PdfTemplate } from "../types";

type QrCodeModule = typeof import("qrcode");

let cachedQrCodeModule: QrCodeModule | null = null;

async function loadQrCode(): Promise<QrCodeModule> {
  if (cachedQrCodeModule) {
    return cachedQrCodeModule;
  }

  const qrModule = await import("qrcode");
  const resolved = (qrModule as QrCodeModule & { default?: QrCodeModule }).default ?? (qrModule as QrCodeModule);
  cachedQrCodeModule = resolved;
  return resolved;
}

const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

const onboardingInviteSchema = z.object({
  link: z
    .string()
    .url()
    .transform((value) => value.trim()),
  displayLink: optionalString,
  headline: optionalString,
  inviteLabel: optionalString,
  note: optionalString,
  expiresAt: z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform((value) => {
      if (!value) return null;
      if (value instanceof Date) {
        return Number.isNaN(value.valueOf()) ? null : value;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.valueOf()) ? null : parsed;
      }
      return null;
    }),
  maxUses: z
    .union([z.number().int().positive(), z.null(), z.undefined()])
    .transform((value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(1, Math.floor(value));
      }
      return null;
    }),
  roles: z
    .array(z.enum(ROLES))
    .optional()
    .transform((value) => {
      if (!value?.length) return [] as typeof ROLES[number][];
      const unique = new Set(value);
      return Array.from(unique);
    }),
});

export type OnboardingInvitePdfData = z.infer<typeof onboardingInviteSchema>;

function slugify(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 60);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatLinkForDisplay(link: string) {
  try {
    const url = new URL(link);
    const host = url.host.replace(/^www\./i, "");
    const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    const search = url.search ?? "";
    const hash = url.hash ?? "";
    const compact = `${host}${pathname}${search}${hash}`;
    return compact || link;
  } catch {
    return link;
  }
}

export const onboardingInviteTemplate: PdfTemplate<OnboardingInvitePdfData> = {
  id: "onboarding-invite",
  label: "Backstage-Pass Poster",
  description: "Erzeugt ein farbenfrohes A4-PDF mit QR-Code für neue Gesichter beim Sommertheater Altrossthal.",
  filename: (data) => {
    const slug = slugify(data.inviteLabel ?? data.headline ?? null);
    return slug ? `onboarding-${slug}.pdf` : "onboarding-link.pdf";
  },
  schema: onboardingInviteSchema,
  async render(doc, data) {
    const QRCode = await loadQrCode();
    const theatreName = "Sommertheater Altrossthal";
    const palette = {
      background: "#fff7ed",
      sunrise: "#f97316",
      twilight: "#0ea5e9",
      rose: "#f43f5e",
      highlight: "#fde68a",
      text: "#1f2937",
      textMuted: "#4b5563",
      textSoft: "#6b7280",
      qrFrame: "#0f172a",
      qrGlowOuter: "#0b1120",
      qrGlowInner: "#1e293b",
      qrGradientStart: "#1f2937",
      qrGradientEnd: "#0f172a",
      qrModulePrimary: "#0f172a",
      qrModuleSecondary: "#1e293b",
      qrFinderOuter: "#000000",
      qrFinderInner: "#ffffff",
      qrFinderCore: "#000000",
      qrFrameStroke: "#4338ca",
    } as const;

    const title = data.headline ?? data.inviteLabel ?? "Dein Backstage-Start";
    const greetingHeadline = `Willkommen im ${theatreName}`;
    const warmIntro = data.inviteLabel
      ? `Wie schön, dass du für „${data.inviteLabel}“ unsere Bühnenfamilie verstärkst.`
      : "Wie schön, dass du Teil unserer Bühnenfamilie wirst!";
    const actionLine = data.inviteLabel
      ? `Scanne den Code oder folge dem Link und hol dir deinen Backstage-Zugang zum ${theatreName}.`
      : "Scanne den Code oder folge dem Link und sichere dir deinen Backstage-Zugang.";
    const storyLine = `${theatreName} lebt von Menschen, die Ideen mitbringen, mit anpacken und das Publikum verzaubern – schnapp dir alle Infos und leg los.`;

    doc.info.Title = title;
    doc.info.Subject = `Einladung ins Ensemble des ${theatreName}`;

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const { left: marginLeft, right: marginRight, top: marginTop, bottom: marginBottom } = doc.page.margins;
    const availableWidth = pageWidth - marginLeft - marginRight;

    doc.save();
    doc.rect(0, 0, pageWidth, pageHeight).fill(palette.background);
    doc.restore();

    doc.save();
    doc.opacity(0.12);
    doc.fillColor(palette.sunrise);
    doc.circle(pageWidth - 90, marginTop - 30, 150).fill();
    doc.restore();

    doc.save();
    doc.opacity(0.1);
    doc.fillColor(palette.twilight);
    doc.circle(90, pageHeight - marginBottom + 40, 170).fill();
    doc.restore();

    doc.save();
    doc.opacity(0.18);
    doc.fillColor(palette.highlight);
    doc.rect(marginLeft, marginTop - 24, availableWidth, 48).fill();
    doc.restore();

    doc.save();
    doc.opacity(0.12);
    doc.fillColor(palette.rose);
    doc.rect(marginLeft, pageHeight - marginBottom - 52, availableWidth, 44).fill();
    doc.restore();

    doc.opacity(1);
    doc.y = marginTop;

    doc.font("Helvetica-Bold").fontSize(32).fillColor(palette.sunrise).text(greetingHeadline, { align: "center" });

    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(26).fillColor(palette.text).text(title, { align: "center" });

    doc.moveDown(0.55);
    doc.font("Helvetica").fontSize(14).fillColor(palette.text).text(warmIntro, { align: "center" });

    doc.moveDown(0.25);
    doc.font("Helvetica").fontSize(13).fillColor(palette.textMuted).text(actionLine, { align: "center" });

    doc.moveDown(0.35);
    doc.font("Helvetica").fontSize(12).fillColor(palette.textMuted).text(storyLine, { align: "center" });

    if (data.note) {
      doc.moveDown(0.8);
      const noteBoxWidth = Math.min(availableWidth, 360);
      const noteX = marginLeft + (availableWidth - noteBoxWidth) / 2;
      const noteY = doc.y;
      const noteTextWidth = noteBoxWidth - 24;
      const noteHeight = doc.heightOfString(data.note, { width: noteTextWidth });

      doc.save();
      doc.roundedRect(noteX, noteY - 14, noteBoxWidth, noteHeight + 28, 18).fillColor("#ffe4e6").fill();
      doc.restore();

      doc.save();
      doc.font("Helvetica-Oblique").fontSize(12).fillColor(palette.rose);
      doc.text(data.note, noteX + 12, noteY, {
        width: noteTextWidth,
        align: "center",
      });
      doc.restore();

      doc.y = noteY + noteHeight + 14;
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(16).fillColor(palette.sunrise).text("Backstage-Check-in", { align: "center" });

    doc.moveDown(0.8);
    const qrTopPadding = Math.max(doc.currentLineHeight(true) * 0.8, 12);
    doc.y += qrTopPadding;
    const qrData = QRCode.create(data.link, {
      errorCorrectionLevel: "H",
    });
    const qrModuleCount = qrData.modules.size;
    const qrQuietZone = 4;
    const qrTargetSize = Math.min(availableWidth, 192);
    const qrModuleSize = qrTargetSize / (qrModuleCount + qrQuietZone * 2);
    const qrSize = qrModuleSize * (qrModuleCount + qrQuietZone * 2);
    const qrX = marginLeft + (availableWidth - qrSize) / 2;
    const qrY = doc.y;
    const qrContentX = qrX + qrQuietZone * qrModuleSize;
    const qrContentY = qrY + qrQuietZone * qrModuleSize;

    const finderSize = 7;
    const finderOffsets = [
      { row: 0, col: 0 },
      { row: 0, col: qrModuleCount - finderSize },
      { row: qrModuleCount - finderSize, col: 0 },
    ] as const;

    const isFinderModule = (row: number, col: number) =>
      finderOffsets.some(
        (offset) =>
          row >= offset.row &&
          row < offset.row + finderSize &&
          col >= offset.col &&
          col < offset.col + finderSize,
      );

    const qrFramePadding = 24;
    const qrFrameRadius = 30;
    const qrCenterX = qrX + qrSize / 2;
    const qrCenterY = qrY + qrSize / 2;

    doc.save();
    doc.opacity(0.16);
    doc.fillColor(palette.qrGlowOuter);
    doc.circle(qrCenterX, qrCenterY, qrSize / 2 + 42).fill();
    doc.restore();

    doc.save();
    doc.opacity(0.28);
    doc.fillColor(palette.qrGlowInner);
    doc.circle(qrCenterX, qrCenterY, qrSize / 2 + 26).fill();
    doc.restore();

    doc.save();
    doc.roundedRect(
      qrX - qrFramePadding,
      qrY - qrFramePadding,
      qrSize + qrFramePadding * 2,
      qrSize + qrFramePadding * 2,
      qrFrameRadius,
    )
      .fillColor(palette.qrFrame)
      .fill();
    doc.restore();

    doc.save();
    doc.lineWidth(3.4);
    doc.roundedRect(
      qrX - qrFramePadding,
      qrY - qrFramePadding,
      qrSize + qrFramePadding * 2,
      qrSize + qrFramePadding * 2,
      qrFrameRadius,
    )
      .stroke(palette.qrFrameStroke);
    doc.restore();

    doc.save();
    doc.roundedRect(qrX, qrY, qrSize, qrSize, 16).fill("#ffffff");
    doc.restore();

    doc.save();
    const moduleRadius = (qrModuleSize / 2) * 0.82;
    doc.fillColor(palette.qrModulePrimary);
    for (let row = 0; row < qrModuleCount; row += 1) {
      for (let col = 0; col < qrModuleCount; col += 1) {
        if (!qrData.modules.get(row, col) || isFinderModule(row, col)) {
          continue;
        }

        const moduleX = qrContentX + col * qrModuleSize;
        const moduleY = qrContentY + row * qrModuleSize;
        const centerX = moduleX + qrModuleSize / 2;
        const centerY = moduleY + qrModuleSize / 2;

        doc.circle(centerX, centerY, moduleRadius).fill();
      }
    }
    doc.restore();

    for (const offset of finderOffsets) {
      const finderX = qrContentX + offset.col * qrModuleSize;
      const finderY = qrContentY + offset.row * qrModuleSize;
      const finderDimension = finderSize * qrModuleSize;
      const finderCenterX = finderX + finderDimension / 2;
      const finderCenterY = finderY + finderDimension / 2;
      const outerRadius = finderDimension / 2;
      const innerRadius = Math.max(outerRadius - qrModuleSize * 1.4, qrModuleSize);
      const coreRadius = Math.max(innerRadius - qrModuleSize * 1.2, qrModuleSize * 0.6);

      doc.save().circle(finderCenterX, finderCenterY, outerRadius).fillColor(palette.qrFinderOuter).fill().restore();
      doc.save().circle(finderCenterX, finderCenterY, innerRadius).fillColor(palette.qrFinderInner).fill().restore();
      doc.save().circle(finderCenterX, finderCenterY, coreRadius).fillColor(palette.qrFinderCore).fill().restore();
    }

    doc.y = qrY + qrSize + 28;

    doc.moveDown(0.9);
    doc.font("Helvetica-Bold").fontSize(14).fillColor(palette.text).text("Direkter Zugang", { align: "center" });
    doc.moveDown(0.25);
    const displayLink = data.displayLink ?? data.link;
    const manualLink = formatLinkForDisplay(displayLink);
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor(palette.sunrise)
      .text(manualLink, { align: "center", link: data.link, underline: true });

    doc.moveDown(0.4);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(palette.textMuted)
      .text("Falls die Kamera streikt, gib den Link einfach im Browser ein.", { align: "center" });

    const detailEntries: Array<{ label: string; value: string }> = [];
    if (data.inviteLabel && data.inviteLabel !== title) {
      detailEntries.push({ label: "Titel", value: data.inviteLabel });
    }
    if (data.expiresAt) {
      detailEntries.push({ label: "Gültig bis", value: formatDate(data.expiresAt) });
    }
    if (typeof data.maxUses === "number") {
      detailEntries.push({ label: "Maximale Nutzungen", value: String(data.maxUses) });
    }
    if (data.roles.length) {
      detailEntries.push({ label: "Vorausgewählte Rollen", value: describeRoles(data.roles) });
    }

    if (detailEntries.length) {
      doc.moveDown(1);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(palette.sunrise).text("Backstage-Fakten", { align: "left" });
      doc.moveDown(0.2);
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(palette.textMuted)
        .text("Damit deine erste Probe stressfrei läuft, findest du hier die wichtigsten Eckdaten:", {
          align: "left",
          width: availableWidth,
        });
      doc.moveDown(0.35);
      for (const entry of detailEntries) {
        doc.font("Helvetica-Bold").fontSize(11).fillColor(palette.rose).text(`${entry.label}: `, { continued: true });
        doc.font("Helvetica").fontSize(11).fillColor(palette.text).text(entry.value);
      }
    }

    doc.moveDown(0.9);
    doc.font("Helvetica").fontSize(11).fillColor(palette.text).text("Wir sehen uns auf und hinter der Bühne!", {
      align: "center",
    });

    doc.moveDown(0.6);
    const generatedAt = formatDateTime(new Date());
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(palette.textSoft)
      .text(`Erstellt am ${generatedAt}`, { align: "right" });
  },
};
