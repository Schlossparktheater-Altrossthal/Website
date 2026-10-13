import { z } from "zod";

import type { PdfTemplate } from "@/lib/pdf/types";

import type { ScriptReaderData } from "./reader";
import { cueLineIndices, isRoleBlock, splitTail } from "./reader-logic";
import type { CueCategory, ScriptPart } from "./types";

/**
 * PDF-Ausgabe einer Fassung mit den Einstellungen des Lesers (docs/Plan/skript-plan.md, Phase 6).
 * Aufbau wie der Leser am Desktop: Sprecher-Spalte links, Text rechts, Regie kursiv.
 */

export const SCRIPT_PDF_VISIBILITY = ["show", "dim", "hide"] as const;

export const scriptPdfOptionsSchema = z.object({
  roleIds: z.array(z.string()).default([]),
  directions: z.enum(SCRIPT_PDF_VISIBILITY).default("show"),
  hiddenCues: z.array(z.string()).default([]),
  dimOthers: z.boolean().default(false),
  fontSize: z.number().int().min(0).max(3).default(1),
});

export type ScriptPdfOptions = z.infer<typeof scriptPdfOptionsSchema>;

export type ScriptPdfInput = {
  title: string;
  data: ScriptReaderData;
  options: ScriptPdfOptions;
};

/** Druckfarben je Gewerk (dunkel genug für Schwarzweiß-Druck). */
const CUE_COLORS: Record<CueCategory, string> = {
  ton: "#a16207",
  licht: "#0e7490",
  nebel: "#15803d",
  effekt: "#a21caf",
  umbau: "#b91c1c",
  aus: "#57534e",
  technik: "#c2410c",
};
const CUE_LABELS: Record<CueCategory, string> = {
  ton: "TON",
  licht: "LICHT",
  nebel: "NEBEL",
  effekt: "EFFEKT",
  umbau: "UMBAU",
  aus: "OFF",
  technik: "TECHNIK",
};
const INK = "#1c1917";
const MUTED = "#78716c";
const MINE_FILL = "#fdeedd";
const MINE_BAR = "#d9480f";

const FONT_SIZES = [9, 10, 11, 12.5];
const MARGIN = 48;
const SPEAKER_WIDTH = 92;
const GAP = 10;

type Doc = PDFKit.PDFDocument;

function fileSlug(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "skript"
  );
}

function visibleParts(parts: ScriptPart[], options: ScriptPdfOptions, hidden: Set<string>) {
  return parts.filter((part) => {
    if (part.kind === "cue") return !hidden.has(part.category);
    if (part.kind === "direction") return options.directions !== "hide";
    return true;
  });
}

type Run = { text: string; font: string; color: string; oblique?: boolean; underline?: boolean };

function partRuns(
  parts: ScriptPart[],
  options: ScriptPdfOptions,
  baseColor: string,
  cueLine: boolean,
): Run[] {
  const runs: Run[] = [];
  const lastText = cueLine ? parts.findLastIndex((part) => part.kind === "text") : -1;
  const directionColor = options.directions === "dim" ? "#a8a29e" : MUTED;
  parts.forEach((part, index) => {
    if (part.kind === "cue") {
      const color = CUE_COLORS[part.category];
      const label = CUE_LABELS[part.category];
      const named = part.text.toUpperCase().startsWith(label);
      runs.push({
        text: named ? `[${part.text}] ` : `[${label}: ${part.text}] `,
        font: "Helvetica-Bold",
        color,
      });
    } else if (part.kind === "direction") {
      runs.push({ text: `${part.text} `, font: "Helvetica", color: directionColor, oblique: true });
    } else if (index === lastText) {
      const [head, tail] = splitTail(part.text);
      if (head) runs.push({ text: head, font: "Helvetica", color: baseColor });
      runs.push({ text: `${tail} `, font: "Helvetica-Bold", color: baseColor, underline: true });
    } else {
      runs.push({ text: `${part.text} `, font: "Helvetica", color: baseColor });
    }
  });
  return runs;
}

function writeRuns(doc: Doc, runs: Run[], x: number, y: number, width: number) {
  runs.forEach((run, index) => {
    doc.font(run.font).fillColor(run.color);
    const options = {
      width,
      continued: index < runs.length - 1,
      // pdfkit behält Optionen bei `continued` bei – daher immer explizit setzen.
      oblique: run.oblique ? 12 : 0,
      underline: run.underline ?? false,
      lineGap: 1.5,
    };
    const text = index === runs.length - 1 ? run.text.trimEnd() || " " : run.text;
    if (index === 0) doc.text(text, x, y, options);
    else doc.text(text, options);
  });
}

function runsHeight(doc: Doc, runs: Run[], width: number) {
  // Näherung: gemischte Schnitte als Normalschrift gemessen, Fettes etwas breiter.
  doc.font("Helvetica");
  const text = runs.map((run) => run.text).join("");
  return doc.heightOfString(text.trimEnd() || " ", { width, lineGap: 1.5 }) * 1.04;
}

