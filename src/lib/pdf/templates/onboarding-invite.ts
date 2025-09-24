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

export const onboardingInviteTemplate: PdfTemplate<OnboardingInvitePdfData> = {
  id: "onboarding-invite",
  label: "Onboarding-Link Poster",
  description: "Erzeugt ein A4-PDF mit QR-Code für einen Onboarding-Link.",
  filename: (data) => {
    const slug = slugify(data.inviteLabel ?? data.headline ?? null);
    return slug ? `onboarding-${slug}.pdf` : "onboarding-link.pdf";
  },
  schema: onboardingInviteSchema,
  async render(doc, data) {
    const QRCode = await loadQrCode();
    const title = data.headline ?? data.inviteLabel ?? "Onboarding starten";
    const greetingHeadline = "Willkommen an Bord!";
    const warmIntro = data.inviteLabel
      ? `Schön, dass du beim Onboarding „${data.inviteLabel}“ dabei bist!`
      : "Schön, dass du bei uns bist!";
    const actionLine = data.inviteLabel
      ? `Scanne den QR-Code oder nutze den Link, um ganz entspannt mit deinem Onboarding „${data.inviteLabel}“ zu starten.`
      : "Scanne den QR-Code oder nutze den Link, um ganz entspannt mit deinem Onboarding zu starten.";

    doc.info.Title = title;
    doc.info.Subject = "Einladung zum Onboarding";

    doc.font("Helvetica-Bold").fontSize(32).fillColor("#0f172a").text(greetingHeadline, { align: "center" });

    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(26).fillColor("#111827").text(title, { align: "center" });

    doc.moveDown(0.55);
    doc.font("Helvetica").fontSize(14).fillColor("#1f2937").text(warmIntro, { align: "center" });

    doc.moveDown(0.25);
    doc.font("Helvetica").fontSize(13).fillColor("#1f2937").text(actionLine, { align: "center" });

    if (data.note) {
      doc.moveDown(0.5);
      doc
        .font("Helvetica-Oblique")
        .fontSize(12)
        .fillColor("#374151")
        .text(data.note, {
          align: "center",
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        });
    }

    const qrImage = await QRCode.toBuffer(data.link, { margin: 1, width: 512 });
    const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const qrSize = Math.min(availableWidth, 280);
    const qrX = doc.page.margins.left + (availableWidth - qrSize) / 2;
    const qrY = doc.y + 24;

    doc.moveDown(1.2);
    doc.image(qrImage, qrX, qrY, { width: qrSize, height: qrSize });
    doc.y = qrY + qrSize;

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#111827").text("Direkt zum Start", { align: "center" });
    doc.moveDown(0.25);
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#1d4ed8")
      .text(data.link, { align: "center", link: data.link, underline: true });

    doc.moveDown(0.4);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#374151")
      .text("Wenn der QR-Code einmal zickt, gib den Link einfach im Browser ein.", { align: "center" });

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
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#111827").text("Organisatorisches", { align: "left" });
      doc.moveDown(0.2);
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#4b5563")
        .text("Damit du planen kannst, findest du hier die wichtigsten Rahmendaten:", {
          align: "left",
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        });
      doc.moveDown(0.35);
      doc.font("Helvetica").fontSize(11).fillColor("#374151");
      for (const entry of detailEntries) {
        doc.text(`${entry.label}: ${entry.value}`);
      }
    }

    doc.moveDown(0.9);
    doc.font("Helvetica").fontSize(11).fillColor("#1f2937").text("Wir freuen uns auf dich – bis bald!", {
      align: "center",
    });

    doc.moveDown(0.6);
    const generatedAt = formatDateTime(new Date());
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text(`Erstellt am ${generatedAt}`, { align: "right" });
  },
};