export function renderScriptPdf(doc: Doc, input: ScriptPdfInput) {
  const { data, options, title } = input;
  const size = FONT_SIZES[options.fontSize] ?? FONT_SIZES[1];
  const hidden = new Set(options.hiddenCues);
  const roleSet = new Set(options.roleIds);
  const cueLines = cueLineIndices(data.blocks, roleSet);
  const left = MARGIN;
  const right = doc.page.width - MARGIN;
  const textX = left + SPEAKER_WIDTH + GAP;
  const textWidth = right - textX;
  const bottom = () => doc.page.height - MARGIN;
  const selectedNames = data.roles.filter((role) => roleSet.has(role.id)).map((r) => r.name);

  // Titelblock
  doc.font("Helvetica-Bold").fontSize(18).fillColor(INK).text(title, left, MARGIN);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(MUTED)
    .text(
      [
        data.version.label,
        data.version.status === "draft" ? "Entwurf" : null,
        selectedNames.length ? `Hervorgehoben: ${selectedNames.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  doc.moveDown(0.8);

  const sceneTitles = new Map(data.scenes.map((scene) => [scene.id, scene.title]));
  let currentScene: string | null = null;
  doc.fontSize(size);

  const ensureSpace = (height: number) => {
    if (doc.y + height > bottom()) {
      doc.addPage();
      doc.fontSize(size);
    }
  };

  data.blocks.forEach((block, index) => {
    if (block.sceneId !== currentScene) {
      currentScene = block.sceneId;
      ensureSpace(size * 5);
      doc.moveDown(0.6);
      const y = doc.y;
      doc
        .font("Helvetica-Bold")
        .fontSize(size * 1.05)
        .fillColor(INK)
        .text((sceneTitles.get(block.sceneId) ?? "").toUpperCase(), left, y, {
          width: right - left,
          characterSpacing: 0.6,
        });
      const lineY = doc.y + 2;
      doc.moveTo(left, lineY).lineTo(right, lineY).lineWidth(1.2).strokeColor(INK).stroke();
      doc.y = lineY + size * 0.5;
      doc.fontSize(size);
    }

    const parts = visibleParts(block.parts, options, hidden);
    if (!parts.length) return;

    if (block.kind === "direction") {
      if (options.directions === "hide" && !parts.some((part) => part.kind === "cue")) return;
      const runs = partRuns(parts, options, MUTED, false);
      const height = runsHeight(doc, runs, textWidth);
      ensureSpace(height);
      const y = doc.y;
      writeRuns(doc, runs, textX, y, textWidth);
      doc.y = Math.max(doc.y, y + height) + size * 0.3;
      return;
    }

    const mine = isRoleBlock(block, roleSet);
    const dimmed = options.dimOthers && roleSet.size > 0 && !mine;
    const color = dimmed ? "#a8a29e" : INK;
    const runs = partRuns(parts, options, color, cueLines.has(index));
    doc.font("Helvetica-Bold");
    const speaker = (block.speaker ?? "?").toUpperCase();
    const speakerHeight = doc.fontSize(size * 0.85).heightOfString(speaker, {
      width: SPEAKER_WIDTH,
    });
    doc.fontSize(size);
    const height = Math.max(runsHeight(doc, runs, textWidth), speakerHeight);
    ensureSpace(Math.min(height, bottom() - MARGIN));
    const y = doc.y;
    if (mine) {
      doc
        .rect(left - 6, y - 2, right - left + 12, height + 4)
        .fill(MINE_FILL)
        .rect(left - 6, y - 2, 2.5, height + 4)
        .fill(MINE_BAR);
    }
    doc
      .font("Helvetica-Bold")
      .fontSize(size * 0.85)
      .fillColor(mine ? MINE_BAR : dimmed ? "#a8a29e" : INK)
      .text(speaker, left, y + size * 0.1, { width: SPEAKER_WIDTH, characterSpacing: 0.3 });
    doc.fontSize(size);
    writeRuns(doc, runs, textX, y, textWidth);
    doc.y = Math.max(doc.y, y + height) + size * 0.35;
  });

  // Kopf- und Fußzeile auf jeder Seite
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page++) {
    doc.switchToPage(page);
    // Fußzeile liegt im unteren Rand – ohne das legt pdfkit eine neue Seite an.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - MARGIN + 16;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`${title} · ${data.version.label}`, left, footerY, {
        width: right - left,
        lineBreak: false,
      })
      .text(`${page - range.start + 1} / ${range.count}`, left, footerY, {
        width: right - left,
        align: "right",
        lineBreak: false,
      });
    doc.page.margins.bottom = bottomMargin;
  }
}

export const scriptReaderPdfTemplate: PdfTemplate<ScriptPdfInput> = {
  id: "skript-fassung",
  label: "Skript-Fassung",
  description: "Fassung eines Skripts mit hervorgehobenen Rollen und gefilterten Hinweisen.",
  schema: z.custom<ScriptPdfInput>(
    (value) => typeof value === "object" && value !== null && "data" in value && "options" in value,
  ),
  filename: (input) => `skript-${fileSlug(input.title)}-${fileSlug(input.data.version.label)}.pdf`,
  documentOptions: { size: "A4", margin: MARGIN, bufferPages: true },
  render: renderScriptPdf,
};
